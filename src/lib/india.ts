/** Browser-safe India helpers: climate suitability, Open-Meteo aggregation, batching, year logic and bins. */

export const INDIA_DISEASES = ['dengue', 'chikungunya', 'malaria'] as const;
export type IndiaDisease = (typeof INDIA_DISEASES)[number];
export const isIndiaDisease = (v: unknown): v is IndiaDisease => typeof v === 'string' && (INDIA_DISEASES as readonly string[]).includes(v);
/** Which vector's suitability colours the district dots for each disease. */
export const VECTOR_FOR: Record<IndiaDisease, 'aedes' | 'anopheles'> = { dengue: 'aedes', chikungunya: 'aedes', malaria: 'anopheles' };
export const FAVOURABLE = 0.5;
export const STALE_HOURS = 36;
export const OPEN_METEO_BATCH = 100;
export const INDIA_BOUNDS: [[number, number], [number, number]] = [[68, 6], [98, 37.5]];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Aedes temperature factor: 0 outside 17–35 °C, Gaussian around 29 °C (σ 6 below, 3 above). */
export function aedesTemp(t: number | null | undefined) {
  if (!ok(t)) return null;
  if (t < 17 || t > 35) return 0;
  return Math.exp(-(((t - 29) / (t < 29 ? 6 : 3)) ** 2));
}
/** Anopheles temperature factor (after Mordecai et al. 2013): 0 outside 16–34 °C, peak 25 °C (σ 5 below, 4 above). */
export function anophelesTemp(t: number | null | undefined) {
  if (!ok(t)) return null;
  if (t < 16 || t > 34) return 0;
  return Math.exp(-(((t - 25) / (t < 25 ? 5 : 4)) ** 2));
}
export const moistureFactor = (rain14: number | null | undefined) => ok(rain14) ? 0.4 + 0.6 * Math.min(1, Math.max(0, rain14) / 50) : null;
export const humidityFactor = (rh: number | null | undefined) => ok(rh) ? 0.5 + 0.5 * clamp((rh - 40) / 40, 0, 1) : null;
export function suitability(vector: 'aedes' | 'anopheles', t: number | null | undefined, rain14: number | null | undefined, rh: number | null | undefined) {
  const tf = vector === 'aedes' ? aedesTemp(t) : anophelesTemp(t);
  const m = moistureFactor(rain14), h = humidityFactor(rh);
  if (tf == null || m == null || h == null) return null;
  return tf * m * h;
}
export const SUITABILITY_FORMULAS = [
  'Aedes (dengue, chikungunya): 0 if T < 17 or T > 35 °C; else exp(−((T−29)/6)²) for T < 29, exp(−((T−29)/3)²) for T ≥ 29',
  'Anopheles (malaria, after Mordecai et al. 2013): 0 if T < 16 or T > 34 °C; else exp(−((T−25)/5)²) for T < 25, exp(−((T−25)/4)²) for T ≥ 25',
  'moisture = 0.4 + 0.6 · min(1, rain_14d / 50 mm); humidity = 0.5 + 0.5 · clamp((RH − 40) / 40, 0, 1)',
  'suitability = temperature factor × moisture × humidity (0–1); favourable means ≥ 0.5. T = 7-day mean temperature.',
] as const;

