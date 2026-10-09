"""Weekly India district forecast from a portable runtime bundle (india-epiclim-v2).

The research script scripts/forecast_epiclim2.py fits calibration on the out-of-fold predictions every time; this
module runs the same forecast from a small bundle made once by scripts/make_runtime.py:
  runtime/<version>/models/<disease>|<h>|<variant>.txt.gz   LightGBM text models (version-independent)
  runtime/<version>/runtime.json                            features, Platt calibration, risk thresholds,
                                                            blind-spot thresholds, tier statistics
  runtime/<version>/{districts,events,normals,normals2,target_normals}.parquet   static inputs
  runtime/<version>/model_card.json                         card for public.model_runs (signals are refreshed)

Weather comes from the NASA POWER daily point API at every district centroid (community AG; the same variables
the model was trained on). Nothing is invented: a district without weather keeps missing inputs, and the issue
date is the last day with weather for at least 98% of districts.
"""
from __future__ import annotations

import gzip
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from pipeline.india_monthly import (DISEASES, FAMILY, HORIZONS, aedes_t, anoph_t, history_features, mi,
                                    mobility_features, mobility_matrix, moisture, outbreak_grid)

VERSION = "india-epiclim-v2"
WINDOW = 28
N_WINDOWS = 6
RAIN_X = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
TEMP_D = [-1.0, 0.0, 1.0, 2.0]
VARIANTS = ("full", "history+mobility", "climate only")
CLIMATE_FAMILIES = {"rain", "rain_anom", "temp", "temp_anom", "humidity", "aedes", "anopheles", "season", "water",
                    "sunlight", "heat", "wind"}
SIGNAL = {"rain": "weather", "rain_anom": "weather", "temp": "weather", "temp_anom": "weather", "humidity": "weather",
          "heat": "weather", "wind": "weather", "water": "water", "sunlight": "satellite", "aedes": "vector",
          "anopheles": "vector", "season": "season", "mobility": "mobility", "history": "surveillance",
          "surveillance": "surveillance", "population": "population", "recent": "surveillance"}
POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_PARAMS = {"T2M": "t2m", "PRECTOTCORR": "rain", "RH2M": "rh", "GWETROOT": "gw_root", "GWETTOP": "gw_top",
                "ALLSKY_SFC_SW_DWN": "solar", "T2M_MAX": "tmax", "T2M_MIN": "tmin", "WS2M": "wind"}
DB_DISEASE = {"diarrhoea": "add"}


# ------------------------------------------------------------------------------------------------ runtime bundle
class Runtime:
    def __init__(self, path: Path):
        self.path = Path(path)
        meta = json.loads((self.path / "runtime.json").read_text())
        self.meta = meta
        self.version = meta["model_version"]
        self.dist = pd.read_parquet(self.path / "districts.parquet")
        self.events = pd.read_parquet(self.path / "events.parquet")
        self.nrm = pd.read_parquet(self.path / "normals.parquet")
        self.nrm2 = pd.read_parquet(self.path / "normals2.parquet")
        self.tnorm = pd.read_parquet(self.path / "target_normals.parquet")
        self.card = json.loads((self.path / "model_card.json").read_text())
        self._models: dict[str, lgb.Booster] = {}

    def model(self, key: str) -> tuple[lgb.Booster, list[str]]:
        if key not in self._models:
            with gzip.open(self.path / "models" / f"{key.replace('|', '__').replace(' ', '_')}.txt.gz", "rt") as f:
                self._models[key] = lgb.Booster(model_str=f.read())
        return self._models[key], self.meta["models"][key]["feats"]

    def calibrate(self, key: str, raw: np.ndarray) -> np.ndarray:
        a, b = self.meta["models"][key]["platt"]
        z = a * logit(raw) + b
        return 1.0 / (1.0 + np.exp(-z))


def logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


# ------------------------------------------------------------------------------------------------ NASA POWER
def _fetch_one(session, lat: float, lon: float, start: str, end: str, tries: int = 6) -> dict:
    params = dict(parameters=",".join(POWER_PARAMS), community="AG", longitude=f"{lon:.4f}", latitude=f"{lat:.4f}",
                  start=start, end=end, format="JSON")
    wait = 5.0
    for k in range(tries):
        try:
            r = session.get(POWER_URL, params=params, timeout=120)
            if r.status_code == 200:
                return r.json()["properties"]["parameter"]
            if r.status_code not in (429, 500, 502, 503, 504):
                raise RuntimeError(f"NASA POWER {r.status_code}: {r.text[:200]}")
        except (ValueError, KeyError) as e:  # bad JSON
            if k == tries - 1:
                raise RuntimeError(f"NASA POWER returned unreadable data: {e}") from e
        except Exception as e:  # network error: retry
            if k == tries - 1:
                raise
        time.sleep(wait)
        wait = min(wait * 2, 120)
    raise RuntimeError("NASA POWER did not answer")


