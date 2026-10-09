"""Add the weeks 9-12 'climate only' model (used for blind spots) to out/epiclim2 (models + out-of-fold rows)."""
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import scripts.train_epiclim as T  # noqa: E402
from pipeline.india_monthly import DISEASES, VARIANTS, climate_table, extra_climate_table, mi, mobility_matrix, outbreak_grid, target_normals  # noqa: E402

ev, dist, mon, mon2 = T.load()
clim, nrm = climate_table(mon)
tnorm = target_normals(nrm)
sat = extra_climate_table(mon2)
W, _ = mobility_matrix(dist)
m_lo, m_hi = int(mi(200801)), int(mi(T.LABEL_HI))
grid = outbreak_grid(ev, dist, m_lo, m_hi)
h, v = 3, "climate only"
base, hist = T.build_rows(dist, clim, tnorm, grid, m_lo, h, int(mi(T.LABEL_LO)) - h, int(mi(T.LABEL_HI)) - h, sat=sat, W=W)
ty = base.tgt_m.values // 12
models = joblib.load(T.OUT / "models.joblib")
oof = pd.read_parquet(T.OUT / "oof.parquet")
new = []
for dis in DISEASES:
    X_all = pd.concat([base, hist[dis].drop(columns=["y"])], axis=1)
    y = hist[dis]["y"].values
    ok = ~np.isnan(y) & ~np.isnan(X_all["t0"].values)
    X = X_all[VARIANTS[v]]
    p = np.full(len(y), np.nan)
    iters = []
    for Y in T.TEST_YEARS:
        tr, va, te = ok & (ty < Y - 1), ok & (ty == Y - 1), ok & (ty == Y)
        m, it = T.fit(X[tr], y[tr], X[va], y[va])
        iters.append(it)
        p[te] = m.predict(X[te], num_iteration=it)
    tem = ok & (ty >= T.TEST_YEARS[0])
    o = pd.DataFrame({"district_id": base.district_id.values[tem], "issue_m": base.m.values[tem], "tgt_m": base.tgt_m.values[tem],
                      "y": y[tem], "p": p[tem], "st_rate": X_all["st_rate"].values[tem]})
    o["disease"], o["h"], o["variant"] = dis, h, v
    new.append(o)
    m, _ = T.fit(X[ok & (ty <= 2022)], y[ok & (ty <= 2022)], None, None, rounds=int(np.median(iters)))
    models[f"{dis}|{h}|{v}"] = dict(model=m, feats=VARIANTS[v], rounds=int(np.median(iters)))
    print(dis, "done", flush=True)
oof = pd.concat([oof[~((oof.h == h) & (oof.variant == v))]] + new, ignore_index=True)
oof.to_parquet(T.OUT / "oof.parquet", index=False)
joblib.dump(models, T.OUT / "models.joblib")
