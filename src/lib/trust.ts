import { municipalityLead, type BacktestRow } from './replay';

/** Safe readers for the free-form model card JSON: missing keys become null, never a crash. */
export type Card = Record<string, unknown> | null;
export const asCard = (value: unknown): Card => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
export const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
export const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : typeof value === 'number' ? String(value) : null;
export const cardCutoff = (card: Card) => num(card?.['alert_cutoff']);
export const pct = (value: number | null, digits = 0) => value == null ? '—' : `${(value * 100).toFixed(digits)}%`;
export const dec = (value: number | null, digits = 2) => value == null ? '—' : value.toFixed(digits);

export type HorizonMetric = { h: number; model: number | null; persistence: number | null; seasonal: number | null; roc: number | null; recall: number | null; precision: number | null; coverage: number | null };
export function horizonMetrics(card: Card): HorizonMetric[] {
  const list = card?.['metrics_by_horizon'];
  if (!Array.isArray(list)) return [];
  return list.flatMap(item => {
    const m = asCard(item); const h = num(m?.['h']);
    if (!m || h == null) return [];
    const test = asCard(m['test']);
    return [{ h, model: num(test?.['pr_auc']), persistence: num(m['baseline_persistence_pr_auc']), seasonal: num(m['baseline_seasonal_pr_auc']), roc: num(test?.['roc_auc']), recall: num(test?.['recall']), precision: num(test?.['precision']), coverage: num(test?.['interval80_coverage']) }];
  }).sort((a, b) => a.h - b.h);
}
export function accuracyReading(metrics: HorizonMetric[], horizon: number) {
  const m = metrics.find(x => x.h === horizon) ?? metrics.find(x => x.h === 4);
  if (!m || m.model == null) return null;
  const parts = [`${m.h} ${m.h === 1 ? 'week' : 'weeks'} ahead: PR-AUC ${dec(m.model)}`];
  if (m.persistence != null) parts.push(`vs ${dec(m.persistence)} for 'same as this week'`);
  if (m.seasonal != null) parts.push(`and ${dec(m.seasonal)} for 'usual for the season'`);
  return parts.join(' ');
}
export function driverBars(card: Card) {
  const d = asCard(card?.['driver_importance_h4_focus_2024']);
  if (!d) return [];
  return Object.entries(d).flatMap(([label, v]) => num(v) == null ? [] : [{ label, value: num(v)! }]).sort((a, b) => b.value - a.value);
}
export const caveats = (card: Card) => Array.isArray(card?.['caveats']) ? (card!['caveats'] as unknown[]).flatMap(c => text(c) ? [text(c)!] : []) : [];

export type SourceTone = 'ok' | 'pending' | 'degraded' | 'error' | 'unknown';
export const sourceTone = (status: string | null | undefined): SourceTone => {
  const s = (status ?? '').toLowerCase();
  return s === 'ok' || s === 'pending' || s === 'degraded' || s === 'error' ? s : 'unknown';
};

/** Municipalities with the highest probability; gap is in percentage points below (+) or above (−) the cut-off. */
export function closestToCutoff<T extends { prediction: { outbreak_prob: number | null } | null }>(rows: T[], cutoff: number | null, n = 5) {
  return rows.filter(r => r.prediction?.outbreak_prob != null)
    .sort((a, b) => b.prediction!.outbreak_prob! - a.prediction!.outbreak_prob!).slice(0, n)
    .map(row => ({ row, prob: row.prediction!.outbreak_prob!, gapPp: cutoff == null ? null : Math.round((row.prediction!.outbreak_prob! - cutoff) * 100) }));
}

export type Outcome = 'Warned before onset' | 'Outbreak without warning' | 'Alert, no outbreak' | 'No outbreak, no alert';
export function alertHistory(byRegion: Map<string, BacktestRow[]>) {
  const items = [...byRegion.entries()].map(([id, rows]) => {
    const lead = municipalityLead(rows);
    const outcome: Outcome = lead.onset ? (lead.issue ? 'Warned before onset' : 'Outbreak without warning') : lead.falseAlarm ? 'Alert, no outbreak' : 'No outbreak, no alert';
    return { id, ...lead, outcome };
  });
  return {
    items,
    warned: items.filter(i => i.outcome === 'Warned before onset').length,
    unwarned: items.filter(i => i.outcome === 'Outbreak without warning').length,
    falseAlarms: items.filter(i => i.outcome === 'Alert, no outbreak').length,
  };
}