def parse_power(district_id: str, param: dict) -> pd.DataFrame:
    """POWER JSON 'parameter' block -> one row per day; the fill value -999 becomes missing."""
    days = sorted(next(iter(param.values())).keys())
    out = pd.DataFrame({"district_id": district_id, "day": pd.to_datetime(days, format="%Y%m%d")})
    for p, col in POWER_PARAMS.items():
        vals = param.get(p, {})
        v = np.array([vals.get(d, -999.0) for d in days], dtype=float)
        v[v <= -998] = np.nan
        out[col] = v
    return out


def fetch_daily(dist: pd.DataFrame, start: date, end: date, workers: int = 6, log=print) -> pd.DataFrame:
    """Daily weather for every district centroid, start..end (inclusive). Failed districts are reported, not filled."""
    import requests
    s, e = start.strftime("%Y%m%d"), end.strftime("%Y%m%d")
    frames, failed = [], []
    with requests.Session() as session, ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_fetch_one, session, float(r.lat), float(r.lon), s, e): r.district_id for r in dist.itertuples()}
        for n, fut in enumerate(as_completed(futs), start=1):
            d = futs[fut]
            try:
                frames.append(parse_power(d, fut.result()))
            except Exception as ex_:  # keep going; the issue date check decides whether the run is usable
                failed.append(d)
                log(f"  {d}: {ex_}")
            if n % 80 == 0:
                log(f"  weather {n}/{len(futs)}")
    if failed:
        log(f"weather missing for {len(failed)} districts: {', '.join(sorted(failed)[:20])}")
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=["district_id", "day", *POWER_PARAMS.values()])


def issue_date(daily: pd.DataFrame, n_districts: int, share: float = 0.98):
    have = daily.dropna(subset=["t2m", "rain"]).groupby("day").district_id.nunique()
    ok = have[have >= share * n_districts]
    return None if ok.empty else pd.Timestamp(ok.index.max())


# ------------------------------------------------------------------------------------------------ features
def window_means(daily, D, k, cols):
    lo, hi = D - pd.Timedelta(days=WINDOW * (k + 1) - 1), D - pd.Timedelta(days=WINDOW * k)
    w = daily[(daily.day >= lo) & (daily.day <= hi)]
    mid = lo + (hi - lo) / 2
    return w.groupby("district_id")[cols].mean(), mid.month


