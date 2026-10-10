"""Weekly India district forecast: NASA POWER weather -> india-epiclim-v2 -> EpiRadar.

  python scripts/weekly_india.py --fetch                   fetch the latest daily weather and forecast
  python scripts/weekly_india.py --daily weather.parquet   forecast from saved daily weather
  add --ingest to load the results into the app through /api/public/ingest
  (needs the environment variables INGEST_TOKEN and EPIRADAR_URL; the token is never printed or written).

Outputs in --out: daily_weather.parquet, forecast_<issue>.json (rows for public.india_forecasts), model_card.json,
data_sources.json and summary.md. The run stops without loading anything if the weather is missing or stale.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.india_weekly import (VERSION, Runtime, card_record, fetch_daily, forecast, forecast_records,  # noqa: E402
                                   ingest, issue_date, source_records, weather_window)

MAX_LAG_DAYS = 21
NAMES = {"dengue": "Dengue", "chikungunya": "Chikungunya", "malaria": "Malaria", "add": "Diarrhoeal disease", "cholera": "Cholera"}


def log(*a):
    print(*a, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runtime", default=str(ROOT.parent / "runtime" / VERSION if (ROOT.parent / "runtime").exists() else ROOT / "runtime" / VERSION))
    ap.add_argument("--out", default="out/weekly")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--fetch", action="store_true", help="fetch daily weather from NASA POWER")
    src.add_argument("--daily", help="saved daily weather (parquet)")
    ap.add_argument("--ingest", action="store_true", help="load the results into EpiRadar")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    rt = Runtime(Path(a.runtime))
    nd = len(rt.dist)
    log(f"runtime {rt.version}: {len(rt.meta['models'])} models, {nd} districts")

    if a.fetch:
        start, end = weather_window()
        log(f"fetching NASA POWER daily weather {start} .. {end} for {nd} districts")
        daily = fetch_daily(rt.dist, start, end, workers=a.workers, log=log)
        daily.to_parquet(out / "daily_weather.parquet", index=False)
    else:
        daily = pd.read_parquet(a.daily)
        daily["day"] = pd.to_datetime(daily.day)
        start = daily.day.min().date()
    D = issue_date(daily, nd)
    if D is None:
        sys.exit("No day has weather for 98% of districts; nothing was forecast.")
    lag = (datetime.now(timezone.utc).date() - D.date()).days
    log(f"issue date (last day with weather for >=98% of districts): {D.date()} ({lag} days ago)")
    if a.fetch and lag > MAX_LAG_DAYS:
        sys.exit(f"Weather is {lag} days old (limit {MAX_LAG_DAYS}); nothing was forecast.")
    covered = daily[daily.day >= D - pd.Timedelta(days=167)].dropna(subset=["t2m", "rain"]).groupby("district_id").day.nunique()
    log(f"districts with weather in the last 24 weeks: {int((covered > 0).sum())} of {nd}")

    fc, signals = forecast(rt, daily, D, log=log)
    recs = forecast_records(fc)
    issue = str(D.date())
    (out / f"forecast_{issue}.json").write_text(json.dumps(recs, separators=(",", ":"), allow_nan=False))
    card = card_record(rt, D, signals, start)
    (out / "model_card.json").write_text(json.dumps(card, indent=1, allow_nan=False))
    n_weather = int(daily.dropna(subset=["t2m", "rain"]).shape[0])
    sources = source_records(D, start, len(recs), n_weather, nd)
    (out / "data_sources.json").write_text(json.dumps(sources, indent=1, ensure_ascii=False))

    lines = [f"## India outbreak forecast, issue {issue}", "", f"Weather {start} – {issue} (NASA POWER), model {rt.version}.", "",
             "| Disease | Weeks | Very high | High | Blind spots |", "|---|---|---|---|---|"]
    for (dis, h), g in fc.groupby(["disease_id", "horizon"]):
        lines.append(f"| {NAMES.get(dis, dis)} | {(h - 1) * 4 + 1}–{h * 4} | {(g.risk_level == 'very_high').sum()} | {(g.risk_level == 'high').sum()} | {int(g.silent.sum())} |")
    summary = "\n".join(lines) + "\n"
    (out / "summary.md").write_text(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(summary)
    if os.environ.get("GITHUB_ACTIONS") == "true" and not a.ingest:
        w1 = fc[fc.horizon == 1]
        hi = ", ".join(f"{NAMES.get(d, d)} {int(g.risk_level.isin(['high', 'very_high']).sum())}" for d, g in w1.groupby("disease_id"))
        n_cov = int((covered > 0).sum())
        log(f"::notice title=India forecast {issue}::Weather {start} to {issue} for {n_cov} of {nd} districts. "
            f"Weeks 1-4 districts at high or very high risk: {hi}. Blind spots: {int(w1[w1.silent].district_id.nunique())} districts.")
    log(summary)

    if a.ingest:
        token, url = os.environ.get("INGEST_TOKEN", ""), os.environ.get("EPIRADAR_URL", "")
        if not token or not url:
            sys.exit("INGEST_TOKEN and EPIRADAR_URL must be set to load the forecast.")
        log(f"loading into {url}")
        ingest(url, token, "india_forecasts", recs, log=log)
        ingest(url, token, "model_runs", [card], chunk=1, log=log)
        ingest(url, token, "data_sources", sources, log=log)
        log("done")


if __name__ == "__main__":
    main()
