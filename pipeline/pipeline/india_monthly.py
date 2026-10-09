"""All-India district x month panel: climate features (NASA POWER) + outbreak history (IDSP via EpiClim).

Row = (district, issue month t). Target for horizon h = an IDSP outbreak of the disease with onset in month t+h.
Everything a row uses is known at the end of month t:
  * climate of months t, t-1, t-2 (+ anomalies against fixed 2008-2014 normals),
  * the climate normal of the target month (the season that is coming),
  * outbreak history: "static" = years before year(t) only; "recent" = months up to t (needs a live IDSP feed).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

NORMAL_YEARS = (2008, 2014)          # fixed climate normals, before every test year
DISEASES = ["dengue", "chikungunya", "malaria", "diarrhoea", "cholera"]
HORIZONS = [1, 2, 3]


def mi(ym):
    """YYYYMM -> month index."""
    ym = np.asarray(ym)
    return (ym // 100) * 12 + (ym % 100 - 1)


def ym_of(m):
    m = np.asarray(m)
    return (m // 12) * 100 + (m % 12 + 1)


# ---------------------------------------------------------------- vector suitability (same curves as the app)
def aedes_t(t):
    t = np.asarray(t, dtype=float)
    up = np.exp(-(((t - 29.0) / 6.0) ** 2))
    dn = np.exp(-(((t - 29.0) / 3.0) ** 2))
    out = np.where(t < 29.0, up, dn)
    return np.where((t < 17.0) | (t > 35.0) | np.isnan(t), np.where(np.isnan(t), np.nan, 0.0), out)


def anoph_t(t):
    t = np.asarray(t, dtype=float)
    up = np.exp(-(((t - 25.0) / 5.0) ** 2))
    dn = np.exp(-(((t - 25.0) / 4.0) ** 2))
    out = np.where(t < 25.0, up, dn)
    return np.where((t < 16.0) | (t > 34.0) | np.isnan(t), np.where(np.isnan(t), np.nan, 0.0), out)


def moisture(rain_md, rh):
    rain14 = np.asarray(rain_md, dtype=float) * 14.0
    mf = 0.4 + 0.6 * np.minimum(1.0, rain14 / 50.0)
    hf = 0.5 + 0.5 * np.clip((np.asarray(rh, dtype=float) - 40.0) / 40.0, 0, 1)
    return mf * hf


# ---------------------------------------------------------------- climate
def climate_table(mon: pd.DataFrame) -> pd.DataFrame:
    """mon: district_id, ym, t2m, rain_md, rh (monthly). Returns per (district, m) climate features of issue month m."""
    w = mon[["district_id", "ym", "t2m", "rain_md", "rh"]].copy()
    w["m"] = mi(w.ym)
    w["cal"] = w.ym % 100
    yr = w.ym // 100
    nrm = (w[(yr >= NORMAL_YEARS[0]) & (yr <= NORMAL_YEARS[1])]
           .groupby(["district_id", "cal"]).agg(r_n=("rain_md", "mean"), t_n=("t2m", "mean"), rh_n=("rh", "mean"))
           .reset_index())
    w = w.merge(nrm, on=["district_id", "cal"], how="left").sort_values(["district_id", "m"])
    # make the month grid complete per district so shifts are calendar-correct
    full = []
    for d, g in w.groupby("district_id", sort=False):
        idx = pd.RangeIndex(g.m.min(), g.m.max() + 1)
        g = g.set_index("m").reindex(idx)
        g["district_id"] = d
        g.index.name = "m"
        full.append(g.reset_index())
    w = pd.concat(full, ignore_index=True)
    w["cal"] = (w.m % 12) + 1
    w = w.drop(columns=["r_n", "t_n", "rh_n"]).merge(nrm, on=["district_id", "cal"], how="left")
    w = w.sort_values(["district_id", "m"]).reset_index(drop=True)
    g = w.groupby("district_id", sort=False)

    def lag(col, k):
        return g[col].shift(k)

    f = pd.DataFrame({"district_id": w.district_id, "m": w.m})
    for k in (0, 1, 2):
        f[f"r{k}"] = lag("rain_md", k)
        f[f"t{k}"] = lag("t2m", k)
        f[f"rh{k}"] = lag("rh", k)
        rn = lag("r_n", k)
        f[f"ra{k}"] = np.log((f[f"r{k}"] + 0.5) / (rn + 0.5))
        f[f"ta{k}"] = f[f"t{k}"] - lag("t_n", k)
        f[f"aed{k}"] = aedes_t(f[f"t{k}"]) * moisture(f[f"r{k}"], f[f"rh{k}"])
        f[f"ano{k}"] = anoph_t(f[f"t{k}"]) * moisture(f[f"r{k}"], f[f"rh{k}"])
    f["r3m"] = (f.r0 + f.r1 + f.r2) / 3
    rn3 = (lag("r_n", 0) + lag("r_n", 1) + lag("r_n", 2)) / 3
    f["ra3m"] = np.log((f.r3m + 0.5) / (rn3 + 0.5))
    f["t3m"] = (f.t0 + f.t1 + f.t2) / 3
    f["ta3m"] = (f.ta0 + f.ta1 + f.ta2) / 3
    f["rh3m"] = (f.rh0 + f.rh1 + f.rh2) / 3
    f["aed3m"] = (f.aed0 + f.aed1 + f.aed2) / 3
    f["ano3m"] = (f.ano0 + f.ano1 + f.ano2) / 3
    # 6-month rain (soil / groundwater memory) and its anomaly
    r6 = sum(lag("rain_md", k) for k in range(6)) / 6
    rn6 = sum(lag("r_n", k) for k in range(6)) / 6
    f["r6m"] = r6
    f["ra6m"] = np.log((r6 + 0.5) / (rn6 + 0.5))
    return f, nrm


def target_normals(nrm: pd.DataFrame) -> pd.DataFrame:
    """Normals of a calendar month, renamed for the target month."""
    t = nrm.rename(columns={"cal": "tgt_cal", "r_n": "tgt_r_n", "t_n": "tgt_t_n", "rh_n": "tgt_rh_n"}).copy()
    mo = moisture(t.tgt_r_n, t.tgt_rh_n)
    t["tgt_aed_n"] = aedes_t(t.tgt_t_n) * mo
    t["tgt_ano_n"] = anoph_t(t.tgt_t_n) * mo
    return t


# compact climate set (same skill as the full 35-feature set in experiments, easier to explain)
CLIM = ["ra3m", "ra0", "ra6m", "r0", "r3m", "t0", "t3m", "ta3m", "rh0", "rh3m", "aed0", "aed3m", "ano0", "ano3m",
        "tgt_r_n", "tgt_t_n", "tgt_rh_n", "tgt_aed_n", "tgt_ano_n"]
CAL = ["tgt_cal"]
STAT = ["st_rate", "st_m_rate", "st_m3_rate", "state_m3_rate", "st_any_rate", "state_any_rate", "log_density"]
REC = ["rc_3", "rc_12", "rc_any_3", "rc_state_1", "rc_nat_1", "rc_nat_any_3"]

VARIANTS = {
    "climate+history": CLIM + CAL + STAT,          # deployable today (needs no live IDSP feed)
    "history only": CAL + STAT,                    # same, without climate  -> climate ablation
    "climate only": CLIM,                          # weather + climate normals only
    "climate+history+recent reports": CLIM + CAL + STAT + REC,   # if a live IDSP feed is connected
    "history+recent reports": CAL + STAT + REC,
}

FAMILY = {}
for k in (0, 1, 2):
    FAMILY.update({f"r{k}": "rain", f"ra{k}": "rain_anom", f"t{k}": "temp", f"ta{k}": "temp_anom",
                   f"rh{k}": "humidity", f"aed{k}": "aedes", f"ano{k}": "anopheles"})
FAMILY.update({"r3m": "rain", "ra3m": "rain_anom", "t3m": "temp", "ta3m": "temp_anom", "rh3m": "humidity",
               "aed3m": "aedes", "ano3m": "anopheles", "r6m": "rain", "ra6m": "rain_anom",
               "tgt_r_n": "season", "tgt_t_n": "season", "tgt_rh_n": "season", "tgt_aed_n": "season",
               "tgt_ano_n": "season", "tgt_cal": "season",
               "st_rate": "history", "st_m_rate": "history", "st_m3_rate": "history", "state_m3_rate": "history",
               "st_any_rate": "surveillance", "state_any_rate": "surveillance", "log_density": "population",
               "rc_3": "recent", "rc_12": "recent", "rc_any_3": "recent", "rc_state_1": "recent",
               "rc_nat_1": "recent", "rc_nat_any_3": "recent"})


# ---------------------------------------------------------------- outbreak history
def outbreak_grid(ev: pd.DataFrame, districts: pd.DataFrame, m_lo: int, m_hi: int) -> dict:
    """Dense (district x month) 0/1 arrays per disease, plus 'any'."""
    did = districts.district_id.tolist()
    pos = {d: i for i, d in enumerate(did)}
    nm = m_hi - m_lo + 1
    out = {}
    e = ev.copy()
    e["m"] = mi(e.onset.dt.year * 100 + e.onset.dt.month)
    e = e[(e.m >= m_lo) & (e.m <= m_hi) & e.district_id.isin(pos)]
    for dis in DISEASES + ["any"]:
        a = np.zeros((len(did), nm), dtype=np.int16)
        sub = e if dis == "any" else e[e.disease == dis]
        if dis == "any":
            sub = sub.drop_duplicates(["src_row"])
        for d, m in zip(sub.district_id, sub.m):
            a[pos[d], m - m_lo] += 1
        out[dis] = a
    return out


def history_features(grid: dict, dis: str, districts: pd.DataFrame, m_lo: int, issue_m: np.ndarray,
                     tgt_m: np.ndarray, d_idx: np.ndarray, hist_start_year: int = 2009,
                     static_upto_year: np.ndarray | None = None) -> pd.DataFrame:
    """History features for rows (district d_idx, issue month issue_m, target month tgt_m).

    static: uses whole years in [hist_start_year, static_upto_year) where static_upto_year defaults to year(issue month).
    recent: months up to and including the issue month.
    """
    A = (grid[dis] > 0).astype(np.float32)
    ANY = grid["any"].astype(np.float32)
    nd, nm = A.shape
    state = districts.state.values
    st_codes, st_idx = np.unique(state, return_inverse=True)
    yr_issue = (issue_m // 12)
    upto = yr_issue if static_upto_year is None else static_upto_year
    m0 = hist_start_year * 12 - m_lo   # column of Jan of hist_start_year
    years = np.arange(hist_start_year, (m_lo + nm) // 12 + 1)

    # per (district, year): months with outbreak, months observed; per (district, year, cal): outbreak flag
    ny = len(years)
    Ay = np.zeros((nd, ny, 12), dtype=np.float32)
    ANYy = np.zeros((nd, ny), dtype=np.float32)
    for j, y in enumerate(years):
        c0 = y * 12 - m_lo
        c1 = c0 + 12
        if c0 < 0 or c1 > nm:
            continue
        Ay[:, j, :] = A[:, c0:c1]
        ANYy[:, j] = ANY[:, c0:c1].sum(1)
    valid_year = np.array([(y * 12 - m_lo) >= 0 and (y * 12 - m_lo + 12) <= nm for y in years])
    # cumulative sums over years (exclusive) so that index k = sum over years[:k]
    cum_cnt = np.concatenate([np.zeros((nd, 1, 12)), np.cumsum(Ay, axis=1)], axis=1)  # (nd, ny+1, 12)
    cum_any = np.concatenate([np.zeros((nd, 1)), np.cumsum(ANYy, axis=1)], axis=1)
    cum_years = np.concatenate([[0], np.cumsum(valid_year)])
    # state level
    S = np.zeros((len(st_codes), ny + 1, 12))
    SA = np.zeros((len(st_codes), ny + 1))
    nds = np.bincount(st_idx, minlength=len(st_codes)).astype(float)
    for s in range(len(st_codes)):
        S[s] = cum_cnt[st_idx == s].sum(0)
        SA[s] = cum_any[st_idx == s].sum(0)

    k = np.clip(upto - hist_start_year, 0, ny)            # number of whole history years available
    nyears = cum_years[k].astype(float)
    nyears_safe = np.where(nyears > 0, nyears, np.nan)
    cal = tgt_m % 12
    calm1 = (tgt_m - 1) % 12
    calp1 = (tgt_m + 1) % 12
    cc = cum_cnt[d_idx, k]                                  # (n, 12) outbreak-months per calendar month
    f = pd.DataFrame(index=np.arange(len(d_idx)))
    f["st_rate"] = cc.sum(1) / (nyears_safe * 12)
    f["st_m_rate"] = cc[np.arange(len(d_idx)), cal] / nyears_safe
    f["st_m3_rate"] = (cc[np.arange(len(d_idx)), cal] + cc[np.arange(len(d_idx)), calm1]
                       + cc[np.arange(len(d_idx)), calp1]) / (3 * nyears_safe)
    sc = S[st_idx[d_idx], k]
    f["state_m3_rate"] = (sc[np.arange(len(d_idx)), cal] + sc[np.arange(len(d_idx)), calm1]
                          + sc[np.arange(len(d_idx)), calp1]) / (3 * nyears_safe * nds[st_idx[d_idx]])
    f["st_any_rate"] = cum_any[d_idx, k] / nyears_safe
    f["state_any_rate"] = SA[st_idx[d_idx], k] / (nyears_safe * nds[st_idx[d_idx]])

    # recent (months up to issue month inclusive)
    col = issue_m - m_lo
    ok = (col >= 0) & (col < nm)
    cA = np.concatenate([np.zeros((nd, 1)), np.cumsum(A, axis=1)], axis=1)
    cANY = np.concatenate([np.zeros((nd, 1)), np.cumsum(ANY, axis=1)], axis=1)
    def win(C, rows, c, w):
        hi = np.clip(c + 1, 0, nm)
        lo = np.clip(c + 1 - w, 0, nm)
        return C[rows, hi] - C[rows, lo]
    f["rc_3"] = np.where(ok, win(cA, d_idx, col, 3), np.nan)
    f["rc_12"] = np.where(ok, win(cA, d_idx, col, 12), np.nan)
    f["rc_any_3"] = np.where(ok, win(cANY, d_idx, col, 3), np.nan)
    stA = np.zeros((len(st_codes), nm))
    for s in range(len(st_codes)):
        stA[s] = A[st_idx == s].sum(0)
    natA = A.sum(0)
    natANY = ANY.sum(0)
    cc_ = np.clip(col, 0, nm - 1)
    f["rc_state_1"] = np.where(ok, stA[st_idx[d_idx], cc_] / nds[st_idx[d_idx]], np.nan)
    f["rc_nat_1"] = np.where(ok, natA[cc_], np.nan)
    cnat = np.concatenate([[0], np.cumsum(natANY)])
    f["rc_nat_any_3"] = np.where(ok, cnat[np.clip(col + 1, 0, nm)] - cnat[np.clip(col - 2, 0, nm)], np.nan)
    return f
