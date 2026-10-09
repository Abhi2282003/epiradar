"""Live all-India district forecast from the trained EpiClim models.

Issue month = last complete month of NASA POWER weather (September 2026 here: July-August from the monthly
endpoint, September aggregated from the daily endpoint). Targets: the next 1-3 months.
Writes out/epiclim/forecast.parquet and out/epiclim/tiers.json.
"""
import json
import sys
from pathlib import Path

import joblib
from sklearn.linear_model import LogisticRegression
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_monthly import (DISEASES, FAMILY, HORIZONS, climate_table, history_features, mi,  # noqa: E402
                                    outbreak_grid, target_normals, ym_of)

OUT = ROOT / "out/epiclim"
CLIMATE_FAMILIES = {"rain", "rain_anom", "temp", "temp_anom", "humidity", "aedes", "anopheles", "season"}
# risk levels = share of district-months in the 2015-2022 back-test (pooled out-of-fold predictions)
TIER_SHARES = {"very_high": 0.02, "high": 0.05, "moderate": 0.13}

def logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def platt(oof_raw, oof_y):
    lr = LogisticRegression(C=1e6, max_iter=1000).fit(logit(oof_raw).reshape(-1, 1), oof_y)
    return lambda raw: lr.predict_proba(logit(raw).reshape(-1, 1))[:, 1]


