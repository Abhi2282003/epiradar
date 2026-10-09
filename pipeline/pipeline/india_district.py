"""Weekly district dengue surge model where weekly case counts exist (Karnataka, ICTS) — helpers.

Weeks start on Monday. Climate from NASA POWER daily point data at each district.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

HORIZONS = [2, 4, 6, 8]
HEAVY_MM = 10.0


def aedes_t(t):
    t = np.asarray(t, dtype=float)
    out = np.where(t < 29.0, np.exp(-(((t - 29.0) / 6.0) ** 2)), np.exp(-(((t - 29.0) / 3.0) ** 2)))
    out = np.where((t < 17.0) | (t > 35.0), 0.0, out)
    return np.where(np.isnan(t), np.nan, out)


def anoph_t(t):
    t = np.asarray(t, dtype=float)
    out = np.where(t < 25.0, np.exp(-(((t - 25.0) / 5.0) ** 2)), np.exp(-(((t - 25.0) / 4.0) ** 2)))
    out = np.where((t < 16.0) | (t > 34.0), 0.0, out)
    return np.where(np.isnan(t), np.nan, out)


def weekly_weather(daily: pd.DataFrame) -> pd.DataFrame:
    """daily: key, day, t2m, tmax, tmin, rain, rh -> Monday weeks (rain scaled to 7 days; <5 valid days -> NaN)."""
    d = daily.copy()
    d["week"] = d.day - pd.to_timedelta(d.day.dt.weekday, unit="D")
    d["heavy"] = (d.rain >= HEAVY_MM).astype(float).where(d.rain.notna())
    g = d.groupby(["key", "week"])
    w = g.agg(nd=("t2m", "count"), rain=("rain", "mean"), t=("t2m", "mean"), tx=("tmax", "mean"), tn=("tmin", "mean"),
              rh=("rh", "mean"), heavy=("heavy", "sum")).reset_index()
    w["rain"] = w.rain * 7
    bad = w.nd < 5
    w.loc[bad, ["rain", "t", "tx", "tn", "rh", "heavy"]] = np.nan
    w["sa"] = aedes_t(w.t)
    w["sn"] = anoph_t(w.t)
    return w


def monthly_normals_from_daily(daily: pd.DataFrame, years) -> pd.DataFrame:
    d = daily[daily.day.dt.year.isin(list(years))].copy()
    d["m"] = d.day.dt.month
    return d.groupby(["key", "m"]).agg(rain_md=("rain", "mean"), t_m=("t2m", "mean"), rh_m=("rh", "mean")).reset_index()


def week_normals(weeks: pd.DataFrame, normals: pd.DataFrame) -> pd.DataFrame:
    """weeks: key, week -> rain_n (sum of the 7 daily normals), t_n, rh_n."""
    rows = weeks[["key", "week"]].drop_duplicates().copy()
    days = pd.concat([rows.assign(day=rows.week + pd.Timedelta(days=k)) for k in range(7)], ignore_index=True)
    days["m"] = days.day.dt.month
    days = days.merge(normals, on=["key", "m"], how="left")
    return days.groupby(["key", "week"]).agg(rain_n=("rain_md", "sum"), t_n=("t_m", "mean"), rh_n=("rh_m", "mean")).reset_index()


def _roll(s: pd.Series, lo: int, hi: int, how: str):
    """Aggregate over lags lo..hi weeks before (lag 0 = the issue week itself is lag 1 here: windows 1_4 = t-3..t)."""
    win = hi - lo + 1
    shifted = s.shift(lo - 1)
    r = shifted.rolling(win, min_periods=max(1, win - 1))
    return r.sum() if how == "sum" else r.mean() if how == "mean" else r.max()


def climate_features(w: pd.DataFrame) -> pd.DataFrame:
    """w: key, week, rain, t, tx, tn, rh, heavy, sa, sn, rain_n, t_n, rh_n (complete weekly grid per key)."""
    out = []
    for k, g in w.sort_values(["key", "week"]).groupby("key", sort=False):
        f = pd.DataFrame({"key": k, "week": g.week.values})
        for lo, hi in ((1, 4), (5, 8), (9, 12)):
            tag = f"{lo}_{hi}"
            f[f"rain_{tag}"] = _roll(g.rain, lo, hi, "sum").values
            f[f"rainn_{tag}"] = _roll(g.rain_n, lo, hi, "sum").values
            f[f"rain_anom_{tag}"] = np.log((f[f"rain_{tag}"] + 10) / (f[f"rainn_{tag}"] + 10))
            f[f"sa_{tag}"] = _roll(g.sa, lo, hi, "mean").values
            f[f"t_{tag}"] = _roll(g.t, lo, hi, "mean").values
            f[f"t_anom_{tag}"] = f[f"t_{tag}"] - _roll(g.t_n, lo, hi, "mean").values
            f[f"rh_{tag}"] = _roll(g.rh, lo, hi, "mean").values
        f["sn_1_4"] = _roll(g.sn, 1, 4, "mean").values
        f["tn_1_4"] = _roll(g.tn, 1, 4, "mean").values
        f["tx_1_4"] = _roll(g.tx, 1, 4, "mean").values
        f["heavy_1_8"] = _roll(g.heavy, 1, 8, "sum").values
        out.append(f)
    return pd.concat(out, ignore_index=True)


def target_season_features(w: pd.DataFrame, h: int) -> pd.DataFrame:
    """Normal climate of the 4 target weeks t+h-2 .. t+h+1 (the season the forecast is about)."""
    out = []
    for k, g in w.sort_values(["key", "week"]).groupby("key", sort=False):
        f = pd.DataFrame({"key": k, "week": g.week.values})
        f["tgt_rain_n"] = g.rain_n.rolling(4, min_periods=3).sum().shift(-(h + 1)).values
        f["tgt_t_n"] = g.t_n.rolling(4, min_periods=3).mean().shift(-(h + 1)).values
        f["tgt_rh_n"] = g.rh_n.rolling(4, min_periods=3).mean().shift(-(h + 1)).values
        out.append(f)
    f = pd.concat(out, ignore_index=True)
    f["tgt_sa_n"] = aedes_t(f.tgt_t_n)
    return f
