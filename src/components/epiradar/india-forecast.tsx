import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDownRight, ArrowUpRight, BellRing, Eye, FlaskConical, Info, Layers, Newspaper, RotateCcw, ShieldAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { validateContext } from '@/lib/epiradar';
import { indiaForecastQuery, indiaModelCardQuery, indiaSummaryQuery } from '@/lib/india-query';
import {
  CLIMATE_FAMILIES, DISEASE_FC_KEY, FAMILY_SIGNAL, FC_DISEASES, FC_HORIZONS, TIER_KEY, WEEKS_OF, WHATIF_RAIN, WHATIF_TEMP, asInputs, climateEffectPp,
  dayLabel, driverSentence, isDriverList, isTier, pctText, scenarioProb, tierIndex, tierOf, timesUsual, windowLabel, windowStart,
  type Driver, type FcDisease, type FcHorizon, type Inputs, type Tier,
} from '@/lib/india-forecast';
import { PRECAUTIONS, TIER_ACTION, pick } from '@/lib/precautions';
import { formatIN, stateName, useT, type Key } from '@/lib/i18n';
import { DataBadge } from './i18n-ui';

type DistrictMeta = { id: string; state_id: string; name: string; population: number | null };
type StateMeta = { id: string; name: string; name_hi?: string | null; name_mr?: string | null };
type Card = Record<string, unknown> | null | undefined;
export type TierStats = { thresholds?: { very_high?: number; high?: number; moderate?: number }; base_rate?: number; levels?: Record<string, { share?: number; outbreak_rate?: number | null; outbreaks_caught?: number }> };
export const SIGNALS = ['weather', 'water', 'satellite', 'vector', 'season', 'mobility', 'surveillance', 'population'] as const;
const SIGNAL_KEY: Record<(typeof SIGNALS)[number], Key> = {
  weather: 'sig.weather', water: 'sig.water', satellite: 'sig.satellite', vector: 'sig.vector', season: 'sig.season', mobility: 'sig.mobility', surveillance: 'sig.surveillance', population: 'sig.population',
};
const SIGNAL_SOURCE: Record<(typeof SIGNALS)[number], string> = {
  weather: 'NASA POWER daily rain, temperature, humidity, wind', water: 'NASA POWER soil wetness (MERRA-2)', satellite: 'NASA POWER all-sky sunlight (CERES)',
  vector: 'Aedes / Anopheles temperature curves', season: 'district climate normals 2008–2014', mobility: 'gravity model, Census 2011 population',
  surveillance: 'IDSP outbreak reports 2009–2022 (EpiClim)', population: 'Census 2011 density',
};

export function useForecastContext() {
  const context = validateContext(useSearch({ strict: false }));
  const disease: FcDisease = context.fd ?? 'dengue';
  const horizon: FcHorizon = context.fh ?? 1;
  const wr = context.wr ?? 2, wt = context.wt ?? 1;
  return { context, disease, horizon, wr, wt, whatIf: wr !== 2 || wt !== 1 };
}

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  const t = useT();
  if (!isTier(tier)) return <span className="tier-badge heat-4">{t('risk.No data')}</span>;
  return <span className={`tier-badge heat-${tierIndex(tier)}`}>{t(TIER_KEY[tier])}</span>;
}

export function DriverLine({ d, inputs }: { d: Driver; inputs: Inputs }) {
  const t = useT();
  const up = d.w > 0;
  const sig = FAMILY_SIGNAL[d.f];
  return <li className="fc-driver">{up ? <ArrowUpRight className="fc-up" aria-label={t('fcx.raises')} /> : <ArrowDownRight className="fc-down" aria-label={t('fcx.lowers')} />}<span>{driverSentence(d, inputs, t)}{sig && sig !== 'surveillance' && sig !== 'population' && <span className={`climate-tag sig-tag-${sig}`}>{t(SIGNAL_KEY[sig as (typeof SIGNALS)[number]] ?? 'fcx.climateTag')}</span>}</span></li>;
}

/** Back-test stats for one disease/horizon from the model card (thresholds and outbreak rates). */
export function tierStats(card: Card, disease: string, horizon: number): TierStats | null {
  const tiers = card?.['tiers'] as Record<string, TierStats> | undefined;
  return tiers?.[`${disease}|${horizon}`] ?? null;
}

