/** Browser-safe helpers for the all-India district outbreak forecast (IDSP outbreaks via EpiClim + NASA POWER climate). */
import type { Key, Lang } from '@/lib/i18n';

/** Database ids: 'add' is acute diarrhoeal disease (same id as the diseases table). */
export const FC_DISEASES = ['dengue', 'chikungunya', 'malaria', 'add', 'cholera'] as const;
export type FcDisease = (typeof FC_DISEASES)[number];
export const isFcDisease = (v: unknown): v is FcDisease => typeof v === 'string' && (FC_DISEASES as readonly string[]).includes(v);
export const FC_HORIZONS = [1, 2, 3] as const;
export type FcHorizon = (typeof FC_HORIZONS)[number];
export const isFcHorizon = (v: unknown): v is FcHorizon => FC_HORIZONS.includes(Number(v) as FcHorizon);

export const TIERS = ['very_high', 'high', 'moderate', 'low'] as const;
export type Tier = (typeof TIERS)[number];
export const isTier = (v: unknown): v is Tier => typeof v === 'string' && (TIERS as readonly string[]).includes(v);
/** Same semantic tokens as the rest of the app, so colour is never the only signal (labels are always shown). */
export const TIER_VAR: Record<Tier, string> = { very_high: '--risk-very-high', high: '--risk-high', moderate: '--risk-moderate', low: '--risk-low' };
export const TIER_KEY: Record<Tier, Key> = { very_high: 'risk.Very high', high: 'risk.High', moderate: 'risk.Moderate', low: 'risk.Low' };
export const tierIndex = (t: Tier) => 3 - TIERS.indexOf(t);  // low 0 … very_high 3

export const DISEASE_FC_KEY: Record<FcDisease, Key> = {
  dengue: 'disease.dengue', chikungunya: 'disease.chikungunya', malaria: 'disease.malaria', add: 'disease.add', cholera: 'disease.cholera',
};
export const VECTOR_OF: Record<FcDisease, 'aedes' | 'anopheles' | 'water'> = {
  dengue: 'aedes', chikungunya: 'aedes', malaria: 'anopheles', add: 'water', cholera: 'water',
};

/** One model driver: feature family and its SHAP weight (log-odds; > 0 raises risk). */
export type Driver = { f: string; w: number };
export const isDriverList = (v: unknown): v is Driver[] => Array.isArray(v) && v.every(d => !!d && typeof d === 'object' && typeof (d as Driver).f === 'string' && typeof (d as Driver).w === 'number');
export const CLIMATE_FAMILIES = new Set(['rain', 'rain_anom', 'temp', 'temp_anom', 'humidity', 'aedes', 'anopheles', 'season', 'water', 'sunlight', 'heat', 'wind']);
/** Which signal of the problem statement each driver family belongs to (shown as a tag). */
export const FAMILY_SIGNAL: Record<string, 'weather' | 'satellite' | 'water' | 'vector' | 'mobility' | 'surveillance' | 'population' | 'season'> = {
  rain: 'weather', rain_anom: 'weather', temp: 'weather', temp_anom: 'weather', humidity: 'weather', heat: 'weather', wind: 'weather',
  aedes: 'vector', anopheles: 'vector', season: 'season', water: 'water', sunlight: 'satellite', mobility: 'mobility',
  history: 'surveillance', surveillance: 'surveillance', recent: 'surveillance', population: 'population',
};
/** Compact climate and history inputs stored with each forecast row. */
export type Inputs = Partial<Record<'r3' | 'rp' | 'rl' | 't' | 'ta' | 'rh' | 'ae' | 'an' | 'nr' | 'nt' | 'hk' | 'hn' | 'ay' | 'dn' | 'im' | 'tm'
  | 'sw' | 'swa' | 'sol' | 'sola' | 'tx' | 'ws' | 'mb', number | null>>;
