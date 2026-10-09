export const ALERT_CUTOFF = 0.4;
export type BacktestRow = { region_id: string; target_week: string; outbreak_prob: number | null; outbreak_actual: boolean | null; cases_actual: number | null; threshold_cases: number | null };

const DAY = 86_400_000;
const t = (week: string) => Date.parse(`${week.slice(0, 10)}T00:00:00Z`);
export const weeksBetween = (from: string, to: string) => Math.round((t(to) - t(from)) / (7 * DAY));
export const shiftWeeks = (week: string, n: number) => new Date(t(week) + n * 7 * DAY).toISOString().slice(0, 10);
export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
export function riskFromProbability(p: number | null | undefined) {
  if (p == null) return null;
  return p < 0.2 ? 'Low' : p < 0.4 ? 'Moderate' : p < 0.7 ? 'High' : 'Very high';
}
const alerted = (r: BacktestRow) => r.outbreak_prob != null && r.outbreak_prob >= ALERT_CUTOFF;

export function byRegion(rows: BacktestRow[]) {
  const map = new Map<string, BacktestRow[]>();
  for (const r of rows) { const list = map.get(r.region_id) ?? []; list.push(r); map.set(r.region_id, list); }
  for (const list of map.values()) list.sort((a, b) => a.target_week.localeCompare(b.target_week));
  return map;
}

export function municipalityLead(rows: BacktestRow[]) {
  const onset = rows.find(r => r.outbreak_actual === true)?.target_week ?? null;
  const known = rows.filter(r => r.cases_actual != null);
  const peak = known.length ? known.reduce((best, r) => (r.cases_actual! > best.cases_actual! ? r : best)) : null;
  const firstAlertWeek = rows.find(alerted)?.target_week ?? null;
  let alertWeek: string | null = null;
  if (onset) alertWeek = rows.find(r => alerted(r) && t(r.target_week) >= t(onset) - 49 * DAY && t(r.target_week) <= t(onset))?.target_week ?? null;
  const issue = alertWeek ? shiftWeeks(alertWeek, -4) : null;
  return {
    onset, alertWeek, issue, firstAlertWeek,
    peakWeek: peak?.target_week ?? null, peakCases: peak?.cases_actual ?? null,
    leadToOnset: issue && onset ? weeksBetween(issue, onset) : null,
    leadToPeak: issue && peak ? weeksBetween(issue, peak.target_week) : null,
    falseAlarm: !onset && !!firstAlertWeek,
  };
}

export function scorecard(rows: BacktestRow[]) {
  let hits = 0, misses = 0, falseAlarms = 0;
  for (const r of rows) {
    if (r.outbreak_prob == null || r.outbreak_actual == null) continue;
    if (r.outbreak_actual) { if (alerted(r)) hits++; else misses++; } else if (alerted(r)) falseAlarms++;
  }
  const leads = [...byRegion(rows).values()].map(municipalityLead);
  const withOutbreak = leads.filter(l => l.onset);
  const warned = withOutbreak.filter(l => l.issue);
  return {
    hits, misses, falseAlarms,
    precision: hits + falseAlarms ? hits / (hits + falseAlarms) : null,
    recall: hits + misses ? hits / (hits + misses) : null,
    withOutbreak: withOutbreak.length, alertedBeforeOnset: warned.length,
    medianLeadToOnset: median(warned.map(l => l.leadToOnset!)),
    medianLeadToPeak: median(warned.flatMap(l => l.leadToPeak == null ? [] : [l.leadToPeak])),
    falseAlarmMunicipalities: leads.filter(l => l.falseAlarm).length,
  };
}

export function stateSeries(rows: BacktestRow[]) {
  const weeks = new Map<string, { week: string; cases: number; missing: number; alerted: number }>();
  for (const r of rows) {
    const w = weeks.get(r.target_week) ?? { week: r.target_week, cases: 0, missing: 0, alerted: 0 };
    if (r.cases_actual == null) w.missing++; else w.cases += r.cases_actual;
    if (alerted(r)) w.alerted++;
    weeks.set(r.target_week, w);
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
}

/** Region ids whose forecast first reaches the cut-off at the given week. */
export function firstAlertsAt(regions: Map<string, BacktestRow[]>, week: string) {
  return [...regions.entries()].flatMap(([id, list]) => {
    const first = list.find(alerted);
    return first?.target_week === week ? [{ id, prob: first.outbreak_prob! }] : [];
  });
}
