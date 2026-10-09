export const DISEASES = ['Dengue', 'Chikungunya', 'Zika', 'Malaria', 'Leptospirosis', 'Diarrhoeal disease'] as const;
export const RISK_SCALE = [
  { label: 'Low', color: '#FDE68A' },
  { label: 'Moderate', color: '#F59E0B' },
  { label: 'High', color: '#DC2626' },
  { label: 'Very high', color: '#9D174D' },
  { label: 'No data', color: '#64748B' },
] as const;
export function normalizeHorizon(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(8, Math.round(number))) : 4;
}
export function validateContext(search: Record<string, unknown>) {
  return {
    disease: typeof search.disease === 'string' && DISEASES.some(d => d === search.disease) ? search.disease : 'Dengue',
    horizon: search.horizon == null ? 4 : normalizeHorizon(search.horizon),
  };
}
export const PAGE_DETAILS = {
  command: { title: 'Command centre', description: 'Anticipate emerging outbreaks and prioritise your public health response.', eyebrow: 'OUTBREAK INTELLIGENCE' },
  map: { title: 'Map', description: 'Locate regional outbreak risk to focus surveillance and resources.', eyebrow: 'REGIONAL SURVEILLANCE' },
  scenarios: { title: 'Scenario lab', description: 'Explore how changing climate conditions could influence outbreak risk.', eyebrow: 'CLIMATE & RESPONSE' },
  replay: { title: 'Time machine', description: 'Replay past epidemics to assess early-warning signals and response timing.', eyebrow: 'HISTORICAL ANALYSIS' },
  alerts: { title: 'Alerts', description: 'Review emerging threats and decide where to act next.', eyebrow: 'EARLY WARNING' },
  trust: { title: 'Model & data', description: 'Assess data coverage and model reliability before making a decision.', eyebrow: 'TRANSPARENCY & ASSURANCE' },
} as const;
export type PageKind = keyof typeof PAGE_DETAILS;
export function pageHead(kind: PageKind) {
  const page = PAGE_DETAILS[kind];
  return { meta: [
    { title: `${page.title} | EpiRadar` },
    { name: 'description', content: page.description },
    { property: 'og:title', content: `${page.title} | EpiRadar` },
    { property: 'og:description', content: page.description },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] };
}
