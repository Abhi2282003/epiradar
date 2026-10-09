"""Clean the EpiClim outbreak list and map every outbreak to a 2011-census district.

Input : data/epiclim/EpiClim_Final_data.csv  (IDSP weekly outbreak reports 2009-2022, compiled by EpiClim)
        data/geo/dists11.geojson             (DataMeet 2011 census district boundaries)
        out/india/districts.json             (the app's 641 district ids, IN-D<census code>)
Output: data/epiclim/events.parquet          one row per outbreak with district_id, disease group, onset date
        out/epiclim/mapping_report.json      how each outbreak was placed
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data/epiclim/EpiClim_Final_data.csv"
OUT = ROOT / "data/epiclim/events.parquet"
REP = ROOT / "out/epiclim/mapping_report.json"

# disease label in EpiClim -> one or more model groups
GROUPS = {
    "dengue": ["dengue"],
    "suspected dengue": ["dengue"],
    "dengue fever": ["dengue"],
    "chikungunya": ["chikungunya"],
    "suspected chikungunya": ["chikungunya"],
    "dengue and chikungunya": ["dengue", "chikungunya"],
    "dengue/chikungunya": ["dengue", "chikungunya"],
    "dengue chikungunya": ["dengue", "chikungunya"],
    "chikungunya/dengue": ["dengue", "chikungunya"],
    "chikungunya/ dengue": ["dengue", "chikungunya"],
    "suspected dengue and chikungunya": ["dengue", "chikungunya"],
    "dengue and malaria": ["dengue", "malaria"],
    "malaria": ["malaria"],
    "malaria (pv)": ["malaria"],
    "acute diarrhoeal disease": ["diarrhoea"],
    "acute gastroenteritis": ["diarrhoea"],
    "gastroenteritis": ["diarrhoea"],
    "diarrhea": ["diarrhoea"],
    "cholera": ["cholera"],
    "suspected cholera": ["cholera"],
    "acute encephalitis syndrome": ["aes"],
}

# 2011 boundary state names vs. names used in EpiClim / today
STATE_ALIAS = {
    "telangana": "andhra pradesh",
    "ladakh": "jammu & kashmir",
    "jammu and kashmir": "jammu & kashmir",
    "andaman and nicobar islands": "andaman & nicobar island",
    "dadra and nagar haveli": "dadara & nagar havelli",
    "daman and diu": "daman & diu",
    "delhi": "nct of delhi",
    "arunachal pradesh": "arunanchal pradesh",
}


def norm_state(s: str) -> str:
    s = str(s).strip().lower()
    return STATE_ALIAS.get(s, s)


def onset_dates(df: pd.DataFrame) -> pd.Series:
    """Onset date as given; if it is implausibly far from the IDSP reporting week, use reporting week - 7 days."""
    start = pd.to_datetime(dict(year=df.year, month=df.mon, day=df.day), errors="coerce")
    wk = df.week_of_outbreak.str.extract(r"(\d+)")[0].astype(float)

    def week_monday(y, w):
        try:
            return pd.Timestamp.fromisocalendar(int(y), int(min(w, 52)), 1)
        except Exception:
            return pd.NaT

    rep = pd.Series([week_monday(y, w) for y, w in zip(df.year, wk)], index=df.index)
    gap = (rep - start).dt.days
    ok = gap.between(-14, 70)
    onset = start.where(ok, rep - pd.Timedelta(days=7))
    return onset, ok, rep


def main():
    df = pd.read_csv(SRC).rename(columns={"Unnamed: 0": "src_row"})
    df["cases"] = pd.to_numeric(df.Cases, errors="coerce")
    df["deaths"] = pd.to_numeric(df.Deaths, errors="coerce")
    df["onset"], df["date_ok"], df["report_week"] = onset_dates(df)
    df["dis_raw"] = df.Disease.str.strip().str.lower()

    gj = json.load(open(ROOT / "data/geo/dists11.geojson"))
    geoms, ids, gstate = [], [], []
    for f in gj["features"]:
        geoms.append(shape(f["geometry"]))
        ids.append(f"IN-D{int(f['properties']['censuscode'])}")
        gstate.append(norm_state(f["properties"]["ST_NM"]))
    tree = STRtree(geoms)
    meta = {x["id"]: x for x in json.load(open(ROOT / "out/india/districts.json"))}

    rows, how = [], []
    for r in df.itertuples():
        p = Point(r.Longitude, r.Latitude)
        st = norm_state(r.state_ut)
        hit = [i for i in tree.query(p, predicate="intersects")]
        method = None
        if hit:
            same = [i for i in hit if gstate[i] == st]
            idx = (same or hit)[0]
            method = "inside" if same else "inside_other_state"
        else:
            # coast / border points: nearest polygon of the same state within ~0.3 degrees
            cand = tree.query(p.buffer(0.3))
            cand = sorted(cand, key=lambda i: geoms[i].distance(p))
            same = [i for i in cand if gstate[i] == st]
            if same:
                idx, method = same[0], "nearest_same_state"
            elif cand:
                idx, method = cand[0], "nearest_other_state"
            else:
                idx = None
        how.append(method or "unmapped")
        rows.append(ids[idx] if idx is not None else None)
    df["district_id"] = rows
    df["map_method"] = how

    ev = []
    for r in df.itertuples():
        for g in GROUPS.get(r.dis_raw, []):
            ev.append(dict(src_row=r.src_row, district_id=r.district_id, state=r.state_ut, district_src=r.district,
                           disease=g, disease_src=r.Disease, onset=r.onset, report_week=r.report_week,
                           date_ok=bool(r.date_ok), cases=r.cases, deaths=r.deaths, lat=r.Latitude, lon=r.Longitude,
                           map_method=r.map_method, ec_preci=r.preci, ec_lai=r.LAI, ec_temp_k=r.Temp))
    ev = pd.DataFrame(ev)
    ev = ev[ev.district_id.notna()].copy()
    ev["onset"] = pd.to_datetime(ev.onset)
    ev.to_parquet(OUT, index=False)

    rep = {
        "source_rows": int(len(df)),
        "rows_with_known_disease_group": int(df.dis_raw.isin(GROUPS).sum()),
        "unknown_disease_labels": df.loc[~df.dis_raw.isin(GROUPS), "Disease"].value_counts().to_dict(),
        "map_method": pd.Series(how).value_counts().to_dict(),
        "onset_date_used_as_given": int(df.date_ok.sum()),
        "onset_from_reporting_week": int((~df.date_ok).sum()),
        "events_by_group": ev.disease.value_counts().to_dict(),
        "districts_with_any_event": int(ev.district_id.nunique()),
        "districts_total": len(meta),
        "years": [int(ev.onset.dt.year.min()), int(ev.onset.dt.year.max())],
    }
    REP.parent.mkdir(parents=True, exist_ok=True)
    json.dump(rep, open(REP, "w"), indent=2, default=str)
    print(json.dumps(rep, indent=2, default=str))


if __name__ == "__main__":
    main()
