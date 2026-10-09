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
    disease: typeof search['disease'] === 'string' && DISEASES.some(d => d === search['disease']) ? search['disease'] : 'Dengue',
    horizon: search['horizon'] == null ? 4 : normalizeHorizon(search['horizon']),
    ...(typeof search['region'] === 'string' && search['region'].length <= 100 ? { region: search['region'] } : {}),
    ...(search['view'] === 'table' ? { view: 'table' as const } : {}),
    ...(typeof search['sort'] === 'string' && ['name', 'population', 'probability', 'level', 'cases'].includes(search['sort']) ? { sort: search['sort'] } : {}),
    ...(search['desc'] === true || search['desc'] === 'true' ? { desc: true } : {}),
    ...(typeof search['country'] === 'string' && /^[A-Z]{3}$/.test(search['country']) ? { country: search['country'] } : {}),
    ...(typeof search['state'] === 'string' && /^IN-[A-Z]{2,3}$/.test(search['state']) ? { state: search['state'] } : {}),
    ...(typeof search['india'] === 'string' && ['dengue', 'chikungunya', 'malaria'].includes(search['india']) ? { india: search['india'] as 'dengue' | 'chikungunya' | 'malaria' } : {}),
    ...(Number.isInteger(Number(search['year'])) && Number(search['year']) >= 2000 && Number(search['year']) <= 2100 && search['year'] != null && search['year'] !== '' ? { year: Number(search['year']) } : {}),
    ...(typeof search['who'] === 'string' && ['malaria', 'cholera'].includes(search['who']) ? { who: search['who'] as 'malaria' | 'cholera' } : {}),
    // India district forecast: disease, months ahead, open district
    ...(typeof search['fd'] === 'string' && ['dengue', 'chikungunya', 'malaria', 'add', 'cholera'].includes(search['fd']) ? { fd: search['fd'] as 'dengue' | 'chikungunya' | 'malaria' | 'add' | 'cholera' } : {}),
    ...([1, 2, 3].includes(Number(search['fh'])) ? { fh: Number(search['fh']) as 1 | 2 | 3 } : {}),
    ...(typeof search['district'] === 'string' && /^IN-D\d{1,4}$/.test(search['district']) ? { district: search['district'] } : {}),
    // India what-if lab: index into the rain multipliers (0–5, 2 = observed) and temperature offsets (0–3, 1 = observed)
    ...([0, 1, 3, 4, 5].includes(Number(search['wr'])) && search['wr'] !== '' && search['wr'] != null ? { wr: Number(search['wr']) } : {}),
    ...([0, 2, 3].includes(Number(search['wt'])) && search['wt'] !== '' && search['wt'] != null ? { wt: Number(search['wt']) } : {}),
  };
}
export const PAGE_DETAILS = {
  india: { title: 'India overview', description: 'India: climate-informed outbreak forecasts, alerts and precautions for every district, with reported burden and live climate suitability.', eyebrow: 'INDIA' },
  world: { title: 'World', description: 'Global dengue outlook by country with live satellite, climate and weather layers.', eyebrow: 'GLOBAL SURVEILLANCE' },
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
