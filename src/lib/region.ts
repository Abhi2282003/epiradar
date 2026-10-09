export const RECOMMENDED_ACTIONS: Record<string, string> = {
  Low: 'Continue routine surveillance.',
  Moderate: 'Intensify larval surveys and clean-ups in hotspots.',
  High: 'Start targeted vector control and alert primary care units.',
  'Very high': 'Activate the municipal contingency plan and coordinate with hospitals.',
};
export function estimatedAdmissions(casesP50: number | null | undefined, ratePercent: number | null) {
  if (casesP50 == null || ratePercent == null || !Number.isFinite(ratePercent) || ratePercent < 0) return null;
  return Math.round(casesP50 * ratePercent / 100);
}
export function seasonStats(rows: { week_start: string; cases: number | null }[]) {
  const known = rows.filter((row): row is { week_start: string; cases: number } => row.cases != null);
  if (!known.length) return null;
  const peak = known.reduce((best, row) => row.cases > best.cases ? row : best);
  return { total: known.reduce((sum, row) => sum + row.cases, 0), peakWeek: peak.week_start, peakCases: peak.cases, weeks: known.length, missing: rows.length - known.length };
}
export type ChartPoint = { week: string; cases?: number | null; p50?: number | null; band?: [number, number] | null; threshold?: number | null };
export function buildForecastSeries(
  observations: { week_start: string; cases: number | null; threshold_cases: number | null }[],
  forecasts: { target_week: string | null; cases_p10: number | null; cases_p50: number | null; cases_p90: number | null; threshold_cases: number | null }[],
): ChartPoint[] {
  const past: ChartPoint[] = observations.map(row => ({ week: row.week_start, cases: row.cases, threshold: row.threshold_cases }));
  const future: ChartPoint[] = forecasts.filter(row => row.target_week).map(row => ({
    week: row.target_week as string, p50: row.cases_p50,
    band: row.cases_p10 != null && row.cases_p90 != null ? [row.cases_p10, row.cases_p90] : null,
    threshold: row.threshold_cases,
  }));
  return [...past, ...future].sort((a, b) => a.week.localeCompare(b.week));
}
