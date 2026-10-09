import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useSearch, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { Activity, ArrowUpRight, Bell, MapPin, RefreshCw, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PAGE_DETAILS, validateContext } from '@/lib/epiradar';
import { surveillanceQuery, trustQuery } from '@/lib/surveillance-query';
import { asCard, cardCutoff, pct } from '@/lib/trust';
import { commandMetrics, fastestBuilding, formatNumber, formatProbability, joinMunicipalities, type LiveEvent } from '@/lib/surveillance';
import { RiskWorkspace } from './risk-workspace';
import { useReplayEvents } from '@/lib/live-store';

function RelativeTime({ ts }: { ts: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  if (!ts) return <span>Date unavailable</span>;
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return <span>Date unavailable</span>;
  return <time dateTime={ts} title={date.toISOString()}>{now === null ? ts.slice(0, 10) : formatDistanceToNow(date, { addSuffix: true })}</time>;
}
function EventRow({ event }: { event: LiveEvent }) {
  return <li className="event-row"><span className="event-dot" /><div><div className="event-meta"><span>{event.kind ?? 'Event'}</span><RelativeTime ts={event.ts} /></div><p>{event.message ?? 'No event message provided.'}</p></div></li>;
}
export function SurveillanceError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const client = useQueryClient();
  return <div className="empty-content" role="alert"><h1>Surveillance data unavailable</h1><p>The data connection could not be reached. No substitute values are shown.</p><Button className="mt-5" onClick={async () => { await client.invalidateQueries({ queryKey: ['surveillance'] }); await router.invalidate(); reset(); }}><RefreshCw />Try again</Button></div>;
}
export function SurveillancePage({ kind }: { kind: 'command' | 'map' }) {
  const context = validateContext(useSearch({ strict: false }));
  const { data, isFetching, error, refetch } = useSuspenseQuery(surveillanceQuery(context.disease, context.horizon));
  const replayEvents = useReplayEvents();
  const rows = joinMunicipalities(data.regions, data.predictions);
  const metrics = commandMetrics(rows);
  const fastest = fastestBuilding(rows, data.baseline);
  const page = PAGE_DETAILS[kind];
  const forecastsLoaded = data.predictions.length > 0;
  const openAlerts = data.errors.alerts ? null : data.alerts.filter(alert => alert.status === 'open').length;
  const cutoff = cardCutoff(asCard(useQuery(trustQuery(context.disease)).data?.run?.card));
  const provenance = [...new Map(data.predictions.map(row => [`${row.issue_week}:${row.model_version}`, { week: row.issue_week, version: row.model_version }])).values()];
  return <>
    <p className="eyebrow">{page.eyebrow}</p><div className="page-heading"><div><h1>{page.title}</h1><p className="page-description">{page.description}</p></div><Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()} aria-label="Refresh surveillance data"><RefreshCw className={isFetching ? 'refresh-spinning' : ''} />Refresh</Button></div>
    {(error || data.errors.regions) && <div className="forecast-notice" role="alert">{error ? 'The latest refresh failed. Last retrieved data remains visible.' : 'Municipality records could not be retrieved.'}</div>}
    {kind === 'command' && <>
      <div className="kpi-strip">{[
        { label: 'High / Very high risk', value: metrics.elevated, icon: MapPin, note: forecastsLoaded ? 'Municipalities with elevated risk' : 'Awaiting municipality forecasts' },
        { label: 'People in elevated-risk areas', value: metrics.population, icon: Users, note: 'Resident population · not predicted infections' },
        { label: 'Expected cases', value: metrics.cases, icon: Activity, note: `${context.horizon}-week horizon · median estimates` },
        { label: 'Open alerts', value: openAlerts, icon: Bell, note: data.errors.alerts ? 'Alert data could not be retrieved' : openAlerts ? `Open warnings · ${context.disease}` : `None open · alert at ≥ ${pct(cutoff)}` }` : 'No alert records loaded' },
      ].map(metric => <div className="command-metric" key={metric.label}><div className="metric-label">{metric.label}<metric.icon /></div><strong>{formatNumber(metric.value)}</strong><p>{metric.note}</p></div>)}</div>
      <div className="provenance">{provenance.length ? provenance.map(item => <span key={`${item.week}:${item.version}`}>Forecast issued for the week of {item.week ?? 'unavailable'} · {item.version ?? 'Model version unavailable'}</span>) : <span>Forecast issue week and model version will appear when predictions are loaded.</span>}<span>Cases: OpenDengue V1.3 (probable dengue cases, weekly, by municipality)</span><span>{forecastsLoaded ? `${formatNumber(data.predictions.length)} of ${formatNumber(data.regions.length)} municipalities with forecasts` : 'Forecast data not loaded yet'}</span></div>
    </>}
    <div className={kind === 'command' ? 'command-layout' : ''}>
      <RiskWorkspace rows={rows} fullHeight={kind === 'map'} forecastError={data.errors.forecasts} />
      {kind === 'command' && <aside className="command-insights"><section className="panel"><div className="panel-header"><div><h2>Risk building fastest</h2><p className="panel-subtitle">1 week → {context.horizon} {context.horizon === 1 ? 'week' : 'weeks'} · same forecast issue</p></div><TrendingUp /></div>
        {fastest.length ? <ol className="fastest-list">{fastest.map(row => <li key={row.region.id}><Button variant="link" asChild><a href={`/?${new URLSearchParams({ disease: context.disease, horizon: String(context.horizon), region: row.region.id })}`}>{row.region.name}<ArrowUpRight /></a></Button><div><span>{formatProbability(row.baseline)} <span className="text-muted-foreground">→</span> <strong>{formatProbability(row.prediction?.outbreak_prob)}</strong></span><span className="risk-increase">+{Math.round(row.increase * 100)} pp</span></div></li>)}</ol> : <div className="insight-empty"><TrendingUp /><h3>{data.errors.forecasts ? 'Forecasts unavailable' : context.horizon === 1 ? 'Select a longer horizon' : 'No rising risk signals yet'}</h3><p>{context.horizon === 1 ? 'Risk increases compare the 1-week forecast with a longer horizon.' : data.baseline.length && forecastsLoaded ? 'No increases found among forecasts from the same issue week and model version.' : 'The five fastest-building risks will appear when matching 1-week and selected-horizon predictions are loaded.'}</p></div>}
      </section><section className="panel"><div className="panel-header"><div><h2>Live event feed</h2><p className="panel-subtitle">Latest pipeline and surveillance events</p></div><Activity /></div>{data.events.length || replayEvents.length ? <ul className="event-feed">{replayEvents.map(event => <li key={event.id} className="event-row"><span className="event-dot" /><div><div className="event-meta"><span className="replay-tag">REPLAY</span><RelativeTime ts={event.ts} /></div><p>{event.message}</p></div></li>)}{data.events.map(event => <EventRow key={event.id} event={event} />)}</ul> : <div className="insight-empty"><Activity /><h3>{data.errors.events ? 'Events could not be retrieved' : 'No live events loaded'}</h3><p>Pipeline activity and surveillance updates will appear here as real events arrive.</p></div>}</section></aside>}
    </div><footer className="page-footer"><span><ShieldCheck className="size-3" />DECISION SUPPORT · NOT A CLINICAL DIAGNOSIS</span><span>MODEL ASSOCIATIONS · NOT PROOF OF CAUSE</span></footer>
  </>;
}