export function chunk<T>(items: T[], size: number): T[][] {
  if (!(size >= 1)) throw new Error('Batch size must be at least 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type IndiaDaily = {
  time?: string[]; temperature_2m_mean?: (number | null)[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[];
  relative_humidity_2m_mean?: (number | null)[]; precipitation_sum?: (number | null)[]; wind_speed_10m_max?: (number | null)[];
  wind_direction_10m_dominant?: (number | null)[]; cloud_cover_mean?: (number | null)[];
};
export const INDIA_DAILY_VARS = 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,cloud_cover_mean';
const round = (v: number | null, d = 2) => v == null ? null : Math.round(v * 10 ** d) / 10 ** d;
const mean = (xs: (number | null | undefined)[]) => { const v = xs.filter(ok); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const sum = (xs: (number | null | undefined)[]) => { const v = xs.filter(ok); return v.length ? v.reduce((a, b) => a + b, 0) : null; };

/** Last 7 complete days (14 for rain_14d), next 7 days from today, and today's wind/cloud. Missing values stay null. */
export function aggregateIndia(d: IndiaDaily, today: string) {
  const time = d.time ?? [];
  const idx = time.map((t, i) => ({ t, i }));
  const past = idx.filter(x => x.t < today).map(x => x.i);
  const next = idx.filter(x => x.t >= today).map(x => x.i).slice(0, 7);
  const p7 = past.slice(-7), p14 = past.slice(-14);
  const pick = (arr: (number | null)[] | undefined, ids: number[]) => ids.map(i => arr?.[i] ?? null);
  const t = mean(pick(d.temperature_2m_mean, p7));
  const rh = mean(pick(d.relative_humidity_2m_mean, p7));
  const r14 = sum(pick(d.precipitation_sum, p14));
  const todayIdx = next[0];
  const at = (arr: (number | null)[] | undefined) => todayIdx == null ? null : ok(arr?.[todayIdx]) ? arr![todayIdx]! : null;
  return {
    as_of: today,
    temp_mean_7d: round(t), temp_max_7d: round(mean(pick(d.temperature_2m_max, p7))), temp_min_7d: round(mean(pick(d.temperature_2m_min, p7))),
    humidity_7d: round(rh), rain_7d_mm: round(sum(pick(d.precipitation_sum, p7))), rain_14d_mm: round(r14),
    rain_next7d_mm: round(sum(pick(d.precipitation_sum, next))), temp_next7d: round(mean(pick(d.temperature_2m_mean, next))),
    wind_speed_max: round(at(d.wind_speed_10m_max)), wind_dir_deg: round(at(d.wind_direction_10m_dominant), 0), cloud_cover: round(at(d.cloud_cover_mean), 0),
    aedes_suitability: round(suitability('aedes', t, r14, rh), 3), anopheles_suitability: round(suitability('anopheles', t, r14, rh), 3),
  };
}
export const indiaToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

/** A year is partial when its note says so (provisional / up to / till) or it is the current calendar year. */
export const isPartialNote = (note: string | null | undefined) => !!note && /provisional|up to|upto|till|until|partial/i.test(note);
export function yearsInfo(rows: { year: number; note: string | null }[], currentYear: number) {
  const years = [...new Set(rows.map(r => r.year))].sort((a, b) => a - b);
  const partial = new Set(years.filter(y => y >= currentYear || rows.some(r => r.year === y && isPartialNote(r.note))));
  return { years, partial };
}
/** Latest complete year; only falls back to a partial year when every year is partial. */
export function defaultYear(rows: { year: number; note: string | null }[], currentYear: number) {
  const { years, partial } = yearsInfo(rows, currentYear);
  const complete = years.filter(y => !partial.has(y));
  return complete.length ? complete[complete.length - 1]! : years[years.length - 1] ?? null;
}

/** Quantile breaks (n classes → n−1 breaks) over finite values; duplicates removed. */
export function quantileBreaks(values: (number | null | undefined)[], classes = 5) {
  const v = values.filter(ok).sort((a, b) => a - b);
  if (!v.length) return [];
  const out: number[] = [];
  for (let k = 1; k < classes; k++) { const q = v[Math.min(v.length - 1, Math.floor((k / classes) * v.length))]!; if (!out.length || q > out[out.length - 1]!) out.push(q); }
  return out;
}
export function binOf(v: number | null | undefined, breaks: number[]) { if (!ok(v)) return -1; let i = 0; while (i < breaks.length && v >= breaks[i]!) i++; return i; }
export function cfr(cases: number | null | undefined, deaths: number | null | undefined) { return ok(cases) && ok(deaths) && cases > 0 ? (deaths / cases) * 100 : null; }
export function isStale(updatedAt: string | null | undefined, now = Date.now()) {
  if (!updatedAt) return true; const t = Date.parse(updatedAt); return !Number.isFinite(t) || now - t > STALE_HOURS * 3_600_000;
}
/** Monday of the ISO week containing the date (UTC). */
export function weekStart(date: string) {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10);
}
export const FOCUS = [
  { key: 'india', kind: 'bounds' as const },
  { key: 'IN-MH', kind: 'state' as const },
  { key: 'IN-D521', kind: 'district' as const, zoom: 9 },
  { key: 'IN-D519', kind: 'district' as const, zoom: 10 },
  { key: 'IN-DL', kind: 'districts-of' as const },
  { key: 'IN-KL', kind: 'state' as const },
  { key: 'IN-KA', kind: 'state' as const },
];
export const PUNE = 'IN-D521';
export const MAHARASHTRA = 'IN-MH';
export const KARNATAKA = 'IN-KA';

/** Parse the ICTS CSV and sum daily counts into Monday-starting weeks per district. */
export function weeklyFromCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const head = (lines.shift() ?? '').split(',').map(h => h.replace(/"/g, '').trim());
  const iDate = head.indexOf('metadata.recordDate'), iName = head.indexOf('location.admin2.name');
  const iPos = head.indexOf('daily_positive_total'), iDeath = head.indexOf('daily_deaths');
  if ([iDate, iName, iPos, iDeath].some(i => i < 0)) throw new Error('Unexpected ICTS columns');
  const weeks = new Map<string, { district_name: string; week_start: string; cases: number; deaths: number }>();
  let lastDate = '';
  for (const line of lines) {
    const c = line.split(',').map(s => s.replace(/"/g, '').trim());
    const date = c[iDate] ?? '', name = c[iName] ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) continue;
    const pos = Number(c[iPos]), death = Number(c[iDeath]);
    const key = `${name}|${weekStart(date)}`;
    const w = weeks.get(key) ?? { district_name: name, week_start: weekStart(date), cases: 0, deaths: 0 };
    if (Number.isFinite(pos)) w.cases += pos; if (Number.isFinite(death)) w.deaths += death;
    weeks.set(key, w); if (date > lastDate) lastDate = date;
  }
  return { rows: [...weeks.values()], lastDate };
}

