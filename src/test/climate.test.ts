import { describe, expect, it } from 'vitest';
import { ablationReading, climateAblation, driverBars, isClimateFamily, wideLeadTimes } from '@/lib/trust';
import { atHighOrAbove, compareScenario, findProb, scenarioSteps, snap, type ScenarioRow } from '@/lib/scenario';
import { defaultSeason, seasonOf, seasonsOf } from '@/lib/replay';

describe('seasons', () => {
  it('puts 2023-12-31 in the 2024 season', () => expect(seasonOf('2023-12-31')).toBe(2024));
  it('defaults to 2024 when present', () => expect(defaultSeason([2024, 2025])).toBe(2024));
  it('otherwise defaults to the latest', () => expect(defaultSeason([2025, 2026])).toBe(2026));
  it('lists distinct seasons', () => expect(seasonsOf([{ target_week: '2023-12-31' }, { target_week: '2024-07-21' }, { target_week: '2025-03-02' }])).toEqual([2024, 2025]));
});

describe('scenarios', () => {
  const rows: ScenarioRow[] = [-50, 0, 25].flatMap(r => [0, 1].map(t => ({ region_id: 'a', rain_delta_pct: r, temp_delta_c: t, horizon_weeks: 4, outbreak_prob: 0.1 + r / 200 + t * 0.2 })));
  it('reads steps from the data', () => expect(scenarioSteps(rows)).toEqual({ rain: [-50, 0, 25], temp: [0, 1] }));
  it('snaps to the nearest step', () => expect(snap([-50, 0, 25], 20)).toBe(25));
  it('reports pp change and band move', () => {
    const c = compareScenario(findProb(rows, 25, 1, 4), findProb(rows, 0, 0, 4));
    expect(c.deltaPp).toBe(33); expect(c.from).toBe('Low'); expect(c.to).toBe('High'); expect(c.bandChanged).toBe(true);
  });
  it('counts High or above at >= 40%', () => expect(atHighOrAbove([0.39, 0.4, 0.8, null])).toBe(2));
});

describe('climate card keys', () => {
  it('tags climate families only', () => { expect(isClimateFamily('Rainfall')).toBe(true); expect(isClimateFamily('Water')).toBe(true); expect(isClimateFamily('Recent cases here')).toBe(false); });
  it('prefers driver_importance_h4_focus over the 2024 key', () => expect(driverBars({ driver_importance_h4_focus: { Rainfall: 1 }, driver_importance_h4_focus_2024: { Momentum: 2 } })).toEqual([{ label: 'Rainfall', value: 1, climate: true }]));
  it('falls back to training-scope lead times with scope_label', () => expect(wideLeadTimes({ scope_label: 'South-east Brazil', lead_time_h4_training_scope: { with_outbreak: 3 } }).title).toBe('South-east Brazil'));
  it('reads ablation gains honestly', () => {
    const rows = climateAblation({ climate_ablation: [{ h: 1, pr_auc_with_climate: 0.9, pr_auc_without_climate: 0.9 }, { h: 2, pr_auc_with_climate: 0.8, pr_auc_without_climate: 0.801 }, { h: 8, pr_auc_with_climate: 0.63, pr_auc_without_climate: 0.6 }] })!;
    expect(ablationReading(rows)).toBe('Climate adds +0.03 PR-AUC at 8 weeks ahead; no measurable gain at 1–2 weeks.');
  });
  it('says when there is no gain anywhere', () => expect(ablationReading(climateAblation({ climate_ablation: [{ h: 4, pr_auc_with_climate: 0.7, pr_auc_without_climate: 0.71 }] })!)).toMatch(/^No measurable gain/));
});
