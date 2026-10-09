"""Weekly-issued all-India district forecast (india-epiclim-v2).

Issue date D = the latest day with NASA POWER weather for (almost) every district. The weather before D is cut into
28-day windows (window 0 = the last 4 weeks, window 1 = weeks 5-8 back, ...), and the forecast covers
weeks 1-4, 5-8 and 9-12 after D. The models were trained on calendar months (4-4.4 weeks), so each window plays
the role of one month; normals are those of the calendar month containing the window's midpoint.

Per district, disease and horizon it writes:
  prob (all signals), prob_no_climate (history + mobility, no weather/satellite), prob_climate_only (no surveillance),
  silent (climate-only risk in the top 7% while the district never reported this disease 2009-2022),
  risk_level, SHAP drivers, compact inputs, and a what-if grid (rain x temperature) of the all-signal model.
Outputs: out/epiclim2/forecast.parquet, tiers.json, links.parquet, signals.json
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_monthly import (DISEASES, FAMILY, HORIZONS, NORMAL_YEARS, aedes_t, anoph_t, climate_table,  # noqa: E402
                                    extra_climate_table, history_features, mi, mobility_features, mobility_matrix,
                                    moisture, outbreak_grid, target_normals)

OUT = ROOT / "out/epiclim2"
WINDOW = 28
TIER_SHARES = {"very_high": 0.02, "high": 0.05, "moderate": 0.13}
RAIN_X = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
TEMP_D = [-1.0, 0.0, 1.0, 2.0]
CLIMATE_FAMILIES = {"rain", "rain_anom", "temp", "temp_anom", "humidity", "aedes", "anopheles", "season", "water",
                    "sunlight", "heat", "wind"}
SIGNAL = {"rain": "weather", "rain_anom": "weather", "temp": "weather", "temp_anom": "weather", "humidity": "weather",
          "heat": "weather", "wind": "weather", "water": "water", "sunlight": "satellite", "aedes": "vector",
          "anopheles": "vector", "season": "season", "mobility": "mobility", "history": "surveillance",
          "surveillance": "surveillance", "population": "population", "recent": "surveillance"}


def logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def platt(raw, y):
    lr = LogisticRegression(C=1e6, max_iter=1000).fit(logit(raw).reshape(-1, 1), y)
    return lambda r: lr.predict_proba(logit(r).reshape(-1, 1))[:, 1]


def load_daily():
    d = pd.read_parquet(ROOT / "data/india_wx/daily_2026.parquet")
    d["day"] = pd.to_datetime(d.day)
    return d


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
    for k in range(6):
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
    f["r6m"] = sum(r[k] for k in range(6)) / 6
    f["ra6m"] = np.log((f.r6m + 0.5) / (sum(rn[k] for k in range(6)) / 6 + 0.5))
    # satellite / water / heat / wind of window 0
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


def main():
    models = joblib.load(OUT / "models.joblib")
    oof = pd.read_parquet(OUT / "oof.parquet")
    ev = pd.read_parquet(ROOT / "data/epiclim/events.parquet")
    dist = pd.read_parquet(ROOT / "data/india_wx/districts_db.parquet").rename(columns={"id": "district_id"})
    dist = dist.sort_values("district_id").reset_index(drop=True)
    dist["log_density"] = np.log1p(dist["pop"] / dist["area"].clip(lower=1))
    mon = pd.read_parquet(ROOT / "data/india_wx/monthly.parquet")
    mon2 = pd.read_parquet(ROOT / "data/india_wx/monthly2.parquet")
    _, nrm = climate_table(mon)
    tnorm = target_normals(nrm)
    yr = mon2.ym // 100
    m2 = mon2[(yr >= NORMAL_YEARS[0]) & (yr <= NORMAL_YEARS[1])].copy()
    m2["cal"] = m2.ym % 100
    nrm2 = m2.groupby(["district_id", "cal"]).agg(gw_n=("gw_root", "mean"), sol_n=("solar", "mean"), tx_n=("tmax", "mean")).reset_index()
    daily = load_daily()
    have = daily.dropna(subset=["t2m", "rain"]).groupby("day").district_id.nunique()
    D = have[have >= 0.98 * len(dist)].index.max()
    print("issue date", D.date())
    W, Dkm = mobility_matrix(dist)
    m_lo = int(mi(200801))
    grid = outbreak_grid(ev, dist, m_lo, int(mi(202212)))
    nd = len(dist)
    base_clim = live_features(dist, nrm, nrm2, daily, D)
    scen = {(i, j): live_features(dist, nrm, nrm2, daily, D, rx, td) for i, td in enumerate(TEMP_D) for j, rx in enumerate(RAIN_X)}
    rows, tiers, signals = [], {}, {}
    for h in HORIZONS:
        start = D + pd.Timedelta(days=1 + WINDOW * (h - 1))
        mid = start + pd.Timedelta(days=WINDOW / 2)
        tgt_m = int(mi(mid.year * 100 + mid.month))
        issue_m = tgt_m - h
        X0 = pd.DataFrame({"district_id": dist.district_id, "m": issue_m, "tgt_m": tgt_m, "d_idx": np.arange(nd)})
        X0["tgt_cal"] = mid.month
        X0 = X0.merge(tnorm, on=["district_id", "tgt_cal"], how="left")
        X0["log_density"] = dist.log_density.values
        for dis in DISEASES:
            hf = history_features(grid, dis, dist, m_lo, X0.m.values, X0.tgt_m.values, X0.d_idx.values,
                                  static_upto_year=np.full(nd, 2023))
            hf = pd.concat([hf, mobility_features(W, hf, nd)], axis=1)
            Xh = pd.concat([X0, hf], axis=1)
            X = pd.concat([Xh, base_clim.drop(columns=["district_id"])], axis=1)
            oo = oof[(oof.disease == dis) & (oof.h == h)]
            cal = {v: platt(oo[oo.variant == v].p.values, oo[oo.variant == v].y.values)
                   for v in ("full", "history+mobility", "climate only") if (oo.variant == v).any()}
            mm, m0, mc = (models[f"{dis}|{h}|{v}"] for v in ("full", "history+mobility", "climate only"))
            raw = mm["model"].predict(X[mm["feats"]])
            p = cal["full"](raw)
            p0 = cal["history+mobility"](m0["model"].predict(X[m0["feats"]]))
            pc = cal["climate only"](mc["model"].predict(X[mc["feats"]]))
            # risk levels from the pooled out-of-fold predictions of the all-signal model
            o = oo[oo.variant == "full"]
            po = cal["full"](o.p.values)
            q_vh = np.quantile(po, 1 - TIER_SHARES["very_high"])
            q_h = np.quantile(po, 1 - TIER_SHARES["very_high"] - TIER_SHARES["high"])
            q_m = np.quantile(po, 1 - sum(TIER_SHARES.values()))
            lvl = lambda x: "very_high" if x >= q_vh else "high" if x >= q_h else "moderate" if x >= q_m else "low"  # noqa: E731
            stats = {}
            for name in ("very_high", "high", "moderate", "low"):
                sel = np.array([lvl(x) == name for x in po])
                stats[name] = dict(share=float(sel.mean()), outbreak_rate=float(o.y.values[sel].mean()) if sel.any() else None,
                                   outbreaks_caught=float(o.y.values[sel].sum() / max(1, o.y.sum())))
            tiers[f"{dis}|{h}"] = dict(thresholds=dict(very_high=float(q_vh), high=float(q_h), moderate=float(q_m)),
                                       base_rate=float(o.y.mean()), levels=stats)
            oc = oo[oo.variant == "climate only"]
            q_silent = np.quantile(cal["climate only"](oc.p.values), 0.93)
            silent = (pc >= q_silent) & (hf.st_rate.values == 0)
            # SHAP drivers by family
            contrib = mm["model"].predict(X[mm["feats"]], pred_contrib=True)[:, :-1]
            fams = [FAMILY[f] for f in mm["feats"]]
            names = sorted(set(fams))
            F = np.zeros((nd, len(names)))
            for j, fam in enumerate(fams):
                F[:, names.index(fam)] += contrib[:, j]
            if h == 1:
                tot = np.abs(F).sum(0)
                sig = {}
                for j, fam in enumerate(names):
                    sig[SIGNAL[fam]] = sig.get(SIGNAL[fam], 0.0) + float(tot[j])
                s = sum(sig.values())
                signals[dis] = {k: round(v / s, 4) for k, v in sig.items()}
            # what-if grid
            grid_p = np.zeros((nd, len(TEMP_D), len(RAIN_X)))
            for (i, j), sc in scen.items():
                Xs = pd.concat([Xh, sc.drop(columns=["district_id"])], axis=1)
                grid_p[:, i, j] = cal["full"](mm["model"].predict(Xs[mm["feats"]]))
            A = grid[dis] > 0
            tcal = tgt_m % 12
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
                inputs = dict(r3=round(float(b.r3m * WINDOW * 3)), rp=round(float((b.r3m / r3n - 1) * 100)) if r3n > 0 else 0,
                              rl=round(float(b.r0 * WINDOW)), t=round(float(b.t0), 1), ta=round(float(b.ta3m), 2),
                              rh=round(float(b.rh0)), ae=round(float(b.aed0), 2), an=round(float(b.ano0), 2),
                              nr=round(float(X0.tgt_r_n.iloc[i] * WINDOW)), nt=round(float(X0.tgt_t_n.iloc[i]), 1),
                              hk=hk, hn=14, ay=round(float(np.nan_to_num(hf.st_any_rate.iloc[i])), 1),
                              dn=round(float(np.expm1(dist.log_density.iloc[i]))) if not np.isnan(dist.log_density.iloc[i]) else 0,
                              im=int(b._cal0), tm=int(mid.month),
                              sw=None if np.isnan(b.sw0) else round(float(b.sw0), 2), swa=None if np.isnan(b.swa0) else round(float(b.swa0), 2),
                              sol=None if np.isnan(b.sol0) else round(float(b.sol0), 1), sola=None if np.isnan(b.sola0) else round(float(b.sola0), 1),
                              tx=None if np.isnan(b.tx0) else round(float(b.tx0), 1), ws=None if np.isnan(b.ws0) else round(float(b.ws0), 1),
                              mb=None if np.isnan(hf.mob_m3.iloc[i]) else round(float(hf.mob_m3.iloc[i]), 3))
                rows.append(dict(district_id=d, disease_id=dis, horizon=h, issue_month=str(D.date()), target_month=str(start.date()),
                                 prob=float(p[i]), prob_no_climate=float(p0[i]), prob_climate_only=float(pc[i]), silent=bool(silent[i]),
                                 typical_prob=float(p.mean()), raw=float(raw[i]), risk_level=lvl(p[i]),
                                 drivers=[dict(f=f, w=round(w, 3)) for f, w in drv], inputs=inputs,
                                 scenarios=dict(r=RAIN_X, t=TEMP_D, p=[[round(float(x), 5) for x in row] for row in grid_p[i]])))
            print(h, dis, "high+", int(sum(lvl(x) in ("high", "very_high") for x in p)), "silent", int(silent.sum()), flush=True)
    fc = pd.DataFrame(rows)
    fc["rank_india"] = fc.groupby(["disease_id", "horizon"]).raw.rank(ascending=False, method="first").astype(int)
    fc.to_parquet(OUT / "forecast.parquet", index=False)
    json.dump(tiers, open(OUT / "tiers.json", "w"), indent=1)
    json.dump(signals, open(OUT / "signals.json", "w"), indent=1)
    # strongest travel links for the app (gravity model)
    links = []
    for i, d in enumerate(dist.district_id):
        for rnk, j in enumerate(np.argsort(-W[i])[:6], start=1):
            links.append(dict(district_id=d, to_district_id=dist.district_id.iloc[j], rank=rnk, share=round(float(W[i, j]), 4),
                              distance_km=round(float(Dkm[i, j]), 1)))
    pd.DataFrame(links).to_parquet(OUT / "links.parquet", index=False)
    print(fc.groupby(["disease_id", "horizon"]).risk_level.value_counts().unstack().fillna(0).astype(int))
    print(json.dumps(signals, indent=1))


if __name__ == "__main__":
    main()
