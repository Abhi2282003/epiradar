import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { indiaModelCardQuery, indiaOverviewQuery } from '@/lib/india-query';
import { INDIA_DISEASES, SUITABILITY_FORMULAS, indiaToday, yearsInfo } from '@/lib/india';
import { DISEASE_FC_KEY, FC_DISEASES, isFcDisease, type FcDisease, type Tier } from '@/lib/india-forecast';
import { DISEASE_KEY, formatIN, useT, type Key } from '@/lib/i18n';
import { When } from './india-page';
import { TierBadge } from './india-forecast';

const IDS = ['ncvbdc', 'datameet_boundaries', 'open_meteo_india', 'icts_karnataka', 'who_gho', 'epiclim_idsp', 'nasa_power_india', 'india_forecast'];
const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
type Metric = { disease: string; h: number; variant: string; mean_year_roc?: number; mean_year_pr?: number; mean_year_top10?: number; base_rate?: number; pr_auc?: number; roc_auc?: number; recall_top10?: number };
const VARIANT_KEY: Record<string, Key> = {
  'climate+history': 'tm.v.full', 'history only': 'tm.v.hist', 'climate only': 'tm.v.clim', 'seasonal history (baseline)': 'tm.v.seasonal', 'climate+history+recent reports': 'tm.v.rec',
};
const METRICS = { roc: 'mean_year_roc', pr: 'mean_year_pr', top: 'mean_year_top10' } as const;
const n3 = (v: number | undefined) => v == null ? '—' : v.toFixed(3);
const p0 = (v: number | undefined) => v == null ? '—' : `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;

function IndiaModelCard() {
  const t = useT();
  const q = useQuery(indiaModelCardQuery);
  const [metric, setMetric] = useState<keyof typeof METRICS>('roc');
  const card = q.data?.card ?? null;
  const metrics = useMemo(() => (Array.isArray(card?.['metrics']) ? card!['metrics'] as Metric[] : []), [card]);
  const get = (d: string, h: number, v: string) => metrics.find(m => m.disease === d && m.h === h && m.variant === v);
  const chart = FC_DISEASES.map(d => ({ disease: t(DISEASE_FC_KEY[d]), ...Object.fromEntries(['climate+history', 'history only', 'climate only', 'seasonal history (baseline)'].map(v => [v, get(d, 1, v)?.[METRICS[metric]] ?? null])) }));
  const tiers = card?.['tiers'] as Record<string, { base_rate?: number; levels?: Record<string, { share?: number; outbreak_rate?: number | null; outbreaks_caught?: number }> }> | undefined;
  const limits = Array.isArray(card?.['limits']) ? card!['limits'] as string[] : [];
  const byDisease = card?.['events_by_disease'] as Record<string, number> | undefined;
  if (q.isPending) return <p className="sub">{t('common.loading')}</p>;
  if (q.isError) return <p className="sub">{t('common.error')}</p>;
  if (!card) return <div className="forecast-notice">{t('tm.noCard')}</div>;
  const yMin = metric === 'roc' ? 0.5 : 0;
  return <>
    {limits.length > 0 && <section className="limitations" aria-label={t('trust.india.limits')}><AlertTriangle /><div><h2>{t('trust.india.limits')}</h2><ul>{limits.map(c => <li key={c}>{c}</li>)}</ul></div></section>}
    <section className="replay-card"><h2>{t('tm.title')}</h2><p className="sub">{t('tm.sub')}</p>
      <div className="municipality-table-wrap mt-3"><table className="municipality-table"><thead><tr><th>{t('tm.colDisease')}</th><th>{t('tm.colH')}</th><th>{t('tm.colRoc')}</th><th>{t('tm.colPr')}</th><th>{t('tm.colTop')}</th><th>{t('tm.colBase')}</th></tr></thead>
        <tbody>{FC_DISEASES.flatMap(d => [1, 2, 3].map(h => { const m = get(d, h, 'climate+history'); return m ? <tr key={`${d}${h}`}><td>{h === 1 ? t(DISEASE_FC_KEY[d]) : ''}</td><td>{h}</td><td>{n3(m.mean_year_roc)}</td><td>{n3(m.mean_year_pr)}</td><td>{p0(m.mean_year_top10)}</td><td>{p0(m.base_rate)}</td></tr> : null; }))}</tbody></table></div>
    </section>
    <section className="replay-card mt-4"><div className="panel-title-row"><div><h2>{t('tm.ablation')}</h2><p className="sub">{t('tm.ablationSub')}</p></div>
      <div className="view-toggle">{(['roc', 'pr', 'top'] as const).map(k => <button key={k} type="button" className={metric === k ? 'bg-secondary rounded px-2' : 'px-2'} aria-pressed={metric === k} onClick={() => setMetric(k)}>{k === 'roc' ? 'ROC-AUC' : k === 'pr' ? 'PR-AUC' : t('tm.colTop')}</button>)}</div></div>
      <div className="h-72 mt-2"><ResponsiveContainer><BarChart data={chart} margin={{ left: -12, right: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="disease" {...axis} /><YAxis domain={[yMin, 'auto']} {...axis} tickFormatter={v => metric === 'top' ? `${Math.round(v * 100)}%` : Number(v).toFixed(2)} />
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }} formatter={v => typeof v === 'number' ? (metric === 'top' ? `${(v * 100).toFixed(1)}%` : v.toFixed(3)) : '—'} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar name={t('tm.v.full')} dataKey="climate+history" fill="var(--primary)" isAnimationActive={false} />
        <Bar name={t('tm.v.hist')} dataKey="history only" fill="var(--muted-foreground)" isAnimationActive={false} />
        <Bar name={t('tm.v.clim')} dataKey="climate only" fill="var(--rain-3)" isAnimationActive={false} />
        <Bar name={t('tm.v.seasonal')} dataKey="seasonal history (baseline)" fill="var(--risk-no-data)" isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div>
    </section>
    {tiers && <section className="replay-card mt-4"><h2>{t('tm.levels')}</h2><p className="sub">{t('tm.levelsSub')}</p>
      <div className="municipality-table-wrap mt-2"><table className="municipality-table"><thead><tr><th>{t('tm.colDisease')}</th>{(['very_high', 'high', 'moderate', 'low'] as Tier[]).map(k => <th key={k}><TierBadge tier={k} /></th>)}<th>{t('tm.colBase')}</th></tr></thead>
        <tbody>{FC_DISEASES.map(d => { const s = tiers[`${d}|1`]; return s ? <tr key={d}><td>{t(DISEASE_FC_KEY[d])}</td>{(['very_high', 'high', 'moderate', 'low'] as Tier[]).map(k => <td key={k}>{p0(s.levels?.[k]?.outbreak_rate ?? undefined)}</td>)}<td>{p0(s.base_rate)}</td></tr> : null; })}</tbody></table></div>
    </section>}
    <section className="replay-card mt-4"><h2>{t('tm.data')}</h2><dl className="def-list mt-2">
      <div><dt>Model</dt><dd>{String(card['model_version'] ?? '—')}</dd></div>
      <div><dt>Unit</dt><dd>{String(card['unit'] ?? '—')}</dd></div>
      <div><dt>Target</dt><dd>{String(card['target'] ?? '—')}</dd></div>
      <div><dt>Data</dt><dd>{String(card['data'] ?? '—')}</dd></div>
      <div><dt>Validation</dt><dd>{String(card['validation'] ?? '—')}</dd></div>
      <div><dt>Climate normals</dt><dd>{String(card['climate_normals'] ?? '—')}</dd></div>
      {byDisease && <div><dt>{t('dd.outbreaks')}</dt><dd>{Object.entries(byDisease).filter(([k]) => isFcDisease(k)).map(([k, v]) => `${t(DISEASE_FC_KEY[k as FcDisease])} ${formatIN(v)}`).join(' · ')}</dd></div>}
    </dl></section>
  </>;
}

export function IndiaTrust() {
  const t = useT();
  const q = useQuery(indiaOverviewQuery);
  if (q.isPending) return <p className="sub">{t('common.loading')}</p>;
  if (q.isError) return <p className="sub">{t('common.error')}</p>;
  const { burden, sources, states } = q.data;
  const ids = new Set(states.map(s => s.id));
  const year = Number(indiaToday().slice(0, 4));
  const src = sources.filter(s => IDS.includes(s.id));
  return <div className="flex flex-col gap-4">
    <IndiaModelCard />
    <section className="replay-card"><h2>{t('trust.india.sources')}</h2>
      {src.length ? <ul className="mt-2 flex flex-col gap-2 text-sm">{src.map(s => <li key={s.id}><strong>{s.name ?? s.id}</strong> · {s.status ?? '—'} · {s.cadence ?? '—'} · <When ts={s.last_success_at} lang={t.lang} />{s.note ? <div className="sub">{s.note}</div> : null}</li>)}</ul> : <p className="sub mt-2">—</p>}
    </section>
    <section className="replay-card"><h2>{t('trust.india.coverage')}</h2>
      {burden.length ? <ul className="mt-2 flex flex-col gap-1 text-sm">{INDIA_DISEASES.map(d => { const rows = burden.filter(r => r.disease_id === d && ids.has(r.admin1)); const info = yearsInfo(rows, year);
        return <li key={d}><strong>{t(DISEASE_KEY[d]!)}</strong>: {info.years.length ? `${info.years[0]}–${info.years[info.years.length - 1]}` : '—'}{info.partial.size ? ` · ${t('common.partial')}: ${[...info.partial].join(', ')}` : ''}</li>; })}</ul> : <p className="sub mt-2">{t('trust.india.noCoverage')}</p>}
    </section>
    <section className="replay-card"><h2>{t('trust.india.formulas')}</h2><ul className="mt-2 flex flex-col gap-1 text-sm font-mono">{SUITABILITY_FORMULAS.map(f => <li key={f}>{f}</li>)}</ul></section>
    <section className="replay-card"><h2>{t('fc.title')}</h2><p className="sub mt-2">{t('fc.body1')}</p><p className="sub mt-2">{t('fc.body2')}</p></section>
  </div>;
}

export { VARIANT_KEY };