export const asInputs = (v: unknown): Inputs => (v && typeof v === 'object' && !Array.isArray(v) ? v as Inputs : {});
/** What-if grid for one forecast: probability for each temperature offset (rows) and rain multiplier (columns). */
export type Scenarios = { r: number[]; t: number[]; p: number[][] };
export const isScenarios = (v: unknown): v is Scenarios => !!v && typeof v === 'object' && Array.isArray((v as Scenarios).r) && Array.isArray((v as Scenarios).t) && Array.isArray((v as Scenarios).p);
/** Weeks after the latest weather that each horizon covers (4-week windows). */
export const WEEKS_OF: Record<number, string> = { 1: '1–4', 2: '5–8', 3: '9–12' };
export const WINDOW_DAYS = 28;
/** Rain multipliers and temperature offsets offered by the what-if lab (must match the grid stored with each row). */
export const WHATIF_RAIN = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const WHATIF_TEMP = [-1, 0, 1, 2] as const;
/** Probability under a what-if (rain index into WHATIF_RAIN, temperature index into WHATIF_TEMP); observed when both are neutral. */
export function scenarioProb(row: { prob: number; scenarios?: unknown }, wr: number, wt: number) {
  if (WHATIF_RAIN[wr] === 1 && WHATIF_TEMP[wt] === 0) return row.prob;
  const s = row.scenarios;
  if (!isScenarios(s)) return row.prob;
  const i = s.t.indexOf(WHATIF_TEMP[wt]!), j = s.r.indexOf(WHATIF_RAIN[wr]!);
  const v = i >= 0 && j >= 0 ? s.p[i]?.[j] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : row.prob;
}
/** Risk level for a probability, using the back-test thresholds stored in the model card. */
export function tierOf(p: number, th: { very_high?: number; high?: number; moderate?: number } | null | undefined): Tier | null {
  if (!th || th.very_high == null || th.high == null || th.moderate == null) return null;
  return p >= th.very_high ? 'very_high' : p >= th.high ? 'high' : p >= th.moderate ? 'moderate' : 'low';
}
type TFn = ((key: Key, vars?: Record<string, string | number>) => string) & { lang: Lang };
const f0 = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);
const f1 = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(1);
const f2 = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(2);
/** Plain-language sentence for a driver, in the current language, from the row's stored inputs. */
export function driverSentence(d: Driver, i: Inputs, t: TFn) {
  const last = i.im ? MONTHS[t.lang][i.im - 1] ?? '' : '';
  const tgt = i.tm ? MONTHS[t.lang][i.tm - 1] ?? '' : '';
  switch (d.f) {
    case 'rain_anom': return t((i.rp ?? 0) >= 0 ? 'drv.rainAbove' : 'drv.rainBelow', { x: f0(Math.abs(i.rp ?? 0)) });
    case 'rain': return t('drv.rain', { mm: f0(i.rl), month: last, mm3: f0(i.r3) });
    case 'temp': return t('drv.temp', { c: f1(i.t), month: last });
    case 'temp_anom': return t((i.ta ?? 0) >= 0 ? 'drv.warmer' : 'drv.cooler', { c: f1(Math.abs(i.ta ?? 0)) });
    case 'humidity': return t('drv.humidity', { x: f0(i.rh), month: last });
    case 'aedes': return t('drv.aedes', { x: f2(i.ae), month: last });
    case 'anopheles': return t('drv.anopheles', { x: f2(i.an), month: last });
    case 'season': return t(d.w > 0 ? 'drv.seasonFav' : 'drv.seasonUnfav', { month: tgt, mm: f0(i.nr), c: f1(i.nt) });
    case 'history': return t('drv.history', { k: f0(i.hk), n: f0(i.hn), month: tgt });
    case 'surveillance': return t('drv.surveillance', { x: f1(i.ay) });
    case 'population': return t('drv.population', { x: f0(i.dn) });
    case 'recent': return t('drv.recent');
    case 'water': return t((i.swa ?? 0) >= 0 ? 'drv.soilWet' : 'drv.soilDry', { x: f2(i.sw), month: last });
    case 'sunlight': return t('drv.sunlight', { x: f1(i.sol), month: last, d: `${(i.sola ?? 0) >= 0 ? '+' : '−'}${f1(Math.abs(i.sola ?? 0))}` });
    case 'heat': return t('drv.heat', { c: f1(i.tx), month: last });
    case 'wind': return t('drv.wind', { x: f1(i.ws), month: last });
    case 'mobility': return t('drv.mobility', { x: f0((i.mb ?? 0) * 100), month: tgt });
    default: return d.f;
  }
}

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  mr: ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'],
};
const SHORT: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
  mr: ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'],
};
const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** "2026-10-07" → "7 Oct" */
export function dayLabel(iso: string | null | undefined, lang: Lang) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—';
  return `${Number(iso.slice(8, 10))} ${SHORT[lang][Number(iso.slice(5, 7)) - 1] ?? ''}`;
}
/** 4-week window starting on `start`: "7 Oct – 3 Nov". */
export function windowLabel(start: string | null | undefined, lang: Lang) {
  if (!start) return '—';
  return `${dayLabel(start, lang)} – ${dayLabel(addDaysIso(start, WINDOW_DAYS - 1), lang)}`;
}
/** Start of the window for horizon h after an issue date (issue date = last day of weather). */
export const windowStart = (issue: string, h: number) => addDaysIso(issue, 1 + WINDOW_DAYS * (h - 1));
/** "2024-07-01" → "Jul ’24" (chart ticks). */
export function monthShort(date: string | null | undefined, lang: Lang) {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return '';
  return `${SHORT[lang][Number(date.slice(5, 7)) - 1] ?? ''} ’${date.slice(2, 4)}`;
}
/** "2026-10-01" → "October 2026" in the chosen language. */
export function monthLabel(date: string | null | undefined, lang: Lang) {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return '—';
  const y = date.slice(0, 4), m = Number(date.slice(5, 7));
  return `${MONTHS[lang][m - 1] ?? '—'} ${y}`;
}
export const pctText = (p: number | null | undefined, digits = 0) => p == null || !Number.isFinite(p) ? '—' : `${(p * 100).toFixed(p < 0.01 && digits === 0 ? 1 : digits)}%`;
/** Ratio of this forecast to the district's usual chance in the same season (null when there is no usual chance). */
export function timesUsual(prob: number | null | undefined, typical: number | null | undefined) {
  if (prob == null || typical == null || !(typical > 0)) return null;
  return prob / typical;
}
/** Climate effect in percentage points: model with climate minus the same model without climate. */
export const climateEffectPp = (prob: number | null | undefined, noClimate: number | null | undefined) => prob == null || noClimate == null ? null : (prob - noClimate) * 100;
