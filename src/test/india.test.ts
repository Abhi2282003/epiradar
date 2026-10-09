import { describe, expect, it } from 'vitest';
import { aedesTemp, anophelesTemp, binOf, cfr, chunk, defaultYear, humidityFactor, isStale, moistureFactor, quantileBreaks, suitability } from '@/lib/india';
import { DICTS, formatIN } from '@/lib/i18n';

describe('suitability formulas', () => {
  it('Aedes peaks at 29 °C and is 0 outside 17–35', () => { expect(aedesTemp(29)).toBe(1); expect(aedesTemp(16.9)).toBe(0); expect(aedesTemp(35.1)).toBe(0); });
  it('Anopheles peaks at 25 °C and is 0 outside 16–34', () => { expect(anophelesTemp(25)).toBe(1); expect(anophelesTemp(15)).toBe(0); expect(anophelesTemp(35)).toBe(0); });
  it('moisture saturates at 50 mm', () => { expect(moistureFactor(0)).toBeCloseTo(0.4); expect(moistureFactor(50)).toBe(1); expect(moistureFactor(200)).toBe(1); });
  it('humidity ranges 0.5 to 1 between 40 and 80 %', () => { expect(humidityFactor(40)).toBe(0.5); expect(humidityFactor(80)).toBe(1); });
  it('missing inputs give no value, not zero', () => expect(suitability('aedes', 29, null, 80)).toBeNull());
  it('ideal conditions give 1', () => expect(suitability('aedes', 29, 60, 85)).toBe(1));
});

describe('year selection', () => {
  it('defaults to the latest complete year', () => expect(defaultYear([{ year: 2023, note: null }, { year: 2024, note: 'Provisional up to Oct' }], 2026)).toBe(2023));
  it('treats the current year as partial', () => expect(defaultYear([{ year: 2025, note: null }, { year: 2026, note: null }], 2026)).toBe(2025));
});

describe('helpers', () => {
  it('batches 100 per request', () => expect(chunk(Array.from({ length: 250 }), 100).map(c => c.length)).toEqual([100, 100, 50]));
  it('CFR is deaths per 100 cases', () => { expect(cfr(1000, 5)).toBe(0.5); expect(cfr(0, 1)).toBeNull(); });
  it('weather older than 36 h is stale', () => { const now = Date.parse('2026-01-02T12:00:00Z'); expect(isStale('2026-01-01T00:00:00Z', now)).toBe(true); expect(isStale('2026-01-01T12:00:00Z', now)).toBe(false); });
  it('bins missing values as no data', () => { const b = quantileBreaks([1, 2, 3, 4, 5]); expect(binOf(null, b)).toBe(-1); expect(binOf(5, b)).toBe(4); });
  it('uses Indian digit grouping', () => expect(formatIN(1234567)).toBe('12,34,567'));
});

describe('dictionaries', () => {
  it('Hindi and Marathi translate every English key', () => {
    for (const lang of ['hi', 'mr'] as const) for (const [k, v] of Object.entries(DICTS[lang])) { expect(v, `${lang}.${k}`).toBeTruthy(); }
    expect(Object.keys(DICTS.hi).sort()).toEqual(Object.keys(DICTS.en).sort());
    expect(Object.keys(DICTS.mr).sort()).toEqual(Object.keys(DICTS.en).sort());
  });
});