export function Precautions({ disease, tier }: { disease: FcDisease; tier: Tier | null }) {
  const t = useT();
  const p = PRECAUTIONS[disease];
  return <div className="fc-precautions">
    {tier && <p className="fc-action"><ShieldAlert className="size-4" />{pick(TIER_ACTION[tier], t.lang)}</p>}
    <h4>{t('fcx.forOfficials')}</h4>
    <ul>{p.official.map((l, i) => <li key={i}>{pick(l, t.lang)}</li>)}</ul>
    <h4>{t('fcx.forPublic')}</h4>
    <ul>{p.public.map((l, i) => <li key={i}>{pick(l, t.lang)}</li>)}</ul>
  </div>;
}

/** Forecast rows with the what-if applied (probability and level), shared by the panel and the map. */
export function useScenarioRows<R extends { district_id: string; prob: number; risk_level: string; scenarios?: unknown }>(rows: R[], stats: TierStats | null, wr: number, wt: number, whatIf: boolean) {
  return useMemo(() => rows.map(r => {
    if (!whatIf) return { ...r, p: r.prob, level: (isTier(r.risk_level) ? r.risk_level : null) as Tier | null, base: (isTier(r.risk_level) ? r.risk_level : null) as Tier | null };
    const p = scenarioProb(r, wr, wt);
    return { ...r, p, level: tierOf(p, stats?.thresholds) ?? (isTier(r.risk_level) ? r.risk_level : null), base: (isTier(r.risk_level) ? r.risk_level : null) as Tier | null };
  }), [rows, stats, wr, wt, whatIf]);
}

function WhatIf({ wr, wt, onChange }: { wr: number; wt: number; onChange: (wr: number, wt: number) => void }) {
  const t = useT();
  return <div className="whatif">
    <div className="whatif-head"><FlaskConical className="size-4" /><strong>{t('wi.title')}</strong><span className="sub">{t('wi.sub')}</span></div>
    <div className="whatif-controls">
      <label><span className="control-label">{t('wi.rain')}</span>
        <div className="disease-tabs" role="radiogroup" aria-label={t('wi.rain')}>{WHATIF_RAIN.map((r, i) => <button key={r} role="radio" aria-checked={wr === i} aria-selected={wr === i} onClick={() => onChange(i, wt)}>×{r}</button>)}</div></label>
      <label><span className="control-label">{t('wi.temp')}</span>
        <div className="disease-tabs" role="radiogroup" aria-label={t('wi.temp')}>{WHATIF_TEMP.map((d, i) => <button key={d} role="radio" aria-checked={wt === i} aria-selected={wt === i} onClick={() => onChange(wr, i)}>{d > 0 ? `+${d}` : d === 0 ? '0' : `−${Math.abs(d)}`} °C</button>)}</div></label>
      {(wr !== 2 || wt !== 1) && <Button variant="ghost" size="sm" onClick={() => onChange(2, 1)}><RotateCcw />{t('wi.reset')}</Button>}
    </div>
  </div>;
}

export function SignalBar({ shares, compact = false }: { shares: Record<string, number> | null | undefined; compact?: boolean }) {
  const t = useT();
  if (!shares) return null;
  const items = SIGNALS.map(s => ({ s, v: shares[s] ?? 0 })).filter(x => x.v > 0);
  return <div className={compact ? 'sigbar sigbar-compact' : 'sigbar'}>
    <div className="sigbar-track" role="img" aria-label={items.map(x => `${t(SIGNAL_KEY[x.s])} ${Math.round(x.v * 100)}%`).join(', ')}>{items.map(x => <span key={x.s} className={`sigbar-seg sig-${x.s}`} style={{ width: `${x.v * 100}%` }} title={`${t(SIGNAL_KEY[x.s])}: ${(x.v * 100).toFixed(1)}%`} />)}</div>
    <ul className="sigbar-legend">{items.map(x => <li key={x.s}><span className={`sigbar-dot sig-${x.s}`} />{t(SIGNAL_KEY[x.s])} <b>{x.v < 0.01 ? '<1' : Math.round(x.v * 100)}%</b>{!compact && <small>{SIGNAL_SOURCE[x.s]}</small>}</li>)}</ul>
  </div>;
}

