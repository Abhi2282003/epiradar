import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { ClientOnly, Link, useSearch } from '@tanstack/react-router';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudSun, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { PAGE_DETAILS, RISK_SCALE, validateContext } from '@/lib/epiradar';
import { surveillanceQuery } from '@/lib/surveillance-query';
import { formatNumber, formatProbability, joinMunicipalities, type Municipality, type Prediction } from '@/lib/surveillance';
import { riskFromProbability } from '@/lib/replay';
import { atHighOrAbove, compareScenario, findProb, formatDelta, scenarioSteps, snap } from '@/lib/scenario';
import { getScenarioMeta, getScenarioRegion, getScenarioState } from '@/lib/scenario.functions';
import { RiskBadge, WeatherAgo } from './risk-workspace';

const MunicipalityMap = lazy(() => import('./municipality-map'));
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? <p className="drawer-empty">The map could not be loaded.</p> : this.props.children; }
}
export const scenarioMetaQuery = (disease: string) => ({ queryKey: ['scenarios', 'meta', disease], queryFn: () => getScenarioMeta({ data: { disease } }), staleTime: 60_000, refetchInterval: 120_000 });
const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
const bandIndex = (p: number | null) => { const l = riskFromProbability(p); return l ? RISK_SCALE.findIndex(r => r.label === l) : 4; };

function Intro({ model }: { model: string | null }) {
  return <div className="data-notice"><FlaskConical /><p><strong>What if the last 12 weeks had been wetter or drier, warmer or cooler?</strong>Only the climate inputs change; case history stays as observed. This is a sensitivity test of the forecast model, not a climate projection.{' '}<span className="font-mono text-xs">Climate model: {model ?? '— (no model run with climate inputs yet)'}</span></p></div>;
}

function EmptyLab({ disease, outlook }: { disease: string; outlook: { region_id: string; name: string; suit: number | null; rain: number | null; updated_at: string }[] | null }) {
  const context = validateContext(useSearch({ strict: false }));
  return <>
    <section className="panel"><div className="empty-content"><div className="empty-icon"><FlaskConical /></div><h3>No scenarios for {disease} yet</h3><p>The Scenario lab needs the climate-informed model. Run the pipeline notebook with climate on; scenarios appear here automatically.</p><Button asChild variant="outline" className="mt-4"><Link to="/trust" search={context}>Open Model &amp; data</Link></Button></div></section>
    <section className="replay-card mt-5"><div className="panel-header-inline"><h2>Live climate outlook</h2><CloudSun /></div><p className="sub">Weather, not a model scenario · Open-Meteo 16-day forecast · highest transmission suitability</p>
      {outlook == null ? <p className="drawer-empty">Weather could not be retrieved.</p> : !outlook.length ? <p className="drawer-empty">The outlook will appear after the first Open-Meteo weather refresh.</p> :
        <div className="municipality-table-wrap"><table className="municipality-table"><thead><tr><th>Municipality</th><th>Suitability, next 16 days</th><th>Rain, next 16 days</th></tr></thead>
          <tbody>{outlook.map(o => <tr key={o.region_id}><td>{o.name}</td><td>{o.suit == null ? '—' : `${Math.round(o.suit * 100)}% of peak`}</td><td>{o.rain == null ? '—' : `${formatNumber(o.rain)} mm`}</td></tr>)}</tbody></table></div>}
      {outlook?.[0] && <p className="drawer-caption">Open-Meteo · updated <WeatherAgo ts={outlook[0].updated_at} /> · suitability is a temperature curve, not an outbreak probability</p>}
    </section>
  </>;
}

