"""Model card + SQL batches for the app (india_forecasts, india_outbreaks, model_runs, data_sources).

Writes out/epiclim/model_card.json and out/epiclim/sql/*.sql (each file small enough for one query call).
Disease id 'diarrhoea' is stored as 'add' (the app's id for acute diarrhoeal disease).
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_monthly import CAL, CLIM, REC, STAT  # noqa: E402

OUT = ROOT / "out/epiclim"
SQL = OUT / "sql"
SQL.mkdir(parents=True, exist_ok=True)
VERSION = "india-epiclim-v1"
DB_ID = {"diarrhoea": "add"}
dbid = lambda d: DB_ID.get(d, d)  # noqa: E731


def q(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return "NULL"
    if isinstance(v, (int, np.integer)):
        return str(int(v))
    if isinstance(v, (float, np.floating)):
        return repr(round(float(v), 6))
    return "'" + str(v).replace("'", "''") + "'"


def pooled(o):
    y, p = o.y.values, o.p.values
    k = max(1, int(round(0.10 * len(p))))
    return dict(pr_auc=round(float(average_precision_score(y, p)), 4), roc_auc=round(float(roc_auc_score(y, p)), 4),
                recall_top10=round(float(y[np.argsort(-p)[:k]].sum() / y.sum()), 4), base_rate=round(float(y.mean()), 5),
                positives=int(y.sum()), n=int(len(y)))


def cold_start():
    """ROC-AUC 1 month ahead in district-months with and without an earlier outbreak of the disease (2015-2022)."""
    import scripts.train_epiclim as T
    from pipeline.india_monthly import DISEASES, history_features, mi, outbreak_grid
    ev, dist, _ = T.load()
    m_lo, m_hi = int(mi(200801)), int(mi(202212))
    grid = outbreak_grid(ev, dist, m_lo, m_hi)
    oof = pd.read_parquet(OUT / "oof.parquet")
    pos = {d: i for i, d in enumerate(dist.district_id)}
    out = []
    for dis in DISEASES:
        o = oof[(oof.disease == dis) & (oof.h == 1)]
        v = {k: o[o.variant == k].reset_index(drop=True) for k in ("climate+history", "history only", "climate only")}
        a = v["climate+history"]
        hf = history_features(grid, dis, dist, m_lo, a.issue_m.values, a.tgt_m.values, a.district_id.map(pos).values)
        cold = hf.st_rate.values == 0
        for name, mask in (("no earlier outbreak", cold), ("earlier outbreaks", ~cold)):
            y = a.y.values[mask]
            row = dict(disease=dbid(dis), group=name, share_rows=round(float(mask.mean()), 3), outbreaks=int(y.sum()),
                       share_outbreaks=round(float(y.sum() / a.y.sum()), 3))
            for k, x in v.items():
                row[k] = round(float(roc_auc_score(y, x.p.values[mask])), 4) if 0 < y.sum() < len(y) else None
            out.append(row)
    return out


def card():
    res = pd.read_csv(OUT / "rolling_results.csv")
    oof = pd.read_parquet(OUT / "oof.parquet")
    tiers = json.load(open(OUT / "tiers.json"))
    rep = json.load(open(OUT / "mapping_report.json"))
    metrics = []
    for (dis, h, v), g in oof.groupby(["disease", "h", "variant"]):
        m = pooled(g)
        yr = res[(res.disease == dis) & (res.h == h) & (res.variant == v)]
        m.update(disease=dbid(dis), h=int(h), variant=v, mean_year_roc=round(float(yr.roc_auc.mean()), 4),
                 mean_year_pr=round(float(yr.pr_auc.mean()), 4), mean_year_top10=round(float(yr.recall_top10.mean()), 4))
        metrics.append(m)
    # baselines (per-year means only; computed on the same test rows)
    for (dis, h, v), yr in res[res.variant.str.contains("baseline|persistence")].groupby(["disease", "h", "variant"]):
        metrics.append(dict(disease=dbid(dis), h=int(h), variant=v, mean_year_roc=round(float(yr.roc_auc.mean()), 4),
                            mean_year_pr=round(float(yr.pr_auc.mean()), 4), mean_year_top10=round(float(yr.recall_top10.mean()), 4),
                            base_rate=round(float(yr.base_rate.mean()), 5)))
    # pooled seasonal baseline from OOF rows is not stored; per-year means are used for baselines
    t2 = {}
    for k, v in tiers.items():
        dis, h = k.split("|")
        t2[f"{dbid(dis)}|{h}"] = v
    ka = json.load(open(ROOT / "out/india_model/karnataka_results.json"))
    c = {
        "model_version": VERSION,
        "scope": "india-district",
        "unit": "640 districts (Census 2011 boundaries), monthly",
        "target": "an IDSP-reported outbreak of the disease with onset in the target month",
        "horizons_months": [1, 2, 3],
        "diseases": ["dengue", "chikungunya", "malaria", "add", "cholera"],
        "data": "IDSP weekly outbreak reports 2009-2022 compiled by EpiClim (8,985 reports); NASA POWER monthly temperature, rainfall and humidity 2008-2026 for every district centroid; Census 2011 population",
        "events_used": int(rep["source_rows"]),
        "events_by_disease": {dbid(k): v for k, v in rep["events_by_group"].items()},
        "mapping": rep["map_method"],
        "validation": "rolling origin: each test year 2015-2022 predicted by a model trained on earlier years only (early stopping on the year before)",
        "climate_normals": "fixed 2008-2014 monthly normals per district (before every test year)",
        "features": {"climate": CLIM, "calendar": CAL, "history": STAT, "recent_reports": REC},
        "variants": {
            "climate+history": "deployed: climate + calendar + district outbreak history up to the previous year",
            "history only": "same without climate (ablation)",
            "climate only": "climate and climate normals only",
            "climate+history+recent reports": "adds outbreak reports up to the issue month (needs a live IDSP/IHIP feed)",
            "history+recent reports": "the same without climate",
        },
        "metrics": metrics,
        "cold_start": cold_start(),
        "karnataka_weekly": {"summary": ka["summary"], "districts": ka["districts"], "weeks": ka["weeks"], "cases": ka["cases"],
                             "test_years": ka["test_years"], "target": ka["target"],
                             "source": "ICTS Karnataka district dengue (weekly), NASA POWER daily weather"},
        "tiers": t2,
        "tier_shares": {"very_high": 0.02, "high": 0.05, "moderate": 0.13, "low": 0.80},
        "limits": [
            "IDSP publishes outbreak reports, not case counts; the forecast is for reported outbreaks and reflects surveillance strength as well as disease.",
            "Reporting fell in 2020-2022 (COVID-19); probabilities are calibrated on 2015-2022 together.",
            "Districts are 2011 boundaries; outbreaks in newer districts are placed in their 2011 parent district by location.",
            "Climate is NASA POWER at the district centroid (about 50 km grid); local rainfall can differ.",
            "Drivers are model associations (SHAP), not proof of cause.",
        ],
    }
    json.dump(c, open(OUT / "model_card.json", "w"), indent=1)
    return c


def sql_files(c):
    for f in SQL.glob("*.sql"):
        f.unlink()
    fc = pd.read_parquet(OUT / "forecast.parquet")
    fc["disease_id"] = fc.disease_id.map(dbid)
    cols = ["district_id", "disease_id", "horizon", "issue_month", "target_month", "prob", "prob_no_climate", "typical_prob",
            "risk_level", "rank_india", "drivers", "inputs", "model_version"]
    rows = []
    for r in fc.itertuples():
        vals = [q(r.district_id), q(r.disease_id), q(int(r.horizon)), q(r.issue_month), q(r.target_month), q(r.prob),
                q(r.prob_no_climate), q(r.typical_prob), q(r.risk_level), q(int(r.rank_india)),
                q(json.dumps(list(r.drivers), separators=(",", ":"))) + "::jsonb",
                q(json.dumps(r.inputs, separators=(",", ":"))) + "::jsonb", q(VERSION)]
        rows.append("(" + ",".join(vals) + ")")
    issue = fc.issue_month.iloc[0]
    head = f"INSERT INTO public.india_forecasts ({','.join(cols)}) VALUES\n"
    tail = "\nON CONFLICT (district_id, disease_id, horizon, issue_month) DO UPDATE SET target_month=EXCLUDED.target_month, prob=EXCLUDED.prob, prob_no_climate=EXCLUDED.prob_no_climate, typical_prob=EXCLUDED.typical_prob, risk_level=EXCLUDED.risk_level, rank_india=EXCLUDED.rank_india, drivers=EXCLUDED.drivers, inputs=EXCLUDED.inputs, model_version=EXCLUDED.model_version, created_at=now();\n"
    n = 0
    for i in range(0, len(rows), 1600):
        (SQL / f"fc_{n:02d}.sql").write_text(head + ",\n".join(rows[i:i + 1600]) + tail)
        n += 1
    # outbreak history (district x disease x month)
    ev = pd.read_parquet(ROOT / "data/epiclim/events.parquet")
    dist = set(pd.read_parquet(ROOT / "data/india_wx/districts_db.parquet").id)
    ev = ev[ev.district_id.isin(dist) & (ev.onset.dt.year >= 2009)].copy()
    ev["month"] = ev.onset.dt.strftime("%Y-%m-01")
    ev["disease_id"] = ev.disease.map(dbid)
    g = ev.groupby(["district_id", "disease_id", "month"]).agg(outbreaks=("src_row", "count"), cases=("cases", "sum"),
                                                              deaths=("deaths", "sum")).reset_index()
    orows = [f"({q(r.district_id)},{q(r.disease_id)},{q(r.month)},{int(r.outbreaks)},{int(r.cases) if not np.isnan(r.cases) else 'NULL'},{int(r.deaths) if not np.isnan(r.deaths) else 'NULL'})"
             for r in g.itertuples()]
    ohead = "INSERT INTO public.india_outbreaks (district_id,disease_id,month,outbreaks,cases,deaths) VALUES\n"
    otail = "\nON CONFLICT (district_id, disease_id, month) DO UPDATE SET outbreaks=EXCLUDED.outbreaks, cases=EXCLUDED.cases, deaths=EXCLUDED.deaths;\n"
    for i, k in enumerate(range(0, len(orows), 4000)):
        (SQL / f"ob_{i:02d}.sql").write_text(ohead + ",\n".join(orows[k:k + 4000]) + otail)
    # model card + sources
    meta = f"""INSERT INTO public.model_runs (model_version, disease_id, created_at, card, scope)
