import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDownRight, ArrowUpRight, BellRing, Info, ShieldAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { validateContext } from '@/lib/epiradar';
import { indiaForecastQuery, indiaModelCardQuery } from '@/lib/india-query';
import { CLIMATE_FAMILIES, DISEASE_FC_KEY, FC_DISEASES, FC_HORIZONS, TIER_KEY, asInputs, climateEffectPp, driverSentence, isDriverList, isTier, monthLabel, pctText, tierIndex, timesUsual, type Driver, type FcDisease, type FcHorizon, type Inputs, type Tier } from '@/lib/india-forecast';
import { PRECAUTIONS, TIER_ACTION, pick } from '@/lib/precautions';
import { formatIN, stateName, useT } from '@/lib/i18n';
import { DataBadge } from './i18n-ui';

type DistrictMeta = { id: string; state_id: string; name: string; population: number | null };
type StateMeta = { id: string; name: string; name_hi?: string | null; name_mr?: string | null };
export type ForecastRow = { district_id: string; prob: number; prob_no_climate: number | null; typical_prob: number | null; risk_level: string; rank_india: number | null; drivers: unknown; inputs: unknown };
type Card = Record<string, unknown> | null | undefined;

export function useForecastContext() {
  const context = validateContext(useSearch({ strict: false }));
  const disease: FcDisease = context.fd ?? 'dengue';
  const horizon: FcHorizon = context.fh ?? 1;
  return { context, disease, horizon };
}

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  const t = useT();
  if (!isTier(tier)) return <span className="tier-badge heat-4">{t('risk.No data')}</span>;
  return <span className={`tier-badge heat-${tierIndex(tier)}`}>{t(TIER_KEY[tier])}</span>;
}

export function DriverLine({ d, inputs }: { d: Driver; inputs: Inputs }) {
  const t = useT();
  const up = d.w > 0;
  return <li className="fc-driver">{up ? <ArrowUpRight className="fc-up" aria-label={t('fcx.raises')} /> : <ArrowDownRight className="fc-down" aria-label={t('fcx.lowers')} />}<span>{driverSentence(d, inputs, t)}{CLIMATE_FAMILIES.has(d.f) && <span className="climate-tag">{t('fcx.climateTag')}</span>}</span></li>;
}

