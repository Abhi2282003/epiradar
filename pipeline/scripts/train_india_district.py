"""Karnataka weekly dengue surge model (ICTS weekly district counts + NASA POWER daily weather).

Target: the 4-week case total over weeks t+h-2 .. t+h+1 is at or above the district's 75th percentile of 4-week
totals (computed from years before the test year only) and at least 4 cases.
Rolling origin: for Y in 2021..2024 train on target years <= Y-2, early-stop on Y-1, test on Y.
Variants: cases+climate, cases only, climate only; baselines: seasonal and persistence.
Writes out/india_model/karnataka_results.json and karnataka_oof.parquet.
"""
import json
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_district import HORIZONS, climate_features, monthly_normals_from_daily, target_season_features, week_normals, weekly_weather  # noqa: E402

OUT = ROOT / "out/india_model"
OUT.mkdir(parents=True, exist_ok=True)
TEST_YEARS = [2021, 2022, 2023, 2024]
PARAMS = dict(objective="binary", learning_rate=0.03, num_leaves=15, min_data_in_leaf=40, feature_fraction=0.8,
              bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, verbose=-1, seed=7, num_threads=2)
CASE = ["lc0", "lc1", "lc_mean_1_4", "lc_mean_5_8", "growth", "lc_max_1_8", "rel4", "lthr"]
TGT = ["tgt_rain_n", "tgt_t_n", "tgt_rh_n", "tgt_sa_n"]