VALUES ({q(VERSION)}, NULL, now(), {q(json.dumps(c, separators=(',', ':')))}::jsonb, 'india-district')
ON CONFLICT (model_version) DO UPDATE SET card=EXCLUDED.card, created_at=now(), scope=EXCLUDED.scope;
INSERT INTO public.data_sources (id, name, cadence, last_success_at, status, rows_last_run, note) VALUES
('epiclim_idsp', 'EpiClim: IDSP weekly outbreak reports 2009-2022 (district, disease, cases, deaths)', 'static (2009-2022)', now(), 'ok', {len(g)}, 'EpiClim dataset (IDSP weekly outbreak PDFs, digitised); 8,985 reports placed in 2011 districts by location'),
('nasa_power_india', 'NASA POWER monthly and daily point weather for 640 district centroids', 'monthly', now(), 'ok', 640, 'T2M, PRECTOTCORR, RH2M; 2008-01 to {issue[:7]}; latest month from the daily endpoint'),
('india_forecast', 'EpiRadar India district outbreak forecast ({VERSION})', 'monthly', now(), 'ok', {len(fc)}, 'issued for weather up to {issue[:7]}; 5 diseases x 3 months x 640 districts')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, cadence=EXCLUDED.cadence, last_success_at=EXCLUDED.last_success_at, status=EXCLUDED.status, rows_last_run=EXCLUDED.rows_last_run, note=EXCLUDED.note;
"""
    (SQL / "meta.sql").write_text(meta)
    for f in sorted(SQL.glob("*.sql")):
        print(f.name, f.stat().st_size)


if __name__ == "__main__":
    c = card()
    sql_files(c)