def live_features(dist, nrm, nrm2, daily, D, rain_x=1.0, temp_d=0.0):
    """Climate + satellite features for issue date D (district order as dist), optionally perturbed."""
    ids = dist.district_id.values
    f = pd.DataFrame({"district_id": ids})
    r, t, rh, rn, tn = {}, {}, {}, {}, {}
    for k in range(N_WINDOWS):
        wm, cal = window_means(daily, D, k, ["t2m", "rain", "rh", "gw_root", "gw_top"])
        wm = wm.reindex(ids)
        nk = nrm[nrm.cal == cal].set_index("district_id").reindex(ids)
        r[k] = wm.rain.values * rain_x
        t[k] = wm.t2m.values + temp_d
        rh[k] = wm.rh.values
        rn[k], tn[k] = nk.r_n.values, nk.t_n.values
        if k == 0:
            gw0, gwt0, cal0 = wm.gw_root.values, wm.gw_top.values, cal
        if k <= 2:
            f[f"r{k}"], f[f"t{k}"], f[f"rh{k}"] = r[k], t[k], rh[k]
            f[f"ra{k}"] = np.log((r[k] + 0.5) / (rn[k] + 0.5))
            f[f"ta{k}"] = t[k] - tn[k]
            f[f"aed{k}"] = aedes_t(t[k]) * moisture(r[k], rh[k])
            f[f"ano{k}"] = anoph_t(t[k]) * moisture(r[k], rh[k])
            f[f"_gw{k}"] = wm.gw_root.values
    f["r3m"] = (f.r0 + f.r1 + f.r2) / 3
    f["ra3m"] = np.log((f.r3m + 0.5) / ((rn[0] + rn[1] + rn[2]) / 3 + 0.5))
    f["t3m"] = (f.t0 + f.t1 + f.t2) / 3
    f["ta3m"] = (f.ta0 + f.ta1 + f.ta2) / 3
    f["rh3m"] = (f.rh0 + f.rh1 + f.rh2) / 3
    f["aed3m"] = (f.aed0 + f.aed1 + f.aed2) / 3
    f["ano3m"] = (f.ano0 + f.ano1 + f.ano2) / 3
    f["r6m"] = sum(r[k] for k in range(N_WINDOWS)) / N_WINDOWS
    f["ra6m"] = np.log((f.r6m + 0.5) / (sum(rn[k] for k in range(N_WINDOWS)) / N_WINDOWS + 0.5))
    w0, _ = window_means(daily, D, 0, ["solar", "tmax", "tmin", "wind"])
    w0 = w0.reindex(ids)
    n2 = nrm2[nrm2.cal == cal0].set_index("district_id").reindex(ids)
    f["sw0"] = gw0
    f["swa0"] = gw0 - n2.gw_n.values
    f["sw3m"] = (f._gw0 + f._gw1 + f._gw2) / 3
    f["swt0"] = gwt0
    f["sol0"] = w0.solar.values
    f["sola0"] = w0.solar.values - n2.sol_n.values
    f["tx0"] = w0.tmax.values + temp_d
    f["txa0"] = f.tx0 - n2.tx_n.values
    f["tn0"] = w0.tmin.values + temp_d
    f["ws0"] = w0.wind.values
    f["_cal0"] = cal0
    f["_rn3"] = (rn[0] + rn[1] + rn[2]) / 3
    return f.drop(columns=["_gw0", "_gw1", "_gw2"])


def _num(x, nd=None):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return round(float(x), nd) if nd is not None else float(x)


