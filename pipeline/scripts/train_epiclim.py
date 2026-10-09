"""All-India climate-informed outbreak model (IDSP outbreaks via EpiClim, NASA POWER climate).

Rolling-origin test: for each test year Y in 2015..2022, train on target years < Y-1, early-stop on Y-1, test on Y.
Variants (pipeline/india_monthly.VARIANTS) separate what climate adds from what outbreak history adds.
Final models: trained on every year 2009..2022 with the median best iteration, isotonic-calibrated on the
pooled out-of-fold predictions. Writes out/epiclim/*.
"""
import json
import sys
import time
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_monthly import (CAL, CLIM, DISEASES, HORIZONS, REC, STAT, VARIANTS, climate_table,  # noqa: E402
                                    history_features, mi, outbreak_grid, target_normals)

OUT = ROOT / "out/epiclim"
OUT.mkdir(parents=True, exist_ok=True)
TEST_YEARS = list(range(2015, 2023))
LABEL_LO, LABEL_HI = 200901, 202212
PARAMS = dict(objective="binary", learning_rate=0.05, num_leaves=15, min_data_in_leaf=150, feature_fraction=0.8,
              bagging_fraction=0.8, bagging_freq=1, lambda_l2=5.0, verbose=-1, seed=7, num_threads=2)


def load():
    ev = pd.read_parquet(ROOT / "data/epiclim/events.parquet")
    dist = pd.read_parquet(ROOT / "data/india_wx/districts_db.parquet").rename(columns={"id": "district_id"})
    dist = dist.sort_values("district_id").reset_index(drop=True)
    dist["log_density"] = np.log1p(dist["pop"] / dist["area"].clip(lower=1))
    mon = pd.read_parquet(ROOT / "data/india_wx/monthly.parquet")
    return ev, dist, mon


def build_rows(dist, clim, tnorm, grid, m_lo, h, issue_lo, issue_hi, static_upto_year=None):
    """All (district, issue month) rows with issue month in [issue_lo, issue_hi] (month indices)."""
    nd = len(dist)
    issues = np.arange(issue_lo, issue_hi + 1)
    d_idx = np.repeat(np.arange(nd), len(issues))
    issue_m = np.tile(issues, nd)
    tgt_m = issue_m + h
    base = pd.DataFrame({"district_id": dist.district_id.values[d_idx], "m": issue_m, "tgt_m": tgt_m,
                         "d_idx": d_idx})
    base["tgt_cal"] = tgt_m % 12 + 1
    base = base.merge(clim, on=["district_id", "m"], how="left")
    base = base.merge(tnorm, on=["district_id", "tgt_cal"], how="left")
    base["log_density"] = dist.log_density.values[base.d_idx.values]
    hist = {}
    for dis in DISEASES:
        su = None if static_upto_year is None else np.full(len(base), static_upto_year)
        hf = history_features(grid, dis, dist, m_lo, base.m.values, base.tgt_m.values, base.d_idx.values,
                              static_upto_year=su)
        y = np.full(len(base), np.nan)
        col = base.tgt_m.values - m_lo
        ok = (col >= 0) & (col < grid[dis].shape[1])
        y[ok] = (grid[dis][base.d_idx.values[ok], col[ok]] > 0).astype(float)
        hf["y"] = y
        hist[dis] = hf
    return base, hist


def metrics(y, p, top=0.10):
    y = np.asarray(y)
    p = np.asarray(p)
    if y.sum() == 0 or y.sum() == len(y):
        return None
    k = max(1, int(round(top * len(p))))
    order = np.argsort(-p)
    rec_top = y[order[:k]].sum() / y.sum()
    return dict(pr_auc=float(average_precision_score(y, p)), roc_auc=float(roc_auc_score(y, p)),
                brier=float(brier_score_loss(y, np.clip(p, 0, 1))), base_rate=float(y.mean()),
                recall_top10=float(rec_top), n=int(len(y)), positives=int(y.sum()))


def fit(Xtr, ytr, Xva, yva, rounds=None):
    dtr = lgb.Dataset(Xtr, ytr, free_raw_data=False)
    if rounds is not None:
        return lgb.train(PARAMS, dtr, num_boost_round=int(rounds)), int(rounds)
    dva = lgb.Dataset(Xva, yva, reference=dtr)
    m = lgb.train(PARAMS, dtr, num_boost_round=1500, valid_sets=[dva],
                  callbacks=[lgb.early_stopping(60, verbose=False)])
    return m, int(max(20, m.best_iteration))


