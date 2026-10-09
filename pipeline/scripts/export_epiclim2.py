"""Model card + JSON files for the app database (india-epiclim-v2).

Writes out/epiclim2/model_card.json and, under <data_dir>/india/v2/:
  forecast_<issue>_<disease>.json   rows for public.india_forecasts (with prob_climate_only, silent, scenarios)
  mobility_links.json               rows for public.india_mobility
  model_card_india-epiclim-v2.json  card for public.model_runs (scope india-district)
Usage: python scripts/export_epiclim2.py /home/claude/epiradar-data
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_monthly import CAL, CLIM, MOB, REC, SAT, STAT  # noqa: E402

OUT = ROOT / "out/epiclim2"
VERSION = "india-epiclim-v2"
dbid = lambda d: {"diarrhoea": "add"}.get(d, d)  # noqa: E731


def pooled(o):
    y, p = o.y.values, o.p.values
    k = max(1, int(round(0.10 * len(p))))
    return dict(pr_auc=round(float(average_precision_score(y, p)), 4), roc_auc=round(float(roc_auc_score(y, p)), 4),
                recall_top10=round(float(y[np.argsort(-p)[:k]].sum() / y.sum()), 4), base_rate=round(float(y.mean()), 5),
                positives=int(y.sum()), n=int(len(y)))


def clean(x):
    """JSON-safe: NaN/inf -> None, recursively."""
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, list):
        return [clean(v) for v in x]
    if isinstance(x, float) and not np.isfinite(x):
        return None
    return x


def card():
    res = pd.read_csv(OUT / "rolling_results.csv")
    oof = pd.read_parquet(OUT / "oof.parquet")
    metrics = []
    for (dis, h, v), g in oof.groupby(["disease", "h", "variant"]):
        m = pooled(g)
        yr = res[(res.disease == dis) & (res.h == h) & (res.variant == v)]
        m.update(disease=dbid(dis), h=int(h), variant=v, mean_year_roc=round(float(yr.roc_auc.mean()), 4),
                 mean_year_pr=round(float(yr.pr_auc.mean()), 4), mean_year_top10=round(float(yr.recall_top10.mean()), 4))
        metrics.append(m)
    for (dis, h, v), yr in res[res.variant.str.contains("baseline|persistence")].groupby(["disease", "h", "variant"]):
        metrics.append(dict(disease=dbid(dis), h=int(h), variant=v, mean_year_roc=round(float(yr.roc_auc.mean()), 4),
                            mean_year_pr=round(float(yr.pr_auc.mean()), 4), mean_year_top10=round(float(yr.recall_top10.mean()), 4),
                            base_rate=round(float(yr.base_rate.mean()), 5)))
    cold = []
    for dis, g in oof[oof.h == 1].groupby("disease"):
        for name, sel in (("no earlier outbreak", g.st_rate == 0), ("earlier outbreaks", g.st_rate > 0)):
            gg = g[sel]
            ref = gg[gg.variant == "full"]
            row = dict(disease=dbid(dis), group=name, share_rows=round(float(len(ref) / max(1, (g.variant == "full").sum())), 3),
                       outbreaks=int(ref.y.sum()), share_outbreaks=round(float(ref.y.sum() / max(1, g[g.variant == "full"].y.sum())), 3))
            for v in ("full", "history+mobility", "weather+history", "history only", "climate only"):
                x = gg[gg.variant == v]
                row[v] = round(float(roc_auc_score(x.y, x.p)), 4) if 0 < x.y.sum() < len(x) else None
            cold.append(row)
    tiers = {f"{dbid(k.split('|')[0])}|{k.split('|')[1]}": v for k, v in json.load(open(OUT / "tiers.json")).items()}
    signals = {dbid(k): v for k, v in json.load(open(OUT / "signals.json")).items()}
    rep = json.load(open(ROOT / "out/epiclim/mapping_report.json"))
    ka = json.load(open(ROOT / "out/india_model/karnataka_results.json"))
    fc = pd.read_parquet(OUT / "forecast.parquet")
    c = {
        "model_version": VERSION,
        "scope": "india-district",
        "issue_date": str(fc.issue_month.iloc[0]),
        "unit": "640 districts (Census 2011 boundaries); forecasts for weeks 1-4, 5-8 and 9-12 after the latest weather",
        "target": "an IDSP-reported outbreak of the disease with onset in the window",
        "diseases": ["dengue", "chikungunya", "malaria", "add", "cholera"],
        "data": "IDSP weekly outbreak reports 2009-2022 compiled by EpiClim (8,985 reports); NASA POWER rain, temperature, humidity, soil wetness (MERRA-2), all-sky sunlight (CERES), maximum/minimum temperature and wind for every district, 2008-2026; gravity model of travel between districts; Census 2011 population",
        "events_used": int(rep["source_rows"]),
        "events_by_disease": {dbid(k): v for k, v in rep["events_by_group"].items()},
        "validation": "rolling origin: each test year 2015-2022 predicted by a model trained on earlier years only (early stopping on the year before)",
        "climate_normals": "fixed 2008-2014 monthly normals per district (before every test year)",
        "issuance": "the latest daily weather is cut into 4-week windows (4 weeks back, 5-8, 9-12, up to 24 weeks for rain memory); the model was trained on calendar months",
        "features": {"weather": CLIM, "satellite_water": SAT, "mobility": MOB, "calendar": CAL, "history": STAT, "recent_reports": REC},
        "signals": signals,
        "variants": {
            "full": "deployed: weather + satellite/water + mobility + calendar + outbreak history up to the previous year",
            "weather+satellite+history": "without mobility",
            "weather+history": "without satellite sunlight, soil moisture, heat and wind",
            "history+mobility": "no climate at all",
            "history only": "outbreak history and calendar only",
            "climate only": "weather, satellite and climate normals only (no surveillance)",
            "full+recent reports": "adds outbreak reports up to the issue month (needs a live IDSP/IHIP feed)",
        },
        "metrics": metrics,
        "cold_start": cold,
        "tiers": tiers,
        "tier_shares": {"very_high": 0.02, "high": 0.05, "moderate": 0.13, "low": 0.80},
        "karnataka_weekly": {"summary": ka["summary"], "districts": ka["districts"], "weeks": ka["weeks"], "cases": ka["cases"],
                             "test_years": ka["test_years"], "target": ka["target"],
                             "source": "ICTS Karnataka district dengue (weekly), NASA POWER daily weather"},
        "limits": [
            "IDSP publishes outbreak reports, not case counts; the forecast is for reported outbreaks and reflects surveillance strength as well as disease.",
            "Reporting fell in 2020-2022 (COVID-19); probabilities are calibrated on 2015-2022 together.",
            "Forecast windows are 4 weeks long; the model was trained on calendar months (4-4.4 weeks).",
            "Mobility is a gravity-model estimate from population and distance, not measured travel.",
            "Districts are 2011 boundaries; outbreaks in newer districts are placed in their 2011 parent district by location.",
            "Climate is NASA POWER at the district centroid (about 50 km grid); local rainfall can differ.",
            "Drivers are model associations (SHAP), not proof of cause.",
        ],
    }
    c = clean(c)
    json.dump(c, open(OUT / "model_card.json", "w"), indent=1, allow_nan=False)
    return c, fc


def main():
    data_dir = Path(sys.argv[1]) / "india" / "v2"
    data_dir.mkdir(parents=True, exist_ok=True)
    c, fc = card()
    issue = str(fc.issue_month.iloc[0])
    fc["disease_id"] = fc.disease_id.map(dbid)
    cols = ["district_id", "disease_id", "horizon", "issue_month", "target_month", "prob", "prob_no_climate", "prob_climate_only",
            "silent", "typical_prob", "risk_level", "rank_india", "drivers", "inputs", "scenarios"]
    for f in data_dir.glob("forecast_*.json"):
        f.unlink()
    for dis, g in fc.groupby("disease_id"):
        recs = []
        for r in g[cols].to_dict(orient="records"):
            r["drivers"] = [dict(f=x["f"], w=float(x["w"])) for x in r["drivers"]]
            r["inputs"] = {k: (None if v is None or (isinstance(v, float) and np.isnan(v)) else (int(v) if isinstance(v, (int, np.integer)) else float(v))) for k, v in r["inputs"].items()}
            sc = r["scenarios"]
            r["scenarios"] = dict(r=[float(x) for x in sc["r"]], t=[float(x) for x in sc["t"]], p=[[float(x) for x in row] for row in sc["p"]])
            for k in ("prob", "prob_no_climate", "prob_climate_only", "typical_prob"):
                r[k] = round(float(r[k]), 6)
            r["horizon"], r["rank_india"], r["silent"] = int(r["horizon"]), int(r["rank_india"]), bool(r["silent"])
            r["model_version"] = VERSION
            recs.append(r)
        p = data_dir / f"forecast_{issue}_{dis}.json"
        p.write_text(json.dumps(recs, separators=(",", ":")))
        print(p.name, len(recs), p.stat().st_size)
    links = pd.read_parquet(OUT / "links.parquet")
    (data_dir / "mobility_links.json").write_text(json.dumps(links.to_dict(orient="records"), separators=(",", ":")))
    (data_dir / f"model_card_{VERSION}.json").write_text(json.dumps(c, separators=(",", ":"), allow_nan=False))
    print("links", len(links), "card", (data_dir / f"model_card_{VERSION}.json").stat().st_size)


if __name__ == "__main__":
    main()