function Lab({ disease, horizon, rows }: { disease: string; horizon: number; rows: Municipality[] }) {
  const ranked = useMemo(() => [...rows].filter(r => r.prediction?.outbreak_prob != null).sort((a, b) => b.prediction!.outbreak_prob! - a.prediction!.outbreak_prob!), [rows]);
  const [region, setRegion] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const chosen = region ?? ranked[0]?.region.id ?? rows[0]?.region.id ?? null;
  const name = rows.find(r => r.region.id === chosen)?.region.name ?? chosen ?? '—';
  const regionQ = useQuery({ queryKey: ['scenarios', 'region', disease, chosen], queryFn: () => getScenarioRegion({ data: { disease, region: chosen! } }), enabled: !!chosen, staleTime: 300_000 });
  const steps = useMemo(() => scenarioSteps(regionQ.data ?? []), [regionQ.data]);
  const [rain, setRain] = useState(0);
  const [temp, setTemp] = useState(0);
  useEffect(() => { if (steps.rain.length) setRain(r => snap(steps.rain, r)); if (steps.temp.length) setTemp(t => snap(steps.temp, t)); }, [steps]);
  const stateQ = useQuery({ queryKey: ['scenarios', 'state', disease, horizon, rain, temp], queryFn: () => getScenarioState({ data: { disease, horizon, rain, temp } }), staleTime: 300_000 });
  const data = regionQ.data ?? [];
  const prob = findProb(data, rain, temp, horizon), base = findProb(data, 0, 0, horizon);
  const cmp = compareScenario(prob, base);
  const hasBaseline = steps.rain.includes(0) && steps.temp.includes(0);
  const lineData = [1, 2, 3, 4, 5, 6, 7, 8].map(h => ({ h, base: findProb(data, 0, 0, h), scenario: findProb(data, rain, temp, h) })).map(d => ({ h: d.h, base: d.base == null ? null : d.base * 100, scenario: d.scenario == null ? null : d.scenario * 100 }));
  const mapRows: Municipality[] = useMemo(() => {
    const by = new Map((stateQ.data?.scenario ?? []).map(r => [r.region_id, r.outbreak_prob]));
    return rows.map(r => { const p = by.get(r.region.id) ?? null; return { region: r.region, prediction: p == null ? null : ({ outbreak_prob: p, risk_level: riskFromProbability(p) } as Prediction) }; });
  }, [rows, stateQ.data]);
  const highScenario = stateQ.data ? atHighOrAbove(stateQ.data.scenario.map(r => r.outbreak_prob)) : null;
  const highBase = stateQ.data ? atHighOrAbove(stateQ.data.baseline.map(r => r.outbreak_prob)) : null;
  const matches = rows.filter(r => r.region.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const sliderFor = (label: string, list: number[], value: number, set: (v: number) => void, unit: '%' | '°C') => {
    const i = Math.max(0, list.findIndex(v => v === value));
    return <div className="scenario-slider"><label>{label} <strong>{list.length ? formatDelta(value, unit) : '—'}</strong></label>
      <Slider aria-label={label} min={0} max={Math.max(0, list.length - 1)} step={1} value={[i]} disabled={list.length < 2} onValueChange={v => { const n = list[v[0] ?? 0]; if (n != null) set(n); }} />
      <div className="slider-endpoints"><span>{list[0] != null ? formatDelta(list[0], unit) : ''}</span><span>{list.length ? formatDelta(list[list.length - 1]!, unit) : ''}</span></div></div>;
  };
  return <>
    <section className="replay-card"><div className="scenario-controls">
      <div className="scenario-picker"><label htmlFor="scenario-search" className="control-label">MUNICIPALITY</label>
        <input id="scenario-search" className="scenario-search" placeholder={name} value={search} onChange={e => setSearch(e.target.value)} aria-describedby="scenario-current" />
        <p id="scenario-current" className="sub">Showing {name}{!region && ranked[0] ? ` · highest current ${horizon}-week risk` : ''}</p>
        {search && <ul className="scenario-matches" role="listbox">{matches.map(m => <li key={m.region.id}><Button variant="ghost" size="sm" onClick={() => { setRegion(m.region.id); setSearch(''); }}>{m.region.name}</Button></li>)}{!matches.length && <li className="sub">No municipality matches.</li>}</ul>}</div>
      {sliderFor('Rain, last 12 weeks', steps.rain, rain, setRain, '%')}
      {sliderFor('Temperature, last 12 weeks', steps.temp, temp, setTemp, '°C')}
      <p className="sub">Horizon: {horizon} {horizon === 1 ? 'week' : 'weeks'} (top bar)</p>
    </div></section>
    {regionQ.isPending ? <Skeleton className="mt-5 h-40" /> : regionQ.isError ? <p className="drawer-empty mt-5">Scenarios for this municipality could not be retrieved.</p> : !data.length ? <p className="drawer-empty mt-5">No scenario rows for {name}.</p> : <>
      <section className="replay-card mt-5 scenario-headline"><div><span className="control-label">{name.toUpperCase()} · {horizon}-WEEK FORECAST</span>
        <p className="scenario-numbers"><strong>{formatProbability(prob)}</strong> under this scenario <span className="sub">vs</span> <strong>{formatProbability(base)}</strong> with no change</p>
        <p>{cmp.deltaPp == null ? (hasBaseline ? 'Change unavailable for this horizon.' : 'No no-change (0 %, 0 °C) scenario in the data.') : `${cmp.deltaPp > 0 ? '+' : ''}${cmp.deltaPp} percentage points · `}{cmp.deltaPp != null && (cmp.bandChanged ? <>risk band moves <RiskBadge level={cmp.from} /> → <RiskBadge level={cmp.to} /></> : <>risk band stays <RiskBadge level={cmp.to} /></>)}</p></div></section>
      <div className="scenario-grid mt-5">
        <section className="replay-card"><h2>All scenarios for {name}</h2><p className="sub">Outbreak probability at {horizon} weeks · rain change (rows) × temperature change (columns)</p>
          <div className="heatmap" role="grid" style={{ gridTemplateColumns: `auto repeat(${steps.temp.length}, minmax(0,1fr))` }}>
            <span />{steps.temp.map(t => <span key={t} className="heat-head">{formatDelta(t, '°C')}</span>)}
            {[...steps.rain].reverse().map(r => <div key={r} role="row" className="contents"><span className="heat-head">{formatDelta(r, '%')}</span>{steps.temp.map(t => { const p = findProb(data, r, t, horizon); const sel = r === rain && t === temp; return <button key={t} type="button" role="gridcell" aria-selected={sel} className={`heat-cell heat-${bandIndex(p)} ${sel ? 'heat-selected' : ''}`} title={`Rain ${formatDelta(r, '%')}, temperature ${formatDelta(t, '°C')}: ${formatProbability(p)} (${riskFromProbability(p) ?? 'No data'})`} onClick={() => { setRain(r); setTemp(t); }}>{formatProbability(p)}</button>; })}</div>)}
          </div><p className="drawer-caption">Colours use the risk bands: Low &lt; 20%, Moderate &lt; 40%, High &lt; 70%, Very high ≥ 70%. Click a cell to select it.</p></section>
        <section className="replay-card"><h2>Across horizons</h2><p className="sub">No change vs {formatDelta(rain, '%')} rain, {formatDelta(temp, '°C')}</p>
          <div className="h-56"><ResponsiveContainer><LineChart data={lineData} margin={{ left: -16, right: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="h" {...axis} tickFormatter={h => `${h}w`} /><YAxis domain={[0, 100]} {...axis} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }} labelFormatter={h => `${h} weeks ahead`} formatter={(v: number) => `${Math.round(v)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line name="No change" dataKey="base" stroke="var(--muted-foreground)" strokeDasharray="5 4" isAnimationActive={false} connectNulls />
            <Line name="Scenario" dataKey="scenario" stroke="var(--primary)" strokeWidth={2.5} isAnimationActive={false} connectNulls />
          </LineChart></ResponsiveContainer></div></section>
      </div>
    </>}
    <section className="replay-card mt-5"><h2>State view under this scenario</h2>
      <p className="sub">{stateQ.isError ? 'State scenario could not be retrieved.' : highScenario == null ? 'Loading…' : `Municipalities at High or above: ${formatNumber(highScenario)} under this scenario vs ${formatNumber(highBase)} with no change`}</p>
      <div className="replay-map"><Boundary><ClientOnly fallback={<Skeleton className="h-full" />}><Suspense fallback={<Skeleton className="h-full" />}>
        <MunicipalityMap rows={mapRows} selected={chosen ?? undefined} onSelect={id => setRegion(id)} label="Municipality outbreak risk under the chosen scenario" tooltip={row => [`Under scenario: ${formatProbability(row.prediction?.outbreak_prob)} · ${riskFromProbability(row.prediction?.outbreak_prob) ?? 'No data'}`]} />
      </Suspense></ClientOnly></Boundary></div>
      <div className="replay-legend">{RISK_SCALE.map((r, i) => <span className="risk-item" key={r.label}><span className={`risk-swatch risk-${i}`} />{r.label}</span>)}</div>
    </section>
  </>;
}

export function ScenarioLab() {
  const context = validateContext(useSearch({ strict: false }));
  const page = PAGE_DETAILS.scenarios;
  const { data: meta } = useSuspenseQuery(scenarioMetaQuery(context.disease));
  const { data: surv } = useSuspenseQuery(surveillanceQuery(context.disease, context.horizon));
  const rows = joinMunicipalities(surv.regions, surv.predictions);
  return <>
    <p className="eyebrow">{page.eyebrow}</p>
    <div className="page-heading"><div><h1>{page.title}</h1><p className="page-description">{page.description}</p></div></div>
    <Intro model={meta.climateModel} />
    {meta.hasScenarios ? <Lab disease={context.disease} horizon={context.horizon} rows={rows} /> : <EmptyLab disease={context.disease} outlook={meta.outlook} />}
    <footer className="page-footer"><span>SENSITIVITY TEST · NOT A CLIMATE PROJECTION</span><span>MODEL ASSOCIATIONS · NOT PROOF OF CAUSE</span></footer>
  </>;
}
