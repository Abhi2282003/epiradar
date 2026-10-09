import { useSearch, Link } from '@tanstack/react-router';
import { Activity, ArrowUpRight, Bell, CircleHelp, CloudSun, Database, FlaskConical, History, Layers, Map, Radar, ShieldCheck, Unplug, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PAGE_DETAILS, RISK_SCALE, validateContext, type PageKind } from '@/lib/epiradar';
function EmptyPanel({ title, subtitle, icon: Icon, heading, description, radar = false, legend = false }: { title: string; subtitle: string; icon: LucideIcon; heading: string; description: string; radar?: boolean; legend?: boolean }) {
  return <section className="panel"><div className="panel-header"><div><h2>{title}</h2><p className="panel-subtitle">{subtitle}</p></div><Icon /></div><div className="empty-content"><div className={radar ? 'radar-art' : 'empty-icon'}>{radar ? <Radar /> : <Icon />}</div><h3>{heading}</h3><p>{description}</p>{radar && <span className="waiting-label"><span className="status-dot" />AWAITING SURVEILLANCE DATA</span>}</div>{legend && <div className="panel-footer" aria-label="Risk scale"><span className="legend-title">RISK SCALE</span>{RISK_SCALE.map((risk, index) => <span className="risk-item" key={risk.label}><span className={`risk-swatch risk-${index}`} aria-hidden="true" />{risk.label}</span>)}</div>}</section>;
}
const specificPanels: Record<Exclude<PageKind, 'command'>, { title: string; subtitle: string; icon: LucideIcon; heading: string; description: string }> = {
  map: { title: 'Regional risk map', subtitle: 'Geographic outbreak surveillance', icon: Map, heading: 'No regional data loaded', description: 'Regional boundaries and labelled outbreak probabilities will appear here. Map data is not loaded yet.' },
  scenarios: { title: 'Climate scenarios', subtitle: 'Compare potential outbreak drivers', icon: FlaskConical, heading: 'Scenarios are not available yet', description: 'Climate inputs and model-based scenario comparisons will appear here. Model and climate data are not loaded yet.' },
  replay: { title: 'Epidemic replay', subtitle: 'Historical signals and outbreak progression', icon: History, heading: 'No historical epidemics loaded', description: 'Past epidemics and their early-warning timelines will appear here. Historical data is not loaded yet.' },
  alerts: { title: 'Alert feed', subtitle: 'Emerging risks requiring attention', icon: Bell, heading: 'Alert data is not loaded yet', description: 'Outbreak warnings, affected regions and alert histories will appear here once surveillance data is loaded.' },
  trust: { title: 'Model & data readiness', subtitle: 'Coverage, provenance and reliability', icon: ShieldCheck, heading: 'Model information not loaded', description: 'Model documentation, validation results and data provenance will appear here. Model and source data are not loaded yet.' },
};
export function PageSkeleton() {
  return <div role="status" aria-label="Loading dashboard" aria-busy="true"><Skeleton className="h-8 w-52 mb-4" /><Skeleton className="h-4 w-3/4 mb-8" /><div className="loading-grid">{[0, 1, 2].map(key => <Skeleton key={key} className="loading-block" />)}</div><Skeleton className="loading-main" /><span className="sr-only">Loading surveillance data</span></div>;
}
export function DashboardPage({ kind }: { kind: PageKind }) {
  const page = PAGE_DETAILS[kind];
  const context = validateContext(useSearch({ strict: false }));
  return <>
    <p className="eyebrow">{page.eyebrow}</p>
    <div className="page-heading"><div><h1>{page.title}</h1><p className="page-description">{page.description}</p></div><span className="outline-status"><Database className="size-3" />Data not loaded</span></div>
    <div className="data-notice"><Unplug /><p><strong>Your workspace is ready. Data is not loaded yet.</strong>Outbreak forecasts will appear once surveillance and climate data are connected.</p>{kind === 'command' && <Button asChild variant="ghost" size="icon" title="View model and data readiness" aria-label="View model and data readiness"><Link to="/trust" search={context}><ArrowUpRight /></Link></Button>}</div>
    {kind === 'command' ? <>
      <div className="overview-grid">{[{ title: 'Regions at elevated risk', icon: Map, foot: 'Awaiting regional forecasts' }, { title: 'Active outbreak alerts', icon: Bell, foot: 'Awaiting surveillance data' }, { title: 'Forecast confidence', icon: ShieldCheck, foot: 'Awaiting model estimates' }].map(metric => <section className="metric-card" key={metric.title}><div className="metric-label">{metric.title}<metric.icon /></div><div className="metric-empty" aria-label="Not available">—</div><div className="metric-foot"><span className="status-dot" />{metric.foot}</div></section>)}</div>
      <div className="main-grid"><EmptyPanel title="Regional outbreak risk" subtitle={`${context.disease} · ${context.horizon}-week forecast horizon`} icon={Layers} heading="The next signal starts here" description="Outbreak probabilities by region will appear here. Surveillance and climate data are not loaded yet." radar legend /><div className="right-stack"><EmptyPanel title="What's driving the risk" subtitle="Climate and surveillance signals" icon={CloudSun} heading="No drivers to explain yet" description="Key climate and disease indicators will appear here once data is loaded." /><EmptyPanel title="Latest alerts" subtitle="Early warnings for your regions" icon={Bell} heading="Awaiting alert data" description="New outbreak warnings will appear here. Alert data is not loaded yet." /></div></div>
      <section className="panel lower-panel"><div className="panel-header"><div><h2>Regional watchlist</h2><p className="panel-subtitle">Prioritise regions by outbreak probability and forecast confidence</p></div><Activity /></div><div className="table-head"><span>REGION</span><span>OUTBREAK RISK</span><span>PROBABILITY</span><span>CONFIDENCE</span></div><div className="table-empty"><Database />No regions loaded yet. Regional forecasts will appear here.</div></section>
    </> : <EmptyPanel {...specificPanels[kind]} radar={kind === 'map'} legend={kind === 'map'} />}
    <footer className="page-footer"><span><ShieldCheck className="size-3" />DECISION SUPPORT · NOT A CLINICAL DIAGNOSIS</span><span><span className="status-dot" />DATA CONNECTION PENDING</span></footer>
  </>;
}