def main():
    t0 = time.time()
    ev, dist, mon = load()
    clim, nrm = climate_table(mon)
    tnorm = target_normals(nrm)
    m_lo = int(mi(200801))
    m_hi = int(mi(LABEL_HI))
    grid = outbreak_grid(ev, dist, m_lo, m_hi)
    results, oof_all, models = [], [], {}
    for h in HORIZONS:
        issue_lo = int(mi(LABEL_LO)) - h
        issue_hi = int(mi(LABEL_HI)) - h
        base, hist = build_rows(dist, clim, tnorm, grid, m_lo, h, issue_lo, issue_hi)
        tgt_year = base.tgt_m.values // 12
        for dis in DISEASES:
            X_all = pd.concat([base, hist[dis].drop(columns=["y"])], axis=1)
            y_all = hist[dis]["y"].values
            ok = ~np.isnan(y_all) & ~np.isnan(X_all["t0"].values)
            for vname, feats in VARIANTS.items():
                if h == 3 and vname not in ("climate+history", "history only"):
                    continue
                X = X_all[feats]
                preds = np.full(len(y_all), np.nan)
                iters = []
                for Y in TEST_YEARS:
                    tr = ok & (tgt_year < Y - 1)
                    va = ok & (tgt_year == Y - 1)
                    te = ok & (tgt_year == Y)
                    mdl, it = fit(X[tr], y_all[tr], X[va], y_all[va])
                    iters.append(it)
                    preds[te] = mdl.predict(X[te], num_iteration=it)
                    r = metrics(y_all[te], preds[te])
                    if r:
                        results.append(dict(disease=dis, h=h, variant=vname, year=Y, best_iter=it, **r))
                # baselines on the same test rows
                tem = ok & (tgt_year >= TEST_YEARS[0])
                if vname == "climate+history":
                    for Y in TEST_YEARS:
                        te = ok & (tgt_year == Y)
                        for bname, score in (("seasonal history (baseline)", X_all["st_m3_rate"].values),
                                             ("recent outbreaks (persistence)", X_all["rc_3"].values)):
                            s = np.nan_to_num(score[te], nan=0.0)
                            r = metrics(y_all[te], s + 1e-9 * np.random.RandomState(0).rand(te.sum()))
                            if r:
                                results.append(dict(disease=dis, h=h, variant=bname, year=Y, best_iter=0, **r))
                oof = pd.DataFrame({"district_id": base.district_id.values[tem], "issue_m": base.m.values[tem],
                                    "tgt_m": base.tgt_m.values[tem], "y": y_all[tem], "p": preds[tem]})
                oof["disease"], oof["h"], oof["variant"] = dis, h, vname
                oof_all.append(oof)
                # final model for the variants we deploy
                if vname in ("climate+history", "history only", "climate+history+recent reports"):
                    rounds = int(np.median(iters))
                    fin = ok & (tgt_year <= 2022)
                    mdl, _ = fit(X[fin], y_all[fin], None, None, rounds=rounds)
                    iso = IsotonicRegression(y_min=0.0005, y_max=0.95, out_of_bounds="clip")
                    iso.fit(preds[tem], y_all[tem])
                    models[f"{dis}|{h}|{vname}"] = dict(model=mdl, iso=iso, feats=feats, rounds=rounds)
                print(f"h{h} {dis:12s} {vname:32s} done  {time.time()-t0:6.0f}s", flush=True)
    res = pd.DataFrame(results)
    res.to_csv(OUT / "rolling_results.csv", index=False)
    pd.concat(oof_all).to_parquet(OUT / "oof.parquet", index=False)
    joblib.dump(models, OUT / "models.joblib")
    summ = (res.groupby(["disease", "h", "variant"])[["pr_auc", "roc_auc", "recall_top10", "base_rate", "brier"]]
            .mean().round(3).reset_index())
    summ.to_csv(OUT / "summary.csv", index=False)
    with pd.option_context("display.width", 200, "display.max_rows", 500):
        print(summ.to_string())
    print(f"total {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