# ------------------------------------------------------------------------------------------------ forecast
def forecast(rt: Runtime, daily: pd.DataFrame, D: pd.Timestamp, log=print):
    """Forecast rows for every district, disease and window after issue date D, plus signal shares (weeks 1-4)."""
    dist = rt.dist
    nd = len(dist)
    W, _ = mobility_matrix(dist)
    m_lo = int(mi(200801))
    grid = outbreak_grid(rt.events, dist, m_lo, int(mi(202212)))
    base_clim = live_features(dist, rt.nrm, rt.nrm2, daily, D)
    scen = {(i, j): live_features(dist, rt.nrm, rt.nrm2, daily, D, rx, td) for i, td in enumerate(TEMP_D) for j, rx in enumerate(RAIN_X)}
    rows, signals = [], {}
    for h in HORIZONS:
        start = D + pd.Timedelta(days=1 + WINDOW * (h - 1))
        mid = start + pd.Timedelta(days=WINDOW / 2)
        tgt_m = int(mi(mid.year * 100 + mid.month))
        issue_m = tgt_m - h
        X0 = pd.DataFrame({"district_id": dist.district_id, "m": issue_m, "tgt_m": tgt_m, "d_idx": np.arange(nd)})
        X0["tgt_cal"] = mid.month
        X0 = X0.merge(rt.tnorm, on=["district_id", "tgt_cal"], how="left")
        X0["log_density"] = dist.log_density.values
        for dis in DISEASES:
            hf = history_features(grid, dis, dist, m_lo, X0.m.values, X0.tgt_m.values, X0.d_idx.values,
                                  static_upto_year=np.full(nd, 2023))
            hf = pd.concat([hf, mobility_features(W, hf, nd)], axis=1)
            Xh = pd.concat([X0, hf], axis=1)
            X = pd.concat([Xh, base_clim.drop(columns=["district_id"])], axis=1)
            keys = {v: f"{dis}|{h}|{v}" for v in VARIANTS}
            (mm, fm), (m0, f0), (mc, fc_) = (rt.model(keys[v]) for v in VARIANTS)
            raw = mm.predict(X[fm])
            p = rt.calibrate(keys["full"], raw)
            p0 = rt.calibrate(keys["history+mobility"], m0.predict(X[f0]))
            pc = rt.calibrate(keys["climate only"], mc.predict(X[fc_]))
            th = rt.meta["tiers"][f"{dis}|{h}"]["thresholds"]
            lvl = lambda x: "very_high" if x >= th["very_high"] else "high" if x >= th["high"] else "moderate" if x >= th["moderate"] else "low"  # noqa: E731
            silent = (pc >= rt.meta["silent"][f"{dis}|{h}"]) & (hf.st_rate.values == 0)
            contrib = mm.predict(X[fm], pred_contrib=True)[:, :-1]
            fams = [FAMILY[f] for f in fm]
            names = sorted(set(fams))
            F = np.zeros((nd, len(names)))
            for j, fam in enumerate(fams):
                F[:, names.index(fam)] += contrib[:, j]
            if h == 1:
                tot = np.abs(F).sum(0)
                sig: dict[str, float] = {}
                for j, fam in enumerate(names):
                    sig[SIGNAL[fam]] = sig.get(SIGNAL[fam], 0.0) + float(tot[j])
                s = sum(sig.values())
                signals[DB_DISEASE.get(dis, dis)] = {k: round(v / s, 4) for k, v in sig.items()}
            grid_p = np.zeros((nd, len(TEMP_D), len(RAIN_X)))
            for (i, j), sc in scen.items():
                Xs = pd.concat([Xh, sc.drop(columns=["district_id"])], axis=1)
                grid_p[:, i, j] = rt.calibrate(keys["full"], mm.predict(Xs[fm]))
            A = grid[dis] > 0
            tcal = tgt_m % 12
            typical = float(p.mean())
            for i, d in enumerate(dist.district_id):
                order = np.argsort(-np.abs(F[i]))
                drv = [(names[k], float(F[i, k])) for k in order[:6] if abs(F[i, k]) >= 0.02][:4]
                clim_idx = [k for k in order if names[k] in CLIMATE_FAMILIES]
                if clim_idx and names[clim_idx[0]] not in [x[0] for x in drv]:
                    drv = drv[:3] + [(names[clim_idx[0]], float(F[i, clim_idx[0]]))]
                hk = 0
                for y in range(2009, 2023):
                    cols = [y * 12 + tcal + k - m_lo for k in (-1, 0, 1)]
                    if any(0 <= c < A.shape[1] and A[i, c] for c in cols):
                        hk += 1
                b = base_clim.iloc[i]
                r3n = b._rn3
                rp = (b.r3m / r3n - 1) * 100 if r3n > 0 else 0
                inputs = dict(r3=_round_int(b.r3m * WINDOW * 3), rp=_round_int(rp), rl=_round_int(b.r0 * WINDOW),
                              t=_num(b.t0, 1), ta=_num(b.ta3m, 2), rh=_round_int(b.rh0), ae=_num(b.aed0, 2), an=_num(b.ano0, 2),
                              nr=_round_int(X0.tgt_r_n.iloc[i] * WINDOW), nt=_num(X0.tgt_t_n.iloc[i], 1),
                              hk=hk, hn=14, ay=round(float(np.nan_to_num(hf.st_any_rate.iloc[i])), 1),
                              dn=_round_int(np.expm1(dist.log_density.iloc[i])) if not np.isnan(dist.log_density.iloc[i]) else 0,
                              im=int(b._cal0), tm=int(mid.month),
                              sw=_num(b.sw0, 2), swa=_num(b.swa0, 2), sol=_num(b.sol0, 1), sola=_num(b.sola0, 1),
                              tx=_num(b.tx0, 1), ws=_num(b.ws0, 1), mb=_num(hf.mob_m3.iloc[i], 3))
                rows.append(dict(district_id=d, disease_id=DB_DISEASE.get(dis, dis), horizon=h, issue_month=str(D.date()),
                                 target_month=str(start.date()), prob=round(float(p[i]), 6), prob_no_climate=round(float(p0[i]), 6),
                                 prob_climate_only=round(float(pc[i]), 6), silent=bool(silent[i]), typical_prob=round(typical, 6),
                                 raw=float(raw[i]), risk_level=lvl(p[i]),
                                 drivers=[dict(f=f, w=round(w, 3)) for f, w in drv], inputs=inputs,
                                 scenarios=dict(r=RAIN_X, t=TEMP_D, p=[[round(float(x), 5) for x in row] for row in grid_p[i]]),
                                 model_version=rt.version))
            log(f"  weeks {(h - 1) * 4 + 1}-{h * 4} {dis}: high+ {int(sum(lvl(x) in ('high', 'very_high') for x in p))}, blind spots {int(silent.sum())}")
    fc = pd.DataFrame(rows)
    fc["rank_india"] = fc.groupby(["disease_id", "horizon"]).raw.rank(ascending=False, method="first").astype(int)
    return fc.drop(columns=["raw"]), signals


