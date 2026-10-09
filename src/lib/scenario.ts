import { riskFromProbability } from './replay';

export type ScenarioRow = { region_id: string; rain_delta_pct: number; temp_delta_c: number; horizon_weeks: number; outbreak_prob: number | null };

/** Distinct, sorted steps actually present in the data — never assumed. */
export function scenarioSteps(rows: Pick<ScenarioRow, 'rain_delta_pct' | 'temp_delta_c'>[]) {
  const uniq = (v: number[]) => [...new Set(v.map(x => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
  return { rain: uniq(rows.map(r => r.rain_delta_pct)), temp: uniq(rows.map(r => r.temp_delta_c)) };
}
export const snap = (steps: number[], value: number) => steps.length ? steps.reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a) : value;
const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;
export const findProb = (rows: ScenarioRow[], rain: number, temp: number, horizon: number) =>
  rows.find(r => same(r.rain_delta_pct, rain) && same(r.temp_delta_c, temp) && r.horizon_weeks === horizon)?.outbreak_prob ?? null;

/** Scenario vs no-change: difference in percentage points and whether the risk band moves. */
export function compareScenario(scenario: number | null, baseline: number | null) {
  const from = riskFromProbability(baseline), to = riskFromProbability(scenario);
  return { deltaPp: scenario == null || baseline == null ? null : Math.round((scenario - baseline) * 100), from, to, bandChanged: from != null && to != null && from !== to };
}
export const atHighOrAbove = (probs: (number | null)[]) => probs.filter(p => p != null && p >= 0.4).length;
export const formatDelta = (v: number, unit: '%' | '°C') => `${v > 0 ? '+' : ''}${v}${unit === '%' ? '%' : ' °C'}`;
