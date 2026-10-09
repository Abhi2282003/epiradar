import { describe, expect, it } from 'vitest';
import { commandMetrics, fastestBuilding, formatProbability, formatNumber, joinMunicipalities, riskLabel, sortMunicipalities, type Region, type Prediction } from '@/lib/surveillance';
import { validateContext } from '@/lib/epiradar';

// Synthetic inputs are isolated test fixtures and never enter the application.
const region = (id: string, population: number | null): Region => ({ id, population, name: id, country: 'BR', admin1: null, official_code: id, lat: null, lon: null, density: null, rain_2050_pct: null, temp_2050_c: null });
const prediction = (id: string, prob: number, level: string, cases: number | null, horizon = 4): Prediction => ({ id, region_id: id, disease_id: 'dengue', outbreak_prob: prob, risk_level: level, cases_p50: cases, cases_p10: null, cases_p90: null, horizon_weeks: horizon, issue_week: '2026-10-05', model_version: 'test', issued_at: null, target_week: null, narrative: null, threshold_cases: null });
describe('Real-data surveillance rules', () => {
  it('keeps absent predictions empty, never substitutes sample values', () => {
    const rows = joinMunicipalities([region('a', 100)], []);
    expect(rows[0]?.prediction).toBeNull();
    expect(commandMetrics(rows)).toEqual({ elevated: null, population: null, cases: null });
  });
  it('counts High and Very high municipalities and sums their resident population only', () => {
    const rows = joinMunicipalities([region('a', 1000), region('b', 2500), region('c', 500)], [prediction('a', 0.5, 'high', 10), prediction('b', 0.8, 'very_high', 20), prediction('c', 0.1, 'low', 5)]);
    expect(commandMetrics(rows)).toEqual({ elevated: 2, population: 3500, cases: 35 });
  });
  it('leaves incomplete expected-case and population aggregates unavailable', () => {
    const rows = joinMunicipalities([region('a', null)], [prediction('a', 0.5, 'High', null)]);
    expect(commandMetrics(rows)).toEqual({ elevated: 1, population: null, cases: null });
  });
  it('ranks only the five biggest increases from the one-week horizon', () => {
    const regions = Array.from({ length: 7 }, (_, i) => region(String(i), 100));
    const selected = regions.map((r, i) => prediction(r.id, 0.2 + i * 0.1, 'High', 10));
    const first = regions.map(r => prediction(r.id, 0.2, 'Low', 5, 1));
    expect(fastestBuilding(joinMunicipalities(regions, selected), first).map(row => row.region.id)).toEqual(['6', '5', '4', '3', '2']);
  });
  it('does not compare different forecast issue weeks or model versions', () => {
    const rows = joinMunicipalities([region('a', 100)], [prediction('a', 0.8, 'Very high', 20)]);
    expect(fastestBuilding(rows, [{ ...prediction('a', 0.2, 'Low', 10, 1), issue_week: '2026-09-28' }])).toEqual([]);
    expect(fastestBuilding(rows, [{ ...prediction('a', 0.2, 'Low', 10, 1), model_version: 'other' }])).toEqual([]);
  });
  it('sorts real municipality values while retaining no-data rows last', () => {
    const rows = joinMunicipalities([region('a', 100), region('b', 200), region('c', 300)], [prediction('a', 0.2, 'Moderate', 10), prediction('b', 0.8, 'Very high', 20)]);
    expect(sortMunicipalities(rows, 'probability', true).map(row => row.region.id)).toEqual(['b', 'a', 'c']);
  });
  it('formats whole percentages and rounded cases with thousands separators', () => {
    expect(formatProbability(0.456)).toBe('46%');
    expect(formatNumber(12345.6)).toBe('12,346');
    expect(formatProbability(null)).toBe('—');
  });
  it('preserves selected municipality in validated shareable context', () => {
    expect(validateContext({ region: 'BR-3304557', disease: 'Dengue', horizon: 8 }).region).toBe('BR-3304557');
  });
  it('normalizes database risk labels without assigning risk to missing rows', () => {
    expect(riskLabel('very_high')).toBe('Very high');
    expect(riskLabel(null)).toBe('No data');
  });
});