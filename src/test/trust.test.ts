import { describe, expect, it } from 'vitest';
import { accuracyReading, alertHistory, cardCutoff, closestToCutoff, driverBars, horizonMetrics, sourceTone } from '@/lib/trust';
import type { BacktestRow } from '@/lib/replay';

const r = (id: string, week: string, prob: number, actual: boolean): BacktestRow => ({ region_id: id, target_week: week, outbreak_prob: prob, outbreak_actual: actual, cases_actual: 1, threshold_cases: 1 });

describe('trust and alert helpers', () => {
  it('missing card keys give null/empty instead of failing', () => {
    expect(cardCutoff(null)).toBeNull();
    expect(horizonMetrics({ metrics_by_horizon: 'x' })).toEqual([]);
    expect(driverBars({})).toEqual([]);
  });
  it('reading compares model with persistence baseline', () => {
    const m = horizonMetrics({ metrics_by_horizon: [{ h: 4, test: { pr_auc: 0.8449 }, baseline_persistence_pr_auc: 0.4988 }] });
    expect(accuracyReading(m, 4)).toBe("4 weeks ahead: PR-AUC 0.84 vs 0.50 for 'same as this week'");
  });
  it('drivers sort descending', () => {
    expect(driverBars({ driver_importance_h4_focus_2024: { A: 0.1, B: 2 } }).map(d => d.label)).toEqual(['B', 'A']);
  });
  it('status tones', () => {
    expect(['ok', 'PENDING', 'degraded', 'error', 'odd'].map(sourceTone)).toEqual(['ok', 'pending', 'degraded', 'error', 'unknown']);
  });
  it('closest to cut-off ranks by probability with pp gap', () => {
    const rows = [0.3, 0.55, null].map((p, i) => ({ id: i, prediction: p == null ? null : { outbreak_prob: p } }));
    expect(closestToCutoff(rows, 0.4).map(c => c.gapPp)).toEqual([15, -10]);
  });
  it('alert history classifies outcomes', () => {
    const h = alertHistory(new Map([
      ['A', [r('A', '2024-01-07', 0.5, false), r('A', '2024-01-21', 0.2, true)]],
      ['B', [r('B', '2024-01-07', 0.1, true)]],
      ['C', [r('C', '2024-01-07', 0.6, false)]],
    ]));
    expect([h.warned, h.unwarned, h.falseAlarms]).toEqual([1, 1, 1]);
  });
});
