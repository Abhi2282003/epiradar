"""Parse compact NASA POWER monthly exports (from ep_stage.wx_raw kind 'in_mon') into data/india_wx/monthly.parquet.

Usage: python scripts/parse_india_monthly.py <query-result.json> [<more>.json ...]
Each file holds {"rows":[{"json_agg": [{"k": district_id, "m": [YYYYMM...], "t": [...], "r": [...], "h": [...]}]}]}.
-999 is POWER's fill value -> NaN. Rows are merged with any existing monthly.parquet (newest wins).
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/india_wx/monthly.parquet"


def load(path):
    d = json.load(open(path))
    v = list(d["rows"][0].values())[0]
    if isinstance(v, str):
        v = json.loads(v)
    recs = []
    for x in v:
        m = np.array(x["m"], dtype=int)
        for col in ("t", "r", "h"):
            assert len(x[col]) == len(m), (x["k"], col)
        recs.append(pd.DataFrame({"district_id": x["k"], "ym": m, "t2m": x["t"], "rain_md": x["r"], "rh": x["h"]}))
    df = pd.concat(recs, ignore_index=True)
    for c in ("t2m", "rain_md", "rh"):
        df[c] = df[c].astype(float).where(df[c].astype(float) > -990)
    return df


def main():
    parts = [load(p) for p in sys.argv[1:]]
    df = pd.concat(parts, ignore_index=True)
    if OUT.exists():
        old = pd.read_parquet(OUT)
        df = pd.concat([old, df], ignore_index=True)
    df = df.drop_duplicates(["district_id", "ym"], keep="last").sort_values(["district_id", "ym"]).reset_index(drop=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT, index=False)
    print(df.shape, df.district_id.nunique(), df.ym.min(), df.ym.max())
    last = df.dropna(subset=["t2m"]).groupby("district_id").ym.max().value_counts()
    print("last valid month per district:", last.to_dict())


if __name__ == "__main__":
    main()
