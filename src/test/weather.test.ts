import { describe, expect, it } from 'vitest';
import { aggregateWeather, tempSuitability, weatherSentence } from '@/lib/weather';

describe('tempSuitability', () => {
  it('is 0 at 16 °C', () => expect(tempSuitability(16)).toBe(0));
  it('is 1 at 29 °C', () => expect(tempSuitability(29)).toBe(1));
  it('is 0 at 36 °C', () => expect(tempSuitability(36)).toBe(0));
  it('is under 1 at 32 °C', () => { expect(tempSuitability(32)).toBeLessThan(1); expect(tempSuitability(32)).toBeCloseTo(Math.exp(-1), 10); });
  it('uses the wider curve below 29 °C', () => expect(tempSuitability(23)).toBeCloseTo(Math.exp(-1), 10));
});

describe('aggregateWeather', () => {
  // 28 past days (rain 1 mm each, tmean 25) then 16 forecast days (rain 2 mm, tmean 29)
  const time = Array.from({ length: 44 }, (_, i) => new Date(Date.UTC(2026, 8, 11 + i)).toISOString().slice(0, 10));
  const today = time[28]!;
  const past = (a: number, b: number) => time.map((_, i) => i < 28 ? a : b);
  const agg = aggregateWeather({
    time, precipitation_sum: past(1, 2), temperature_2m_mean: past(25, 29), temperature_2m_max: past(30, 33),
    temperature_2m_min: past(20, 24), relative_humidity_2m_mean: past(80, 70),
  }, today);
  it('sums observed rain over 7 and 28 days, excluding today', () => { expect(agg.rain_7d_mm).toBe(7); expect(agg.rain_28d_mm).toBe(28); });
  it('averages the last 7 observed days', () => { expect(agg.tmean_7d).toBe(25); expect(agg.tmax_7d).toBe(30); expect(agg.rh_7d).toBe(80); });
  it('derives suitability from the 7-day mean', () => expect(agg.tsuit_7d).toBeCloseTo(tempSuitability(25)!, 3));
  it('treats today onward as the 16-day forecast', () => { expect(agg.fc_rain_16d_mm).toBe(32); expect(agg.fc_tmean_16d).toBe(29); expect(agg.fc_tsuit_16d).toBe(1); });
  it('flags forecast days', () => { expect(agg.daily.filter(d => d.forecast)).toHaveLength(16); expect(agg.daily[27]!.forecast).toBe(false); });
  it('ignores missing values rather than counting them as zero', () => {
    const a = aggregateWeather({ time: time.slice(0, 29), precipitation_sum: time.slice(0, 29).map(() => null) }, today);
    expect(a.rain_7d_mm).toBeNull();
    expect(a.tsuit_7d).toBeNull();
  });
});

describe('weatherSentence', () => {
  it('says warm and wet at suitability 0.7 and >100 mm', () => expect(weatherSentence({ tsuit_7d: 0.7, fc_tsuit_16d: null, rain_28d_mm: 101 })).toMatch(/^Warm and wet/));
  it('is not wet at exactly 100 mm', () => expect(weatherSentence({ tsuit_7d: 0.9, fc_tsuit_16d: 0.9, rain_28d_mm: 100 })).toMatch(/^Warm but fairly dry/));
});