def main():
    cases = pd.read_parquet(ROOT / "data/india_ka/ka_weekly_dengue.parquet").rename(columns={"district": "key"})
    cases = cases[cases.key != "VIJAYANAGAR"]
    daily = pd.read_parquet(ROOT / "data/india_ka/ka_daily_weather.parquet")
    daily = daily[daily.key.isin(cases.key.unique())]
    # complete weekly grid
    weeks = pd.date_range(cases.week.min() - pd.Timedelta(weeks=16), "2024-12-30", freq="W-MON")
    grid = pd.MultiIndex.from_product([sorted(cases.key.unique()), weeks], names=["key", "week"]).to_frame(index=False)
    w = grid.merge(weekly_weather(daily), on=["key", "week"], how="left")
    nrm = monthly_normals_from_daily(daily, range(2017, 2023))
    w = w.merge(week_normals(w, nrm), on=["key", "week"], how="left")
    clim = climate_features(w)
    CLIM = [c for c in clim.columns if c not in ("key", "week")]
    df = grid.merge(cases[["key", "week", "cases"]], on=["key", "week"], how="left")
    first = cases.groupby("key").week.min()
    df = df[df.week >= df.key.map(first)].copy()           # weeks before a district's first report are unknown
    df["cases"] = df.cases.fillna(0)
    df = df.sort_values(["key", "week"]).reset_index(drop=True)
    g = df.groupby("key", sort=False)
    df["lc"] = np.log1p(df.cases)
    df["lc0"] = df.lc
    df["lc1"] = g.lc.shift(1)
    df["lc_mean_1_4"] = g.lc.transform(lambda s: s.rolling(4, min_periods=3).mean())
    df["lc_mean_5_8"] = g.lc.transform(lambda s: s.shift(4).rolling(4, min_periods=3).mean())
    df["growth"] = df.lc_mean_1_4 - df.lc_mean_5_8
    df["lc_max_1_8"] = g.lc.transform(lambda s: s.rolling(8, min_periods=6).max())
    df["c4"] = g.cases.transform(lambda s: s.rolling(4, min_periods=4).sum())
    df = df.merge(clim, on=["key", "week"], how="left")
    last_week = cases.week.max()
    results, oofs = [], []
    for h in HORIZONS:
        d = df.copy()
        d = d.merge(target_season_features(w, h), on=["key", "week"], how="left")
        gg = d.groupby("key", sort=False)
        d["tot"] = gg.c4.shift(-(h + 1))                      # sum of weeks t+h-2 .. t+h+1
        d["tweek"] = d.week + pd.Timedelta(weeks=h + 1)       # last week of the target window
        d = d[d.tweek <= last_week]
        d["tyear"] = d.tweek.dt.year
        variants = {"cases+climate": CASE + CLIM + TGT, "cases only": CASE, "climate only": CLIM + TGT}
        for Y in TEST_YEARS:
            thr = d[d.tyear < Y].groupby("key").tot.quantile(0.75)
            y = ((d.tot >= d.key.map(thr)) & (d.tot >= 4)).astype(float).where(d.tot.notna())
            ok = y.notna().values
            tr = ok & (d.tyear <= Y - 2).values
            va = ok & (d.tyear == Y - 1).values
            te = ok & (d.tyear == Y).values
            yy = y.values
            # seasonal baseline: share of earlier years above threshold in the same calendar weeks (+-2)
            woy = d.tweek.dt.isocalendar().week.astype(int).values
            past = pd.DataFrame({"key": d.key.values, "woy": woy, "y": yy, "tyear": d.tyear.values})[tr | va]
            seas = {}
            for (k, wk), gp in past.groupby(["key", "woy"]):
                seas[(k, wk)] = gp.y.mean()
            sb = np.array([np.nanmean([seas.get((k, ((wk + o - 1) % 52) + 1), np.nan) for o in (-2, -1, 0, 1, 2)])
                           for k, wk in zip(d.key.values[te], woy[te])])
            # the district's own alert line, known before the test year: current 4-week total relative to it
            d["rel4"] = d.c4 / d.key.map(thr).clip(lower=1)
            d["lthr"] = np.log1p(d.key.map(thr))
            pers = d.rel4.values[te]
            for name, s in (("seasonal baseline", sb), ("persistence", pers)):
                s = np.nan_to_num(s, nan=0.0)
                results.append(dict(h=h, variant=name, year=Y, pr_auc=average_precision_score(yy[te], s),
                                    roc_auc=roc_auc_score(yy[te], s), base_rate=float(yy[te].mean()), n=int(te.sum())))
            for vname, feats in variants.items():
                X = d[feats]
                dtr = lgb.Dataset(X[tr], yy[tr])
                dva = lgb.Dataset(X[va], yy[va], reference=dtr)
                m = lgb.train(PARAMS, dtr, 2000, valid_sets=[dva], callbacks=[lgb.early_stopping(80, verbose=False)])
                p = m.predict(X[te], num_iteration=m.best_iteration)
                results.append(dict(h=h, variant=vname, year=Y, pr_auc=average_precision_score(yy[te], p),
                                    roc_auc=roc_auc_score(yy[te], p), base_rate=float(yy[te].mean()), n=int(te.sum()),
                                    best_iter=int(m.best_iteration)))
                oofs.append(pd.DataFrame({"key": d.key.values[te], "week": d.week.values[te], "h": h, "variant": vname,
                                          "year": Y, "y": yy[te], "p": p}))
            print(h, Y, "done", flush=True)
    res = pd.DataFrame(results)
    summ = res.groupby(["h", "variant"])[["pr_auc", "roc_auc", "base_rate"]].mean().round(3).reset_index()
    print(summ.to_string())
    pd.concat(oofs).to_parquet(OUT / "karnataka_oof.parquet", index=False)
    json.dump({"per_year": res.round(4).to_dict(orient="records"), "summary": summ.to_dict(orient="records"),
               "districts": int(cases.key.nunique()), "weeks": [str(cases.week.min().date()), str(cases.week.max().date())],
               "cases": int(cases.cases.sum()), "test_years": TEST_YEARS,
               "target": "4-week case total over weeks t+h-2..t+h+1 >= district 75th percentile of earlier years and >= 4 cases"},
              open(OUT / "karnataka_results.json", "w"), indent=1)


if __name__ == "__main__":
    main()