/** Back-test stats for one disease/horizon from the model card (tier outbreak rates). */
export function tierStats(card: Card, disease: string, horizon: number) {
  const tiers = card?.['tiers'] as Record<string, { base_rate?: number; levels?: Record<string, { share?: number; outbreak_rate?: number | null; outbreaks_caught?: number }> }> | undefined;
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

export function IndiaForecastPanel({ districts, states }: { districts: DistrictMeta[]; states: StateMeta[] }) {
  const t = useT();
  const navigate = useNavigate();
  const { disease, horizon } = useForecastContext();
  const q = useQuery(indiaForecastQuery(disease, horizon));
  const card = useQuery(indiaModelCardQuery);
  const [expanded, setExpanded] = useState(false);
  const setSearch = (patch: Record<string, unknown>) => void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...validateContext(prev), ...patch }) } as never);
  const byId = useMemo(() => new Map(districts.map(d => [d.id, d])), [districts]);
  const stateById = useMemo(() => new Map(states.map(s => [s.id, s])), [states]);
  const rows = q.data?.rows ?? [];
  const alerts = rows.filter(r => r.risk_level === 'very_high' || r.risk_level === 'high');
  const vh = rows.filter(r => r.risk_level === 'very_high').length;
  const hi = rows.filter(r => r.risk_level === 'high').length;
  const people = alerts.reduce((a, r) => a + (byId.get(r.district_id)?.population ?? 0), 0);
  const climateUp = rows.filter(r => (climateEffectPp(r.prob, r.prob_no_climate) ?? 0) >= 1).length;
  const stats = tierStats(card.data?.card, disease, horizon);
  const caught = stats?.levels ? ['very_high', 'high', 'moderate'].reduce((a, k) => a + (stats.levels?.[k]?.outbreaks_caught ?? 0), 0) : null;
  const flaggedShare = stats?.levels ? ['very_high', 'high', 'moderate'].reduce((a, k) => a + (stats.levels?.[k]?.share ?? 0), 0) : null;
  const target = q.data?.target_month ?? null;
  const issue = q.data?.issue_month ?? null;
  const byState = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of alerts) { const s = byId.get(r.district_id)?.state_id; if (s) m.set(s, (m.get(s) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [alerts, byId]);
  const shown = expanded ? alerts : alerts.slice(0, 8);
  const topTier = alerts[0] && isTier(alerts[0].risk_level) ? alerts[0].risk_level : null;
  const nReports = typeof card.data?.card?.['events_used'] === 'number' ? formatIN(card.data.card['events_used'] as number) : '—';

  return <section className="fc-hero" aria-labelledby="fc-title">
    <div className="panel-title-row"><div><p className="eyebrow">{t('fcx.eyebrow')}</p><h2 id="fc-title">{t('fcx.title')}</h2></div><DataBadge kind="forecast" /></div>
    <p className="sub mt-1">{t('fcx.subtitle', { issue: monthLabel(issue, t.lang) })}</p>
    <div className="fc-toolbar">
      <div><span className="control-label">{t('fcx.disease')}</span>
        <div className="disease-tabs" role="tablist" aria-label={t('fcx.disease')}>{FC_DISEASES.map(d => <button key={d} role="tab" aria-selected={disease === d} onClick={() => setSearch({ fd: d })}>{t(DISEASE_FC_KEY[d])}</button>)}</div></div>
      <div><span className="control-label">{t('fcx.month')}</span>
        <div className="disease-tabs" role="tablist" aria-label={t('fcx.month')}>{FC_HORIZONS.map(h => { const m = issue ? addMonths(issue, h) : null; return <button key={h} role="tab" aria-selected={horizon === h} title={t('fcx.ahead', { n: h })} onClick={() => setSearch({ fh: h })}>{m ? monthLabel(m, t.lang) : `+${h}`}</button>; })}</div></div>
    </div>
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
          <p className="sub">{t('fcx.alertsSub', { disease: t(DISEASE_FC_KEY[disease]), month: monthLabel(target, t.lang) })}</p>
          {alerts.length ? <ol className="fc-alert-list">{shown.map(r => {
            const d = byId.get(r.district_id); const s = d ? stateById.get(d.state_id) : undefined;
            const drivers = isDriverList(r.drivers) ? r.drivers.filter(x => x.w > 0).slice(0, 2) : []; const inp = asInputs(r.inputs);
            const x = timesUsual(r.prob, r.typical_prob); const pp = climateEffectPp(r.prob, r.prob_no_climate);
            return <li key={r.district_id}><button type="button" className="fc-alert" onClick={() => setSearch({ district: r.district_id })}>
              <span className="fc-alert-head"><strong>{d?.name ?? r.district_id}</strong><span className="sub">{stateName(s, t.lang)}</span><TierBadge tier={r.risk_level} /></span>
              <span className="fc-alert-metrics"><span><b>{pctText(r.prob)}</b> {t('fcx.prob').toLowerCase()}</span><span>{x == null ? t('fcx.noUsual') : t('fcx.vsUsual', { x: x >= 10 ? Math.round(x) : x.toFixed(1) })}</span>{pp != null && Math.abs(pp) >= 0.5 && <span className={pp > 0 ? 'fc-up' : 'fc-down'}>{pp > 0 ? t('fcx.climateUp', { pp: pp.toFixed(1) }) : t('fcx.climateDown', { pp: Math.abs(pp).toFixed(1) })}</span>}</span>
              {drivers.length > 0 && <ul className="fc-drivers">{drivers.map((dr, i) => <DriverLine key={i} d={dr} inputs={inp} />)}</ul>}
            </button></li>;
          })}</ol> : <p className="drawer-empty">{t('fcx.noAlerts')}</p>}
          {alerts.length > 8 && <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)}>{expanded ? t('fcx.showFewer') : t('fcx.showAll', { n: alerts.length })}</Button>}
        </div>
        <div className="flex flex-col gap-4">
          <div className="fc-side-card"><h3 className="fc-h3"><ShieldAlert className="size-4" />{t('fcx.precautions')} · {t(DISEASE_FC_KEY[disease])}</h3><Precautions disease={disease} tier={topTier} /></div>
          {byState.length > 0 && <div className="fc-side-card"><h3 className="fc-h3">{t('fcx.byState')}</h3><ol className="fc-state-list">{byState.map(([id, n]) => <li key={id}><button type="button" onClick={() => setSearch({ state: id, district: undefined })}>{stateName(stateById.get(id), t.lang)}</button><span className="tabular-nums">{formatIN(n)}</span></li>)}</ol></div>}
        </div>
      </div>
      <details className="fc-method"><summary><Info className="inline size-3 mr-1" />{t('fcx.method')}</summary><p className="sub mt-2">{t('fcx.methodBody', { n: nReports })}</p>
        {stats?.levels && <ul className="fc-levels">{(['very_high', 'high', 'moderate', 'low'] as Tier[]).map(k => { const l = stats.levels?.[k]; return <li key={k}><TierBadge tier={k} /><span>{t(`fcx.level.${k}` as const, { r: l?.outbreak_rate == null ? '—' : (l.outbreak_rate * 100).toFixed(1) })}</span></li>; })}</ul>}
        <p className="sub mt-2">{t('fcx.disclaimer')}</p></details>
    </>}
  </section>;
}

/** "2026-09-01" + 2 → "2026-11-01" */
export function addMonths(date: string, n: number) {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)) - 1 + n;
  return `${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
}

