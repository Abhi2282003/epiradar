import type { Database } from '@/integrations/supabase/types';
import { RISK_SCALE } from '@/lib/epiradar';

export type Region = Database['public']['Tables']['regions']['Row'];
export type Prediction = Database['public']['Views']['latest_predictions']['Row'];
export type LiveEvent = Pick<Database['public']['Tables']['live_events']['Row'], 'id' | 'ts' | 'kind' | 'message' | 'severity' | 'region_id'>;
export type Municipality = { region: Region; prediction: Prediction | null };
export const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
export const formatNumber = (value: number | null | undefined) => value == null ? '—' : numberFormat.format(value);
export const formatProbability = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value * 100)}%`;
export function riskLabel(value: string | null | undefined) {
  const normalized = value?.toLowerCase().replace(/[_-]/g, ' ').trim();
  return RISK_SCALE.find(risk => risk.label.toLowerCase() === normalized)?.label ?? 'No data';
}
export function joinMunicipalities(regions: Region[], predictions: Prediction[]): Municipality[] {
  const byRegion = new Map(predictions.map(prediction => [prediction.region_id, prediction]));
  return regions.map(region => ({ region, prediction: byRegion.get(region.id) ?? null }));
}
export function sumKnown(values: (number | null | undefined)[]) {
  return values.length === 0 || values.some(value => value == null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}
export function commandMetrics(rows: Municipality[]) {
  const predicted = rows.filter(row => row.prediction !== null);
  const elevated = predicted.filter(row => ['High', 'Very high'].includes(riskLabel(row.prediction?.risk_level)));
  return {
    elevated: predicted.length ? elevated.length : null,
    population: predicted.length ? (elevated.length ? sumKnown(elevated.map(row => row.region.population)) : 0) : null,
    cases: sumKnown(predicted.map(row => row.prediction?.cases_p50)),
  };
}
export function fastestBuilding(rows: Municipality[], baseline: Prediction[]) {
  const byRegion = new Map(baseline.map(prediction => [prediction.region_id, prediction]));
  return rows.flatMap(row => {
    const first = byRegion.get(row.region.id);
    const selected = row.prediction;
    if (!first || !selected || first.outbreak_prob == null || selected.outbreak_prob == null || first.issue_week !== selected.issue_week || first.model_version !== selected.model_version) return [];
    const increase = selected.outbreak_prob - first.outbreak_prob;
    return increase > 0 ? [{ ...row, baseline: first.outbreak_prob, increase }] : [];
  }).sort((a, b) => b.increase - a.increase).slice(0, 5);
}
export function sortMunicipalities(rows: Municipality[], sort: string, descending: boolean) {
  const value = (row: Municipality): string | number | null => {
    switch (sort) {
      case 'population': return row.region.population;
      case 'probability': return row.prediction?.outbreak_prob ?? null;
      case 'cases': return row.prediction?.cases_p50 ?? null;
      case 'level': return row.prediction ? RISK_SCALE.findIndex(risk => risk.label === riskLabel(row.prediction?.risk_level)) : null;
      default: return row.region.name;
    }
  };
  return [...rows].sort((a, b) => {
    const av = value(a), bv = value(b);
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    const result = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv);
    return descending ? -result : result;
  });
}