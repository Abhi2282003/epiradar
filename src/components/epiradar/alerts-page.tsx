import { PageTitle } from './i18n-ui';
import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ArrowUpDown, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_DETAILS, validateContext } from '@/lib/epiradar';
import { openAlertsQuery, surveillanceQuery, trustQuery } from '@/lib/surveillance-query';
import { formatNumber, formatProbability, joinMunicipalities } from '@/lib/surveillance';
import { ALERT_CUTOFF, byRegion } from '@/lib/replay';
import { alertHistory, asCard, cardCutoff, closestToCutoff, pct } from '@/lib/trust';
import { replayQuery } from './time-machine';
import { RiskBadge } from './risk-workspace';

const fmt = (w: string | null | undefined) => w ? new Date(`${w.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
type SortKey = 'name' | 'first' | 'onset' | 'peak' | 'lead' | 'outcome';

export function AlertsPage() {
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate();
  const page = PAGE_DETAILS.alerts;
  const { data: surv } = useSuspenseQuery(surveillanceQuery(context.disease, context.horizon));
  const { data: alerts } = useSuspenseQuery(openAlertsQuery(context.disease));
  const trust = useSuspenseQuery(trustQuery(context.disease));
  const replay = useSuspenseQuery(replayQuery);
  const cutoff = cardCutoff(asCard(trust.data?.run?.card));
  const open = (region: string) => { void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...validateContext(prev), region }) } as never); };
  const closest = closestToCutoff(joinMunicipalities(surv.regions, surv.predictions), cutoff);
  const names = new Map((replay.data?.regions ?? surv.regions).map(r => [r.id, r.name]));
  const history = replay.data ? alertHistory(byRegion(replay.data.rows)) : null;
  const [sort, setSort] = useState<SortKey>('name');
  const [desc, setDesc] = useState(false);
  const key = (i: NonNullable<typeof history>['items'][number]): string | number => ({ name: names.get(i.id) ?? i.id, first: i.firstAlertWeek ?? '', onset: i.onset ?? '', peak: i.peakWeek ?? '', lead: i.leadToOnset ?? -1, outcome: i.outcome })[sort];
  const items = [...(history?.items ?? [])].sort((a, b) => { const x = key(a), y = key(b); const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return desc ? -c : c; });
  const head = (k: SortKey, label: string) => <th aria-sort={sort === k ? desc ? 'descending' : 'ascending' : 'none'}><Button variant="ghost" size="sm" onClick={() => { setDesc(sort === k ? !desc : false); setSort(k); }}>{label}{sort === k ? desc ? <ArrowDown /> : <ArrowUp /> : <ArrowUpDown />}</Button></th>;
  return <>
    <p className="eyebrow">{page.eyebrow}</p>
    <div className="page-heading"><div><h1><PageTitle kind={'alerts'} /></h1><p className="page-description">{page.description}</p></div></div>
    <div className="trust-grid">
      <section className="replay-card"><h2>Active alerts</h2><p className="sub">Open alerts · {context.disease} · newest first</p>
        {alerts.length ? <ul className="alert-list">{alerts.map(a => <li key={a.id}><div className="alert-row-head"><Button variant="link" className="p-0 h-auto" onClick={() => a.region_id && open(a.region_id)}>{a.region_name ?? a.region_id ?? '—'}</Button><RiskBadge level={a.level} /></div><p>{a.message ?? '—'}</p><span className="font-mono text-xs text-muted-foreground">Lead {a.lead_weeks ?? '—'} weeks · issued {a.issued_at ? fmt(a.issued_at) : '—'}</span></li>)}</ul>
          : <div className="insight-empty"><Bell /><h3>No active alerts</h3><p>An alert opens when a municipality's outbreak probability reaches {pct(cutoff)} within the chosen horizon.</p></div>}
      </section>
      <section className="replay-card"><h2>Closest to the alert line</h2><p className="sub">Highest outbreak probability at {context.horizon} {context.horizon === 1 ? 'week' : 'weeks'} · cut-off {pct(cutoff)}</p>
        {closest.length ? <ol className="fastest-list">{closest.map(c => <li key={c.row.region.id}><Button variant="link" onClick={() => open(c.row.region.id)}>{c.row.region.name}</Button><div><strong>{formatProbability(c.prob)}</strong><span className="text-muted-foreground text-xs">{c.gapPp == null ? '—' : c.gapPp >= 0 ? `${c.gapPp} pp above cut-off` : `${-c.gapPp} pp below cut-off`}</span><RiskBadge level={c.row.prediction?.risk_level} /></div></li>)}</ol>
          : <p className="drawer-empty">Municipalities will appear when forecasts are loaded for this disease and horizon.</p>}
      </section>
    </div>
    <section className="replay-card mt-5"><div className="flex items-center gap-2"><span className="replay-tag">REPLAY</span><h2>Alert history, 2024 replay</h2></div>
      <p className="sub">From the 2024 backtest: what the alerts would have been. Not live alerts. 4 weeks ahead, cut-off {Math.round(ALERT_CUTOFF * 100)}%.</p>
      {replay.isPending ? <p className="drawer-empty">Loading backtest…</p> : replay.isError ? <p className="drawer-empty">Backtest data could not be retrieved.</p> : !history?.items.length ? <p className="drawer-empty">Alert history will appear when backtest rows are loaded.</p> : <>
        <div className="kpi-strip">{[['Warned before onset', history.warned], ['Outbreak without warning', history.unwarned], ['Alert, no outbreak', history.falseAlarms]].map(([l, v]) => <div className="command-metric" key={l}><div className="metric-label">{l}</div><strong>{formatNumber(v as number)}</strong><p>municipalities</p></div>)}</div>
        <div className="municipality-table-wrap mt-4"><table className="municipality-table"><thead><tr>{head('name', 'Municipality')}{head('first', 'First alert week')}{head('onset', 'Outbreak onset')}{head('peak', 'Peak week (cases)')}{head('lead', 'Lead to onset')}{head('outcome', 'Outcome')}</tr></thead>
          <tbody>{items.map(i => <tr key={i.id}><td>{names.get(i.id) ?? i.id}</td><td>{fmt(i.firstAlertWeek)}</td><td>{fmt(i.onset)}</td><td>{fmt(i.peakWeek)} ({formatNumber(i.peakCases)})</td><td>{i.leadToOnset == null ? '—' : `${i.leadToOnset} weeks`}</td><td>{i.outcome}</td></tr>)}</tbody></table></div>
      </>}
    </section>
  </>;
}