def _round_int(x):
    if x is None or (isinstance(x, float) and np.isnan(x)) or (isinstance(x, (np.floating,)) and np.isnan(x)):
        return None
    return int(round(float(x)))


# ------------------------------------------------------------------------------------------------ app rows
def forecast_records(fc: pd.DataFrame) -> list[dict]:
    recs = []
    for r in fc.to_dict(orient="records"):
        r["horizon"], r["rank_india"], r["silent"] = int(r["horizon"]), int(r["rank_india"]), bool(r["silent"])
        r["inputs"] = {k: (None if v is None or (isinstance(v, float) and np.isnan(v)) else v) for k, v in r["inputs"].items()}
        recs.append(r)
    return recs


def card_record(rt: Runtime, D: pd.Timestamp, signals: dict, start: date) -> dict:
    card = json.loads(json.dumps(rt.card))
    card["issue_date"] = str(D.date())
    card["signals"] = signals
    card["weekly_run"] = {"weather_from": str(start), "weather_to": str(D.date()), "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                          "source": "NASA POWER daily point API (community AG) at 640 district centroids"}
    return {"model_version": rt.version, "scope": "india-district", "card": card}


def source_records(D: pd.Timestamp, start: date, n_rows: int, n_weather: int, n_districts: int) -> list[dict]:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    d_txt = f"{D.day} {D.strftime('%b %Y')}"
    return [
        {"id": "india_forecast", "name": f"EpiRadar India district outbreak forecast ({VERSION})", "status": "ok", "cadence": "weekly",
         "last_success_at": now, "rows_last_run": n_rows,
         "note": f"Weather up to {d_txt}; weeks 1–4, 5–8, 9–12; 5 diseases × {n_districts} districts; all HC-01 signals as model inputs; "
                 "issued every week by the GitHub Actions workflow india-weekly (code and models on the pipeline-data branch)"},
        {"id": "nasa_power_india", "name": "NASA POWER weather, soil wetness and sunlight for 640 district centroids", "status": "ok",
         "cadence": "weekly (daily data); monthly history 2008–2026", "last_success_at": now, "rows_last_run": n_weather,
         "note": f"Daily {start.day} {start.strftime('%b %Y')} – {d_txt} (T2M, PRECTOTCORR, RH2M, GWETROOT, GWETTOP, ALLSKY_SFC_SW_DWN, "
                 "T2M_MAX, T2M_MIN, WS2M) refreshed weekly; monthly 2008–2026 normals and history"},
    ]


def ingest(url: str, token: str, table: str, rows: list[dict], chunk: int = 300, log=print):
    """POST rows to the app's token-protected /api/public/ingest route (upsert), in chunks, with retries."""
    import requests
    done = 0
    for k in range(0, len(rows), chunk):
        part = rows[k:k + chunk]
        body = json.dumps({"table": table, "rows": part}, allow_nan=False, separators=(",", ":"))
        for attempt in range(5):
            try:
                r = requests.post(f"{url.rstrip('/')}/api/public/ingest", data=body.encode(),
                                  headers={"Content-Type": "application/json", "x-ingest-token": token}, timeout=120)
            except requests.RequestException as e:
                if attempt == 4:
                    raise
                log(f"  {table}: network error {e}; retrying")
                time.sleep(5 * (attempt + 1))
                continue
            if r.status_code == 200:
                done += int(r.json().get("upserted", len(part)))
                break
            if r.status_code in (401, 400, 503):
                raise RuntimeError(f"ingest {table} failed with {r.status_code}: {r.text[:300]}")
            if attempt == 4:
                raise RuntimeError(f"ingest {table} failed with {r.status_code}: {r.text[:300]}")
            time.sleep(5 * (attempt + 1))
    log(f"  {table}: {done} rows")
    return done


def weather_window(today: date | None = None) -> tuple[date, date]:
    """Days to fetch: enough for 6 windows of 4 weeks before a weather date that lags up to ~10 days."""
    today = today or datetime.now(timezone.utc).date()
    return today - timedelta(days=WINDOW * N_WINDOWS + 14), today
