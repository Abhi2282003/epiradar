"""Quick experiments for the all-India model: feature sets and parameters (1 month ahead).

Prints pooled out-of-fold PR-AUC / ROC-AUC / top-10% recall for test years 2015-2022.
"""
import sys
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import scripts.train_epiclim as T  # noqa: E402
from pipeline.india_monthly import CAL, CLIM, STAT, climate_table, mi, outbreak_grid, target_normals  # noqa: E402

CLIM_C = ["ra3m", "ra0", "ra6m", "r0", "r3m", "t0", "t3m", "ta3m", "rh0", "rh3m", "aed0", "aed3m", "ano0", "ano3m",
          "tgt_r_n", "tgt_t_n", "tgt_rh_n", "tgt_aed_n", "tgt_ano_n"]
SETS = {
    "hist": CAL + STAT,
    "clim_full+hist": CLIM + CAL + STAT,
    "clim_compact+hist": CLIM_C + CAL + STAT,
    "clim_compact": CLIM_C,
}
P1 = dict(T.PARAMS)
P2 = dict(T.PARAMS, num_leaves=7, min_data_in_leaf=300, feature_fraction=0.6, learning_rate=0.03, lambda_l2=10.0)


def run(X, y, ok, ty, params, years=range(2015, 2023)):
    p = np.full(len(y), np.nan)
    for Y in years:
        tr, va, te = ok & (ty < Y - 1), ok & (ty == Y - 1), ok & (ty == Y)
        dtr = lgb.Dataset(X[tr], y[tr])
        dva = lgb.Dataset(X[va], y[va], reference=dtr)
        m = lgb.train(params, dtr, 2000, valid_sets=[dva], callbacks=[lgb.early_stopping(100, verbose=False)])
        p[te] = m.predict(X[te], num_iteration=m.best_iteration)
    sel = ok & (ty >= min(years))
    yy, pp = y[sel], p[sel]
    k = int(0.1 * len(pp))
    top = yy[np.argsort(-pp)[:k]].sum() / yy.sum()
    per = [roc_auc_score(y[ok & (ty == Y)], p[ok & (ty == Y)]) for Y in years]
    return average_precision_score(yy, pp), roc_auc_score(yy, pp), top, np.mean(per)


def main():
    diseases = sys.argv[1].split(",") if len(sys.argv) > 1 else ["dengue", "diarrhoea"]
    t0 = time.time()
    ev, dist, mon = T.load()
    clim, nrm = climate_table(mon)
    tnorm = target_normals(nrm)
    m_lo, m_hi = int(mi(200801)), int(mi(202212))
    grid = outbreak_grid(ev, dist, m_lo, m_hi)
    h = 1
    base, hist = T.build_rows(dist, clim, tnorm, grid, m_lo, h, int(mi(200901)) - h, int(mi(202212)) - h)
    ty = base.tgt_m.values // 12
    for dis in diseases:
        Xa = pd.concat([base, hist[dis].drop(columns=["y"])], axis=1)
        y = hist[dis]["y"].values
        ok = ~np.isnan(y) & ~np.isnan(Xa.t0.values)
        s = np.nan_to_num(Xa.st_m3_rate.values)
        sel = ok & (ty >= 2015)
        print(f"{dis}: base rate {y[sel].mean():.4f}, positives {int(y[sel].sum())}; seasonal baseline PR {average_precision_score(y[sel], s[sel]):.3f} ROC {roc_auc_score(y[sel], s[sel]):.3f}", flush=True)
        for pname, params in (("P1", P1), ("P2", P2)):
            for name, feats in SETS.items():
                pr, roc, top, per = run(Xa[feats], y, ok, ty, params)
                print(f"  {pname} {name:20s} PR {pr:.3f}  ROC {roc:.3f}  top10 {top:.3f}  mean-year ROC {per:.3f}   {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
