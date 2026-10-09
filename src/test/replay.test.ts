import { describe, expect, it } from 'vitest';
import { municipalityLead, riskFromProbability, scorecard, type BacktestRow } from '@/lib/replay';

const row = (week: string, prob: number, actual: boolean, cases = 0): BacktestRow => ({ region_id: 'A', target_week: week, outbreak_prob: prob, outbreak_actual: actual, cases_actual: cases, threshold_cases: 10 });

describe('replay scorecard rules', () => {
  it('risk bands from probability', () => {
    expect([0.1, 0.2, 0.4, 0.7].map(riskFromProbability)).toEqual(['Low', 'Moderate', 'High', 'Very high']);
  });
  it('week-level hits, misses and false alarms use the 0.4 cut-off', () => {
    const s = scorecard([row('2024-01-07', 0.4, true), row('2024-01-14', 0.39, true), row('2024-01-21', 0.5, false)]);
    expect([s.hits, s.misses, s.falseAlarms]).toEqual([1, 1, 1]);
  });
  it('issue date is the earliest alert within 8 weeks of onset minus 4 weeks', () => {
    const lead = municipalityLead([row('2024-01-07', 0.5, false), row('2024-01-14', 0.1, false), row('2024-01-21', 0.2, true, 5), row('2024-03-03', 0.2, true, 50)]);
    expect(lead.issue).toBe('2023-12-10');
    expect(lead.leadToOnset).toBe(6);
    expect(lead.leadToPeak).toBe(12);
  });
  it('an alert older than 8 weeks before onset does not count', () => {
    expect(municipalityLead([row('2024-01-07', 0.5, false), row('2024-03-03', 0.1, true)]).issue).toBeNull();
  });
  it('municipality alerted without any outbreak is a false-alarm municipality', () => {
    expect(scorecard([row('2024-01-07', 0.6, false)]).falseAlarmMunicipalities).toBe(1);
  });
});
