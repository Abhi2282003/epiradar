/** Browser-safe World workspace helpers: verified GIBS layer config, grid interpolation and country metrics. */
import { RISK_SCALE } from '@/lib/epiradar';

export const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

export type RasterLayer = {
  key: string; id: string; title: string; tms: string; ext: 'png' | 'jpg'; maxzoom: number;
  /** daily: one image per day; fixed: a single dated image; none: no time dimension */
  time: 'daily' | 'fixed' | 'none';
  /** First date in WMTSCapabilities (daily) or the only date (fixed). */
  start?: string;
  /** Latest date seen in WMTSCapabilities when verified on 2026-10-09. */
  verifiedLatest?: string;
  /** Days behind today that the newest complete image usually is. */
  lagDays?: number;
  units?: string; legend?: string; source: string;
  url?: string;
};

// Verified against https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml on 2026-10-09
// (identifier, TileMatrixSet, format and date range) and by fetching one tile of each.
export const BASE_LAYERS: RasterLayer[] = [
  { key: 'truecolor', id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', title: 'Satellite true colour', tms: 'GoogleMapsCompatible_Level9', ext: 'jpg', maxzoom: 9, time: 'daily', start: '2026-07-16', verifiedLatest: '2026-10-09', lagDays: 1, source: 'NASA GIBS · VIIRS Suomi NPP corrected reflectance' },
  { key: 'night', id: 'VIIRS_Black_Marble', title: 'Night lights', tms: 'GoogleMapsCompatible_Level8', ext: 'png', maxzoom: 8, time: 'fixed', start: '2016-01-01', verifiedLatest: '2016-01-01', source: 'NASA GIBS · VIIRS Black Marble (2016 composite)' },
];
export const OVERLAYS: RasterLayer[] = [
  { key: 'precip', id: 'IMERG_Precipitation_Rate', title: 'Precipitation', tms: 'GoogleMapsCompatible_Level6', ext: 'png', maxzoom: 6, time: 'daily', start: '2026-05-27', verifiedLatest: '2026-10-08', lagDays: 1, units: 'mm/hr', legend: 'https://gibs.earthdata.nasa.gov/legends/GPM_Precipitation_Rate_H.svg', source: 'NASA GIBS · GPM IMERG precipitation rate' },
  { key: 'lst', id: 'MODIS_Terra_Land_Surface_Temp_Day', title: 'Land surface temperature', tms: 'GoogleMapsCompatible_Level7', ext: 'png', maxzoom: 7, time: 'daily', start: '2022-10-23', verifiedLatest: '2026-10-09', lagDays: 1, units: 'K', legend: 'https://gibs.earthdata.nasa.gov/legends/MODIS_Land_Surface_Temp_H.svg', source: 'NASA GIBS · MODIS Terra LST (day)' },
  { key: 'ndvi', id: 'MODIS_Terra_NDVI_8Day', title: 'Vegetation (NDVI)', tms: 'GoogleMapsCompatible_Level9', ext: 'png', maxzoom: 9, time: 'daily', start: '2026-02-10', verifiedLatest: '2026-10-08', lagDays: 1, units: 'NDVI (−1 to 1), rolling 8-day', legend: 'https://gibs.earthdata.nasa.gov/legends/MODIS_NDVI_H.svg', source: 'NASA GIBS · MODIS Terra NDVI 8-day' },
  { key: 'soil', id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture', title: 'Soil moisture', tms: 'GoogleMapsCompatible_Level6', ext: 'png', maxzoom: 6, time: 'daily', start: '2026-09-01', verifiedLatest: '2026-10-06', lagDays: 3, units: 'm³/m³', legend: 'https://gibs.earthdata.nasa.gov/legends/SMAP_Analyzed_Soil_Moisture_H.svg', source: 'NASA GIBS · SMAP L4 surface soil moisture' },
  { key: 'clouds', id: 'MODIS_Terra_Cloud_Fraction_Day', title: 'Clouds', tms: 'GoogleMapsCompatible_Level6', ext: 'png', maxzoom: 6, time: 'daily', start: '2024-05-03', verifiedLatest: '2026-10-09', lagDays: 1, units: '% cloud fraction', legend: 'https://gibs.earthdata.nasa.gov/legends/MODIS_Cloud_Fraction_H.svg', source: 'NASA GIBS · MODIS Terra cloud fraction (day)' },
  { key: 'flood', id: 'MODIS_Combined_Flood_2-Day', title: 'Floods', tms: 'GoogleMapsCompatible_Level9', ext: 'png', maxzoom: 9, time: 'daily', start: '2025-07-29', verifiedLatest: '2026-10-09', lagDays: 1, units: 'water classification', legend: 'https://gibs.earthdata.nasa.gov/legends/MODIS_Flood_H.svg', source: 'NASA GIBS · MODIS combined flood, 2-day window' },
  { key: 'pop', id: 'GPW_Population_Density_2020', title: 'Population density', tms: 'GoogleMapsCompatible_Level7', ext: 'png', maxzoom: 7, time: 'none', units: 'persons / km²', legend: 'https://gibs.earthdata.nasa.gov/legends/GPW_Population_Density_2020_H.svg', source: 'NASA GIBS · SEDAC GPWv4, 2020' },
  { key: 'water', id: 'jrc-occurrence', title: 'Surface water occurrence', tms: '', ext: 'png', maxzoom: 13, time: 'none', units: '% of months with water, 1984–2021', source: 'EC JRC / Google · Global Surface Water 2021', url: 'https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png' },
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(date: string, days: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return isoDate(d); }
/** Latest date we expect to be complete for a layer, never earlier than the verified capability date. */
export function latestDate(layer: RasterLayer, today: string) {
  if (layer.time === 'fixed') return layer.start ?? null;
  if (layer.time !== 'daily') return null;
  const expected = addDays(today, -(layer.lagDays ?? 1));
  return layer.verifiedLatest && layer.verifiedLatest > expected ? layer.verifiedLatest : expected;
}
/** The date a layer should display: the picked date clamped to the layer's range, or its latest. */
export function layerDate(layer: RasterLayer, today: string, picked: string | null) {
  const latest = latestDate(layer, today);
  if (layer.time !== 'daily' || !latest || !picked) return latest;
  if (picked > latest) return latest;
  if (layer.start && picked < layer.start) return layer.start;
  return picked;
}
export function tileUrl(layer: RasterLayer, date: string | null) {
  if (layer.url) return layer.url;
  const time = layer.time === 'none' ? '' : `/${date ?? 'default'}`;
  return `${GIBS_BASE}/${layer.id}/default${time}/${layer.tms}/{z}/{y}/{x}.${layer.ext}`;
}

// ---- Weather grid ----
export type GridCell = { lat: number; lon: number; temp_c: number | null; rh: number | null; precip_mm: number | null; cloud_cover: number | null; wind_speed: number | null; wind_dir: number | null; updated_at: string | null };
export const GRID_STEP = 10;
/** Display bins (km/h) for wind colour. */
export const WIND_BINS = [10, 25, 45];
export const GRID_LATS = Array.from({ length: 16 }, (_, i) => -70 + i * GRID_STEP);
export const GRID_LONS = Array.from({ length: 36 }, (_, i) => -180 + i * GRID_STEP);
export const gridPoints = () => GRID_LATS.flatMap(lat => GRID_LONS.map(lon => ({ lat, lon })));
/** Meteorological direction (where wind comes FROM) to u/v components in the same speed unit. */
export function windUV(speed: number, dirDeg: number) { const r = (dirDeg * Math.PI) / 180; return { u: -speed * Math.sin(r), v: -speed * Math.cos(r) }; }

export type GridField = { get: (lat: number, lon: number) => number | null };
/** Bilinear interpolation over the regular 10° grid; longitude wraps, outside the latitude band returns null. */
export function makeField(cells: GridCell[], pick: (c: GridCell) => number | null): GridField {
  const values = new Map<string, number>();
  for (const c of cells) { const v = pick(c); if (v != null && Number.isFinite(v)) values.set(`${Math.round(c.lat)}|${Math.round(c.lon)}`, v); }
  const at = (lat: number, lon: number) => values.get(`${lat}|${lon}`);
  return { get(lat, lon) {
    const minLat = GRID_LATS[0]!, maxLat = GRID_LATS[GRID_LATS.length - 1]!;
    if (lat < minLat || lat > maxLat || !Number.isFinite(lon)) return null;
    const x = ((((lon + 180) % 360) + 360) % 360) / GRID_STEP;
    const y = (lat - minLat) / GRID_STEP;
    const x0 = Math.floor(x), y0 = Math.min(Math.floor(y), GRID_LATS.length - 2);
    const fx = x - x0, fy = y - y0;
    const lon0 = -180 + (x0 % 36) * GRID_STEP, lon1 = -180 + ((x0 + 1) % 36) * GRID_STEP;
    const lat0 = minLat + y0 * GRID_STEP, lat1 = lat0 + GRID_STEP;
    const q = [at(lat0, lon0), at(lat0, lon1), at(lat1, lon0), at(lat1, lon1)];
    if (q.some(v => v == null)) return null;
    const [a, b, c, d] = q as number[];
    return a! * (1 - fx) * (1 - fy) + b! * fx * (1 - fy) + c! * (1 - fx) * fy + d! * fx * fy;
  } };
}
export function nearestCells(cells: GridCell[], lat: number, lon: number, n = 4) {
  const dist = (c: GridCell) => { const dLon = Math.abs(((c.lon - lon + 540) % 360) - 180) * Math.cos((lat * Math.PI) / 180); return Math.hypot(c.lat - lat, dLon); };
  return [...cells].sort((a, b) => dist(a) - dist(b)).slice(0, n);
}

// ---- Countries ----
export const normIsoNum = (v: unknown) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? String(n) : null; };
export function bandFromProb(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return RISK_SCALE[4].label;
  if (p >= 0.7) return RISK_SCALE[3].label;
  if (p >= 0.4) return RISK_SCALE[2].label;
  if (p >= 0.2) return RISK_SCALE[1].label;
  return RISK_SCALE[0].label;
}
export function per100k(cases: number | null | undefined, population: number | null | undefined) {
  if (cases == null || population == null || !(population > 0)) return null;
  return (cases / population) * 100_000;
}
/** Display bins (per 100k) for the cases choropleth. */
export const INCIDENCE_BINS = [10, 100, 500, 1000];
export function incidenceBin(v: number | null) { if (v == null) return -1; let i = 0; while (i < INCIDENCE_BINS.length && v >= INCIDENCE_BINS[i]!) i++; return i; }
export function backtestCounts(rows: { outbreak_prob: number | null; outbreak_actual: boolean | null }[], cutoff: number) {
  let hits = 0, misses = 0, falseAlarms = 0, correctQuiet = 0;
  for (const r of rows) {
    if (r.outbreak_prob == null || r.outbreak_actual == null) continue;
    const alert = r.outbreak_prob >= cutoff;
    if (alert && r.outbreak_actual) hits++; else if (!alert && r.outbreak_actual) misses++; else if (alert) falseAlarms++; else correctQuiet++;
  }
  return { hits, misses, falseAlarms, correctQuiet, scored: hits + misses + falseAlarms + correctQuiet };
}
export const monthLabel = (d: string | null | undefined) => {
  if (!d) return '—';
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t.getTime()) ? t.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
};
/** True when the latest month is earlier than the month before today. */
export function dataStopsEarly(last: string | null | undefined, today: string) {
  if (!last) return false;
  const [y, m] = today.split('-').map(Number);
  const prev = new Date(Date.UTC(y!, m! - 2, 1)).toISOString().slice(0, 7);
  return last.slice(0, 7) < prev;
}
export type Driver = { family: string | null; label: string | null; contribution: number | null };
export function parseDrivers(v: unknown): Driver[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap(d => d && typeof d === 'object' ? [{ family: typeof d.family === 'string' ? d.family : null, label: typeof d.label === 'string' ? d.label : null, contribution: typeof d.contribution === 'number' ? d.contribution : null }] : []);
}
