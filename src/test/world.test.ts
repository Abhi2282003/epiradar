import { describe, expect, it } from 'vitest';
import { BASE_LAYERS, OVERLAYS, backtestCounts, bandFromProb, dataStopsEarly, gridPoints, latestDate, layerDate, makeField, nearestCells, normIsoNum, per100k, tileUrl, windUV, type GridCell } from '@/lib/world';
import { validateContext } from '@/lib/epiradar';

const cell = (lat: number, lon: number, v: number): GridCell => ({ lat, lon, temp_c: v, rh: null, precip_mm: null, cloud_cover: v, wind_speed: null, wind_dir: null, updated_at: null });

describe('world grid', () => {
  it('covers lat -70..80 and lon -180..170 at 10 degrees (576 cells)', () => {
    const pts = gridPoints();
    expect(pts).toHaveLength(576);
    expect(Math.min(...pts.map(p => p.lat))).toBe(-70);
    expect(Math.max(...pts.map(p => p.lat))).toBe(80);
    expect(Math.max(...pts.map(p => p.lon))).toBe(170);
  });
  it('converts a wind from the north into a southward v', () => {
    const { u, v } = windUV(10, 0);
    expect(u).toBeCloseTo(0); expect(v).toBeCloseTo(-10);
  });
  it('interpolates bilinearly and wraps the dateline', () => {
    const f = makeField([cell(0, 0, 0), cell(0, 10, 10), cell(10, 0, 20), cell(10, 10, 30), cell(0, 170, 100), cell(0, -180, 0), cell(10, 170, 100), cell(10, -180, 0)], c => c.temp_c);
    expect(f.get(5, 5)).toBeCloseTo(15);
    expect(f.get(0, 175)).toBeCloseTo(50);
    expect(f.get(85, 0)).toBeNull();
  });
  it('returns null where a neighbour is missing', () => {
    expect(makeField([cell(0, 0, 1)], c => c.temp_c).get(5, 5)).toBeNull();
  });
  it('finds the nearest cell across the dateline', () => {
    expect(nearestCells([cell(0, 170, 1), cell(0, -180, 2), cell(0, 0, 3)], 0, 179, 1)[0]!.lon).toBe(-180);
  });
});

describe('GIBS layers', () => {
  it('builds the verified WMTS EPSG:3857 URL with date', () => {
    const lst = OVERLAYS.find(o => o.key === 'lst')!;
    expect(tileUrl(lst, '2026-10-08')).toBe('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2026-10-08/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png');
  });
  it('omits time for undated layers', () => {
    expect(tileUrl(OVERLAYS.find(o => o.key === 'pop')!, null)).not.toContain('/default/default');
  });
  it('defaults a daily layer to today minus its lag and clamps picked dates', () => {
    const soil = OVERLAYS.find(o => o.key === 'soil')!;
    expect(latestDate(soil, '2026-10-20')).toBe('2026-10-17');
    expect(layerDate(soil, '2026-10-20', '2030-01-01')).toBe('2026-10-17');
    expect(layerDate(soil, '2026-10-20', '2020-01-01')).toBe(soil.start);
  });
  it('keeps Black Marble on its fixed 2016 date', () => {
    expect(latestDate(BASE_LAYERS.find(b => b.key === 'night')!, '2026-10-20')).toBe('2016-01-01');
  });
});

describe('country metrics', () => {
  it('uses the app risk bands for outbreak probability', () => {
    expect(bandFromProb(0.19)).toBe('Low'); expect(bandFromProb(0.2)).toBe('Moderate');
    expect(bandFromProb(0.4)).toBe('High'); expect(bandFromProb(0.7)).toBe('Very high'); expect(bandFromProb(null)).toBe('No data');
  });
  it('computes cases per 100k and refuses unknown population', () => {
    expect(per100k(500, 1_000_000)).toBe(50); expect(per100k(500, null)).toBeNull();
  });
  it('joins ISO numeric codes regardless of zero padding', () => {
    expect(normIsoNum('076')).toBe(normIsoNum(76));
  });
  it('scores backtests and skips incomplete rows', () => {
    expect(backtestCounts([{ outbreak_prob: 0.8, outbreak_actual: true }, { outbreak_prob: 0.1, outbreak_actual: true }, { outbreak_prob: 0.5, outbreak_actual: false }, { outbreak_prob: 0.1, outbreak_actual: false }, { outbreak_prob: null, outbreak_actual: true }], 0.4))
      .toEqual({ hits: 1, misses: 1, falseAlarms: 1, correctQuiet: 1, scored: 4 });
  });
  it('flags data that stops before last month', () => {
    expect(dataStopsEarly('2025-03-01', '2026-10-09')).toBe(true);
    expect(dataStopsEarly('2026-09-01', '2026-10-09')).toBe(false);
  });
  it('keeps a valid country code in the URL context', () => {
    expect(validateContext({ country: 'BRA' }).country).toBe('BRA');
    expect(validateContext({ country: 'bra' }).country).toBeUndefined();
  });
});
