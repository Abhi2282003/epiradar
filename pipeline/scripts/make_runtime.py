"""Build the portable weekly-run bundle for india-epiclim-v2 (run once after training).

Reads out/epiclim2/{models.joblib, oof.parquet, model_card.json} and the static inputs, and writes
runtime/india-epiclim-v2/ (see pipeline/india_weekly.py). Calibration, risk thresholds and blind-spot thresholds are
fitted exactly as in scripts/forecast_epiclim2.py (Platt scaling on the out-of-fold predictions, out-of-fold
quantiles), so the weekly run reproduces the research forecast.
Usage: python scripts/make_runtime.py [out_dir]
"""
import gzip
import json
import shutil
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_monthly import DISEASES, HORIZONS, NORMAL_YEARS, climate_table, target_normals  # noqa: E402
from pipeline.india_weekly import VARIANTS, VERSION, logit  # noqa: E402

SRC = ROOT / "out/epiclim2"
TIER_SHARES = {"very_high": 0.02, "high": 0.05, "moderate": 0.13}


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "runtime" / VERSION
    if out.exists():
        shutil.rmtree(out)
    (out / "models").mkdir(parents=True)
    models = joblib.load(SRC / "models.joblib")
    oof = pd.read_parquet(SRC / "oof.parquet")
    meta = {"model_version": VERSION, "models": {}, "tiers": {}, "silent": {}}
    for dis in DISEASES:
        for h in HORIZONS:
            oo = oof[(oof.disease == dis) & (oof.h == h)]
            for v in VARIANTS:
                key = f"{dis}|{h}|{v}"
                o = oo[oo.variant == v]
                lr = LogisticRegression(C=1e6, max_iter=1000).fit(logit(o.p.values).reshape(-1, 1), o.y.values)
                a, b = float(lr.coef_[0, 0]), float(lr.intercept_[0])
                m = models[key]
                fn = out / "models" / f"{key.replace('|', '__').replace(' ', '_')}.txt.gz"
                with gzip.open(fn, "wt", compresslevel=9) as f:
                    f.write(m["model"].model_to_string())
                meta["models"][key] = {"feats": list(m["feats"]), "platt": [a, b], "rounds": int(m.get("rounds", 0) or 0)}
                cal = lambda r: 1 / (1 + np.exp(-(a * logit(r) + b)))  # noqa: E731
                if v == "full":
                    po = cal(o.p.values)
                    q_vh = np.quantile(po, 1 - TIER_SHARES["very_high"])
                    q_h = np.quantile(po, 1 - TIER_SHARES["very_high"] - TIER_SHARES["high"])
                    q_m = np.quantile(po, 1 - sum(TIER_SHARES.values()))
                    lvl = np.where(po >= q_vh, "very_high", np.where(po >= q_h, "high", np.where(po >= q_m, "moderate", "low")))
                    stats = {}
                    for name in ("very_high", "high", "moderate", "low"):
                        sel = lvl == name
                        stats[name] = dict(share=float(sel.mean()), outbreak_rate=float(o.y.values[sel].mean()) if sel.any() else None,
                                           outbreaks_caught=float(o.y.values[sel].sum() / max(1, o.y.sum())))
                    meta["tiers"][f"{dis}|{h}"] = dict(thresholds=dict(very_high=float(q_vh), high=float(q_h), moderate=float(q_m)),
                                                       base_rate=float(o.y.mean()), levels=stats)
                if v == "climate only":
                    meta["silent"][f"{dis}|{h}"] = float(np.quantile(cal(o.p.values), 0.93))
    (out / "runtime.json").write_text(json.dumps(meta, indent=1))
    # static inputs
    dist = pd.read_parquet(ROOT / "data/india_wx/districts_db.parquet").rename(columns={"id": "district_id"})
    dist = dist.sort_values("district_id").reset_index(drop=True)
    dist["log_density"] = np.log1p(dist["pop"] / dist["area"].clip(lower=1))
    dist.to_parquet(out / "districts.parquet", index=False)
    shutil.copy(ROOT / "data/epiclim/events.parquet", out / "events.parquet")
    mon = pd.read_parquet(ROOT / "data/india_wx/monthly.parquet")
    _, nrm = climate_table(mon)
    nrm.to_parquet(out / "normals.parquet", index=False)
    target_normals(nrm).to_parquet(out / "target_normals.parquet", index=False)
    mon2 = pd.read_parquet(ROOT / "data/india_wx/monthly2.parquet")
    yr = mon2.ym // 100
    m2 = mon2[(yr >= NORMAL_YEARS[0]) & (yr <= NORMAL_YEARS[1])].copy()
    m2["cal"] = m2.ym % 100
    nrm2 = m2.groupby(["district_id", "cal"]).agg(gw_n=("gw_root", "mean"), sol_n=("solar", "mean"), tx_n=("tmax", "mean")).reset_index()
    nrm2.to_parquet(out / "normals2.parquet", index=False)
    shutil.copy(SRC / "model_card.json", out / "model_card.json")
    size = sum(p.stat().st_size for p in out.rglob("*") if p.is_file())
    print(f"runtime written to {out} ({size / 1e6:.1f} MB, {len(meta['models'])} models)")


if __name__ == "__main__":
    main()