def main():
    models = joblib.load(OUT / "models.joblib")
    ev = pd.read_parquet(ROOT / "data/epiclim/events.parquet")
    dist = pd.read_parquet(ROOT / "data/india_wx/districts_db.parquet").rename(columns={"id": "district_id"})
    dist = dist.sort_values("district_id").reset_index(drop=True)
    dist["log_density"] = np.log1p(dist["pop"] / dist["area"].clip(lower=1))
    mon = pd.read_parquet(ROOT / "data/india_wx/monthly.parquet")
    rec = pd.read_parquet(ROOT / "data/india_wx/recent_monthly_from_daily.parquet")
    # September 2026 is not in the monthly endpoint yet: take it from the daily endpoint (all 30 days present)
    sep = rec[(rec.ym == 202609) & (rec.n >= 28)][["district_id", "ym", "t2m", "rain_md", "rh"]]
    mon = pd.concat([mon[mon.ym != 202609], sep]).sort_values(["district_id", "ym"])
    mon = mon[mon.ym <= 202609]
    issue_ym = 202609
    issue_m = int(mi(issue_ym))

    clim, nrm = climate_table(mon)
    tnorm = target_normals(nrm)
    m_lo = int(mi(200801))
    grid = outbreak_grid(ev, dist, m_lo, int(mi(202212)))
    nd = len(dist)
    rows = []
    oof = pd.read_parquet(OUT / "oof.parquet")
    tiers = {}
    for h in HORIZONS:
        base = pd.DataFrame({"district_id": dist.district_id, "m": issue_m, "tgt_m": issue_m + h, "d_idx": np.arange(nd)})
        base["tgt_cal"] = (issue_m + h) % 12 + 1
        base = base.merge(clim, on=["district_id", "m"], how="left").merge(tnorm, on=["district_id", "tgt_cal"], how="left")
        base["log_density"] = dist.log_density.values
        for dis in DISEASES:
            hf = history_features(grid, dis, dist, m_lo, base.m.values, base.tgt_m.values, base.d_idx.values,
                                  static_upto_year=np.full(nd, 2023))
            X = pd.concat([base, hf], axis=1)
            mm = models[f"{dis}|{h}|climate+history"]
            m0 = models[f"{dis}|{h}|history only"]
            oo = oof[(oof.disease == dis) & (oof.h == h)]
            o = oo[oo.variant == "climate+history"]
            o0 = oo[oo.variant == "history only"]
            cal, cal0 = platt(o.p.values, o.y.values), platt(o0.p.values, o0.y.values)
            raw = mm["model"].predict(X[mm["feats"]])
            p = cal(raw)
            p0 = cal0(m0["model"].predict(X[m0["feats"]]))
            contrib = mm["model"].predict(X[mm["feats"]], pred_contrib=True)[:, :-1]
            fams = [FAMILY[f] for f in mm["feats"]]
            fam_names = sorted(set(fams))
            F = np.zeros((nd, len(fam_names)))
            for j, f in enumerate(fams):
                F[:, fam_names.index(f)] += contrib[:, j]
            # tiers from the pooled out-of-fold calibrated predictions of the same model
            po = cal(o.p.values)
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
            # comparison point: the all-India average chance for this disease and month
            typical = np.full(nd, float(p.mean()))
            A = grid[dis] > 0
            tcal = (issue_m + h) % 12
            yrs = range(2009, 2023)
            for i, d in enumerate(dist.district_id):
                order = np.argsort(-F[i])
                drivers = []
                for k in order[:6]:
                    fam = fam_names[k]
                    if abs(F[i, k]) < 0.02:
                        continue
                    drivers.append((fam, float(F[i, k])))
                # always surface the strongest climate family as well
                clim_idx = [k for k in np.argsort(-np.abs(F[i])) if fam_names[k] in CLIMATE_FAMILIES]
                if clim_idx and fam_names[clim_idx[0]] not in [x[0] for x in drivers]:
                    drivers.append((fam_names[clim_idx[0]], float(F[i, clim_idx[0]])))
                drivers = sorted(drivers, key=lambda x: -abs(x[1]))[:4]
                xi = X.iloc[i]
                n3 = (nrm[(nrm.district_id == d)].set_index("cal").r_n)
                cal_last = issue_ym % 100
                r3n = sum(n3.get(((cal_last - 1 - k) % 12) + 1, np.nan) for k in range(3)) / 3
                hist_k = 0
                for y in yrs:
                    cols = [y * 12 + tcal + k - m_lo for k in (-1, 0, 1)]
                    if any(0 <= c < A.shape[1] and A[i, c] for c in cols):
                        hist_k += 1
                vals = dict(issue_cal=cal_last, tgt_cal=tcal + 1, rain3m_pct=float((xi.r3m / r3n - 1) * 100) if r3n > 0 else 0.0,
                            rain_last_mm=float(xi.r0 * 30), rain3m_mm=float(xi.r3m * 91), t_last=float(xi.t0),
                            t_anom=float(xi.ta3m), rh_last=float(xi.rh0), aed_last=float(xi.aed0), ano_last=float(xi.ano0),
                            tgt_rain_mm=float(xi.tgt_r_n * 30), tgt_t=float(xi.tgt_t_n), hist_k=hist_k, hist_n=len(yrs),
                            any_per_year=float(xi.st_any_rate) if not np.isnan(xi.st_any_rate) else 0.0,
                            density=float(np.expm1(xi.log_density)) if not np.isnan(xi.log_density) else 0.0)
                drv = [dict(f=f, w=round(w, 3)) for f, w in drivers]
                inputs = dict(r3=round(vals["rain3m_mm"]), rp=round(vals["rain3m_pct"]), rl=round(vals["rain_last_mm"]),
                              t=round(vals["t_last"], 1), ta=round(vals["t_anom"], 2), rh=round(vals["rh_last"]),
                              ae=round(vals["aed_last"], 2), an=round(vals["ano_last"], 2), nr=round(vals["tgt_rain_mm"]),
                              nt=round(vals["tgt_t"], 1), hk=hist_k, hn=len(yrs), ay=round(vals["any_per_year"], 1),
                              dn=round(vals["density"]), im=vals["issue_cal"], tm=vals["tgt_cal"])
                rows.append(dict(district_id=d, disease_id=dis, horizon=h, issue_month=f"{issue_ym // 100}-{issue_ym % 100:02d}-01",
                                 target_month=f"{ym_of(issue_m + h) // 100}-{ym_of(issue_m + h) % 100:02d}-01",
                                 prob=float(p[i]), prob_no_climate=float(p0[i]),
                                 typical_prob=float(typical[i]), raw=float(raw[i]),
                                 risk_level=lvl(p[i]), drivers=drv, inputs=inputs))
    fc = pd.DataFrame(rows)
    fc["rank_india"] = fc.groupby(["disease_id", "horizon"]).raw.rank(ascending=False, method="first").astype(int)
    fc.to_parquet(OUT / "forecast.parquet", index=False)
    json.dump(tiers, open(OUT / "tiers.json", "w"), indent=1)
    print(fc.groupby(["disease_id", "horizon", "risk_level"]).size().unstack().fillna(0).astype(int))
    print(fc.sort_values("prob", ascending=False).groupby(["disease_id", "horizon"]).head(3)[
        ["disease_id", "horizon", "district_id", "prob", "prob_no_climate", "risk_level"]].to_string())


if __name__ == "__main__":
    main()