function Brief({ horizon, districts, states, issue }: { horizon: number; districts: Map<string, DistrictMeta>; states: Map<string, StateMeta>; issue: string | null }) {
  const t = useT();
  const q = useQuery(indiaSummaryQuery(horizon));
  if (!q.data?.rows.length || !issue) return null;
  const lines = FC_DISEASES.map(d => {
    const hi = q.data.rows.filter(r => r.disease_id === d && (r.risk_level === 'high' || r.risk_level === 'very_high'));
    const people = hi.reduce((a, r) => a + (districts.get(r.district_id)?.population ?? 0), 0);
    const by = new Map<string, number>();
    for (const r of hi) { const s = districts.get(r.district_id)?.state_id; if (s) by.set(s, (by.get(s) ?? 0) + 1); }
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s, n]) => `${stateName(states.get(s), t.lang)} (${n})`).join(', ');
    return hi.length ? t('brief.line', { disease: t(DISEASE_FC_KEY[d]), n: formatIN(hi.length), people: formatIN(people), states: top || '—' }) : t('brief.none', { disease: t(DISEASE_FC_KEY[d]) });
  });
  const silent = new Set(q.data.rows.filter(r => r.silent).map(r => r.district_id)).size;
  return <div className="fc-brief"><h3 className="fc-h3"><Newspaper className="size-4" />{t('brief.title')} · {t('fcx.weeks', { w: WEEKS_OF[horizon]! })}, {windowLabel(windowStart(issue, horizon), t.lang)}</h3>
    <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}{silent > 0 && <li>{t('brief.silent', { n: formatIN(silent) })}</li>}</ul></div>;
}

