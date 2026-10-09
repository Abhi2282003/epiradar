import { describe, expect, it } from 'vitest';
import { estimatedAdmissions, RECOMMENDED_ACTIONS, seasonStats } from '@/lib/region';
describe('region drawer rules', () => {
  it('admissions = P50 × chosen rate', () => { expect(estimatedAdmissions(200, 5)).toBe(10); });
  it('no admissions estimate until a rate is picked', () => { expect(estimatedAdmissions(200, null)).toBeNull(); });
  it('very high risk activates contingency plan', () => { expect(RECOMMENDED_ACTIONS['Very high']).toMatch(/contingency plan/); });
  it('season total and peak ignore missing weeks', () => {
    expect(seasonStats([{ week_start: '2024-01-07', cases: 3 }, { week_start: '2024-01-14', cases: 9 }, { week_start: '2024-01-21', cases: null }])).toMatchObject({ total: 12, peakWeek: '2024-01-14', peakCases: 9, missing: 1 });
  });
});