export function IndiaForecastPanel({ districts, states }: { districts: DistrictMeta[]; states: StateMeta[] }) {
  const t = useT();
  const navigate = useNavigate();
  const { disease, horizon, wr, wt, whatIf } = useForecastContext();
  const q = useQuery(indiaForecastQuery(disease, horizon));
  const card = useQuery(indiaModelCardQuery);
  const [expanded, setExpanded] = useState(false);
  const setSearch = (patch: Record<string, unknown>) => void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...validateContext(prev), ...patch }) } as never);
  const byId = useMemo(() => new Map(districts.map(d => [d.id, d])), [districts]);
  const stateById = useMemo(() => new Map(states.map(s => [s.id, s])), [states]);
  const stats = tierStats(card.data?.card, disease, horizon);
  const rows = useScenarioRows(q.data?.rows ?? [], stats, wr, wt, whatIf);
  const alerts = useMemo(() => rows.filter(r => r.level === 'very_high' || r.level === 'high').sort((a, b) => b.p - a.p), [rows]);
  const vh = rows.filter(r => r.level === 'very_high').length;
  const hi = rows.filter(r => r.level === 'high').length;
  const people = alerts.reduce((a, r) => a + (byId.get(r.district_id)?.population ?? 0), 0);
  const climateUp = rows.filter(r => (climateEffectPp(r.p, r.prob_no_climate) ?? 0) >= 1).length;
  const moved = useMemo(() => {
    if (!whatIf) return null;
    let up = 0, down = 0;
    for (const r of rows) { if (r.level && r.base) { const d = tierIndex(r.level) - tierIndex(r.base); if (d > 0) up++; else if (d < 0) down++; } }
    return { up, down };
  }, [rows, whatIf]);
  const caught = stats?.levels ? ['very_high', 'high', 'moderate'].reduce((a, k) => a + (stats.levels?.[k]?.outbreaks_caught ?? 0), 0) : null;
  const flaggedShare = stats?.levels ? ['very_high', 'high', 'moderate'].reduce((a, k) => a + (stats.levels?.[k]?.share ?? 0), 0) : null;
  const issue = q.data?.issue_month ?? null;
  const win = issue ? windowLabel(windowStart(issue, horizon), t.lang) : '—';
  const byState = useMemo(() => {
    const m = new Map<string, { n: number; exp: number }>();
    for (const r of rows) { const s = byId.get(r.district_id)?.state_id; if (!s) continue; const e = m.get(s) ?? { n: 0, exp: 0 }; e.exp += r.p; if (r.level === 'high' || r.level === 'very_high') e.n++; m.set(s, e); }
    return [...m.entries()].sort((a, b) => b[1].exp - a[1].exp).slice(0, 8);
  }, [rows, byId]);
  const silent = useMemo(() => rows.filter(r => r.silent).sort((a, b) => (b.prob_climate_only ?? 0) - (a.prob_climate_only ?? 0)), [rows]);
  const shown = expanded ? alerts : alerts.slice(0, 8);
  const topTier = alerts[0]?.level ?? null;
  const nReports = typeof card.data?.card?.['events_used'] === 'number' ? formatIN(card.data.card['events_used'] as number) : '—';
  const signals = (card.data?.card?.['signals'] as Record<string, Record<string, number>> | undefined)?.[disease];

  return <section className="fc-hero" aria-labelledby="fc-title">
    <div className="panel-title-row"><div><p className="eyebrow">{t('fcx.eyebrow')}</p><h2 id="fc-title">{t('fcx.title')}</h2></div><DataBadge kind="forecast" /></div>
    <p className="sub mt-1">{t('fcx.subtitle', { issue: issue ? t('fcx.weatherTo', { d: dayLabel(issue, t.lang) }) : '—' })}</p>
    <Brief horizon={horizon} districts={byId} states={stateById} issue={issue} />
    <div className="fc-toolbar">
      <div><span className="control-label">{t('fcx.disease')}</span>
        <div className="disease-tabs" role="tablist" aria-label={t('fcx.disease')}>{FC_DISEASES.map(d => <button key={d} role="tab" aria-selected={disease === d} onClick={() => setSearch({ fd: d })}>{t(DISEASE_FC_KEY[d])}</button>)}</div></div>
      <div><span className="control-label">{t('fcx.month')}</span>
        <div className="disease-tabs" role="tablist" aria-label={t('fcx.month')}>{FC_HORIZONS.map(h => <button key={h} role="tab" aria-selected={horizon === h} onClick={() => setSearch({ fh: h })}><span className="block">{t('fcx.weeks', { w: WEEKS_OF[h]! })}</span><small className="block text-muted-foreground">{issue ? windowLabel(windowStart(issue, h), t.lang) : ''}</small></button>)}</div></div>
    </div>
    <WhatIf wr={wr} wt={wt} onChange={(a, b) => setSearch({ wr: a === 2 ? undefined : a, wt: b === 1 ? undefined : b })} />
    {whatIf && <p className="fc-whatif-note"><FlaskConical className="size-4" />{t('wi.active', { r: WHATIF_RAIN[wr]!, t: `${WHATIF_TEMP[wt]! > 0 ? '+' : ''}${WHATIF_TEMP[wt]}` })}{moved ? ` ${t('wi.moved', { up: formatIN(moved.up), down: formatIN(moved.down) })}` : ''}</p>}
    {q.isPending ? <Skeleton className="h-40 mt-3" /> : q.isError ? <p className="drawer-empty">{t('common.error')}</p> : !rows.length ? <div className="forecast-notice mt-3">{t('fcx.none')}</div> : <>
      <div className="kpi-strip fc-kpis mt-3">
        <div className="command-metric"><span className="metric-label">{t('fcx.kpi.vh')}</span><strong>{formatIN(vh)}</strong><small className="metric-foot">{t('fcx.kpi.ofDistricts', { n: formatIN(rows.length) })}</small></div>
        <div className="command-metric"><span className="metric-label">{t('fcx.kpi.h')}</span><strong>{formatIN(hi)}</strong><small className="metric-foot">{t('fcx.kpi.ofDistricts', { n: formatIN(rows.length) })}</small></div>
        <div className="command-metric"><span className="metric-label"><Users className="size-3" />{t('fcx.kpi.people')}</span><strong>{alerts.length ? formatIN(people) : '0'}</strong><small className="metric-foot">{t('fcx.kpi.census')}</small></div>
        <div className="command-metric"><span className="metric-label">{t('fcx.kpi.climate')}</span><strong>{formatIN(climateUp)}</strong><small className="metric-foot">{t('fcx.kpi.climateFoot')}</small></div>
        <div className="command-metric"><span className="metric-label">{t('fcx.kpi.skill')}</span><strong>{caught == null ? '—' : `${Math.round(caught * 100)}%`}</strong><small className="metric-foot">{t('fcx.kpi.skillFoot', { share: flaggedShare == null ? '—' : Math.round(flaggedShare * 100) })}</small></div>
      </div>
      <div className="fc-grid">
        <div>
          <h3 className="fc-h3"><BellRing className="size-4" />{t('fcx.alerts')}</h3>
          <p className="sub">{t('fcx.alertsSub', { disease: t(DISEASE_FC_KEY[disease]), month: `${t('fcx.weeks', { w: WEEKS_OF[horizon]! })}, ${win}` })}</p>
          {alerts.length ? <ol className="fc-alert-list">{shown.map(r => {
            const d = byId.get(r.district_id); const s = d ? stateById.get(d.state_id) : undefined;
            const drivers = isDriverList(r.drivers) ? r.drivers.filter(x => x.w > 0).slice(0, 2) : []; const inp = asInputs(r.inputs);
            const x = timesUsual(r.p, r.typical_prob); const pp = climateEffectPp(r.prob, r.prob_no_climate);
            return <li key={r.district_id}><button type="button" className="fc-alert" onClick={() => setSearch({ district: r.district_id })}>
              <span className="fc-alert-head"><strong>{d?.name ?? r.district_id}</strong><span className="sub">{stateName(s, t.lang)}</span>{r.silent && <span className="bs-badge"><Eye className="size-3" />{t('bs.badge')}</span>}<TierBadge tier={r.level} /></span>
              <span className="fc-alert-metrics"><span><b>{pctText(r.p)}</b> {t('fcx.prob').toLowerCase()}</span><span>{x == null ? t('fcx.noUsual') : t('fcx.vsUsual', { x: x >= 10 ? Math.round(x) : x.toFixed(1) })}</span>{!whatIf && pp != null && Math.abs(pp) >= 0.5 && <span className={pp > 0 ? 'fc-up' : 'fc-down'}>{pp > 0 ? t('fcx.climateUp', { pp: pp.toFixed(1) }) : t('fcx.climateDown', { pp: Math.abs(pp).toFixed(1) })}</span>}</span>
              {drivers.length > 0 && <ul className="fc-drivers">{drivers.map((dr, i) => <DriverLine key={i} d={dr} inputs={inp} />)}</ul>}
            </button></li>;
          })}</ol> : <p className="drawer-empty">{t('fcx.noAlerts')}</p>}
          {alerts.length > 8 && <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)}>{expanded ? t('fcx.showFewer') : t('fcx.showAll', { n: alerts.length })}</Button>}
        </div>
        <div className="flex flex-col gap-4">
          <div className="fc-side-card"><h3 className="fc-h3"><ShieldAlert className="size-4" />{t('fcx.precautions')} · {t(DISEASE_FC_KEY[disease])}</h3><Precautions disease={disease} tier={topTier} /></div>
          <div className="fc-side-card"><h3 className="fc-h3"><Eye className="size-4" />{t('bs.title')}</h3><p className="sub">{t('bs.sub', { disease: t(DISEASE_FC_KEY[disease]) })}</p>
            {silent.length ? <ol className="fc-state-list mt-2">{silent.slice(0, 8).map(r => { const d = byId.get(r.district_id); return <li key={r.district_id}><button type="button" onClick={() => setSearch({ district: r.district_id, state: undefined })}>{d?.name ?? r.district_id}</button><span className="text-muted-foreground">{stateName(d ? stateById.get(d.state_id) : undefined, t.lang)} · {pctText(r.prob_climate_only, 1)}</span></li>; })}</ol> : <p className="drawer-empty">{t('bs.none')}</p>}</div>
          <div className="fc-side-card"><h3 className="fc-h3"><Layers className="size-4" />{t('so.title')}</h3><p className="sub">{t('so.sub')}</p>
            <ol className="fc-state-list mt-2">{byState.map(([id, v]) => <li key={id}><button type="button" onClick={() => setSearch({ state: id, district: undefined })}>{stateName(stateById.get(id), t.lang)}</button><span className="tabular-nums">{v.exp.toFixed(1)} {t('so.expected')}{v.n ? ` · ${formatIN(v.n)} ${t('risk.High').toLowerCase()}+` : ''}</span></li>)}</ol></div>
        </div>
      </div>
      {signals && <div className="fc-signals"><h3 className="fc-h3"><Layers className="size-4" />{t('sig.title')}</h3><p className="sub">{t('sig.sub', { disease: t(DISEASE_FC_KEY[disease]) })}</p><SignalBar shares={signals} /></div>}
      <details className="fc-method"><summary><Info className="inline size-3 mr-1" />{t('fcx.method')}</summary><p className="sub mt-2">{t('fcx.methodBody', { n: nReports })}</p>
        {stats?.levels && <ul className="fc-levels">{(['very_high', 'high', 'moderate', 'low'] as Tier[]).map(k => { const l = stats.levels?.[k]; return <li key={k}><TierBadge tier={k} /><span>{t(`fcx.level.${k}` as const, { r: l?.outbreak_rate == null ? '—' : (l.outbreak_rate * 100).toFixed(1) })}</span></li>; })}</ul>}
        <p className="sub mt-2">{t('fcx.disclaimer')}</p></details>
    </>}
  </section>;
}

export const isClimateFamily = (f: string) => CLIMATE_FAMILIES.has(f);
