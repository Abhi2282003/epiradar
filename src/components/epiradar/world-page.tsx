import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { CloudSun, Globe2, LineChart as LineIcon, RefreshCw, ShieldCheck, Wind } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { PAGE_DETAILS, RISK_SCALE, validateContext } from '@/lib/epiradar';
import { formatNumber, formatProbability, riskLabel } from '@/lib/surveillance';
import { countryDetailQuery, worldModelQuery, worldOverviewQuery } from '@/lib/world-query';
import { BASE_LAYERS, INCIDENCE_BINS, OVERLAYS, addDays, backtestCounts, bandFromProb, dataStopsEarly, layerDate, monthLabel, nearestCells, normIsoNum, WIND_BINS, parseDrivers, per100k, type GridCell } from '@/lib/world';
import type { CountryValue } from './world-map';

const WorldMap = lazy(() => import('./world-map'));
const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
const RISK_INDEX: Record<string, number> = { Low: 0, Moderate: 1, High: 2, 'Very high': 3, 'No data': 4 };
const num = (v: number | null | undefined, d = 1) => v == null ? '—' : v.toFixed(d);

function Ago({ ts }: { ts: string | null | undefined }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  if (!ts) return <>—</>;
  return <time dateTime={ts}>{now == null ? ts.slice(0, 16).replace('T', ' ') : formatDistanceToNow(new Date(ts), { addSuffix: true })}</time>;
}

export function WorldPage() {
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data } = useSuspenseQuery(worldOverviewQuery(context.disease));
  const page = PAGE_DETAILS.world;
  const [today, setToday] = useState<string | null>(null);
  const [globe, setGlobe] = useState(true);
  const [base, setBase] = useState('dark');
  const [metric, setMetric] = useState<'prob' | 'cases' | 'none'>('prob');
  const [overlays, setOverlays] = useState<Record<string, { on: boolean; opacity: number }>>(() => Object.fromEntries(OVERLAYS.map(o => [o.key, { on: false, opacity: 0.75 }])));
  const [wind, setWind] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean | undefined>>({});
  const [boundariesOk, setBoundariesOk] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)); }, []);
  useEffect(() => { const t = setTimeout(() => setPicked(dateInput || null), 400); return () => clearTimeout(t); }, [dateInput]);
  useEffect(() => { setStatus({}); }, [picked]);

  const values = useMemo(() => {
    const f = new Map(data.forecasts.map(x => [x.iso3, x]));
    const c = new Map(data.cases.map(x => [x.iso3, x]));
    const out = new Map<string, CountryValue>();
    for (const k of data.countries) {
      const fc = f.get(k.iso3); const cs = c.get(k.iso3);
      const level = fc ? (riskLabel(fc.risk_level) !== 'No data' ? riskLabel(fc.risk_level) : fc.outbreak_prob != null ? bandFromProb(fc.outbreak_prob) : null) : null;
      const inc = per100k(cs?.cases_12m, k.population);
      const v: CountryValue = metric === 'prob'
        ? { iso3: k.iso3, isoNum: normIsoNum(k.iso_num), name: k.name ?? k.iso3, value: fc?.outbreak_prob ?? null, band: level, label: fc ? `Next month (${monthLabel(fc.target_month)}): ${formatProbability(fc.outbreak_prob)} · ${level ?? 'No data'}` : 'No forecast', freshness: fc ? `Issued ${monthLabel(fc.issue_month)}` : `Latest data: ${monthLabel(k.dengue_last)}` }
        : { iso3: k.iso3, isoNum: normIsoNum(k.iso_num), name: k.name ?? k.iso3, value: inc, band: null, label: inc == null ? 'No case data' : `${formatNumber(inc)} cases per 100k (12 months)`, freshness: `Latest data: ${monthLabel(cs?.last_month ?? k.dengue_last)}${cs?.months_reported != null && cs.months_reported < 12 ? ` · ${cs.months_reported} of 12 months reported` : ''}` };
      out.set(k.iso3, v);
    }
    return out;
  }, [data, metric]);

  const stats = useMemo(() => {
    const withData = data.countries.filter(k => k.dengue_last || data.cases.some(c => c.iso3 === k.iso3)).length;
    const fc = data.forecasts.filter(f => f.outbreak_prob != null || f.risk_level);
    const high = fc.filter(f => { const l = riskLabel(f.risk_level) !== 'No data' ? riskLabel(f.risk_level) : bandFromProb(f.outbreak_prob); return l === 'High' || l === 'Very high'; }).length;
    const months = [...data.countries.map(k => k.dengue_last), ...data.cases.map(c => c.last_month)].filter((x): x is string => !!x).sort();
    return { withData, withForecast: new Set(fc.map(f => f.iso3)).size, high, latest: months[months.length - 1] ?? null };
  }, [data]);

  const timeLayers = [...BASE_LAYERS.filter(b => b.key === base), ...OVERLAYS.filter(o => overlays[o.key]?.on)].filter(l => l.time === 'daily');
  const maxDate = today ? timeLayers.map(l => layerDate(l, today, null)!).sort().pop() ?? addDays(today, -1) : '';
  const minDate = timeLayers.map(l => l.start!).sort()[0] ?? '';
  const select = (iso3: string) => void navigate({ to: '/world', search: prev => ({ ...validateContext(prev as Record<string, unknown>), country: iso3 }) });
  const refreshGrid = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/public/refresh-world-weather', { method: 'POST' });
      const body = await res.json() as { cached?: boolean; updated?: number; next_allowed_at?: string; detail?: string };
      if (!res.ok) toast.error(`Weather grid refresh failed${body.detail ? `: ${body.detail}` : ''}`);
      else if (body.cached) toast(`Weather grid is recent; next refresh ${body.next_allowed_at ? formatDistanceToNow(new Date(body.next_allowed_at), { addSuffix: true }) : 'later'}`);
      else toast(`Weather grid refreshed: ${body.updated ?? 0} cells`);
    } catch { toast.error('Weather grid refresh could not be reached'); }
    await client.invalidateQueries({ queryKey: ['world'] }); setRefreshing(false);
  };
  const gridOk = !!data.grid?.length;
  const tiles: [string, React.ReactNode, string][] = [
    ['Countries with data', formatNumber(stats.withData), `of ${formatNumber(data.countries.length)} countries loaded`],
    ['Countries with a forecast', formatNumber(stats.withForecast), 'next-month dengue forecast'],
    ['High or above next month', formatNumber(stats.withForecast ? stats.high : null), 'outbreak probability ≥ 40%'],
    ['Latest data month', monthLabel(stats.latest), 'across all countries'],
    ['Weather grid', <Ago key="g" ts={data.gridSource?.last_success_at} />, gridOk ? `${formatNumber(data.grid!.length)} cells · Open-Meteo` : 'Grid unavailable'],
  ];

  return <>
    <p className="eyebrow">{page.eyebrow}</p>
    <div className="page-heading"><div><h1>{page.title}</h1><p className="page-description">{page.description}</p></div></div>
    <div className="kpi-strip world-kpis">{tiles.map(([k, v, s]) => <div className="command-metric" key={k}><span className="metric-label">{k}</span><strong>{v}</strong><small className="metric-foot">{s}</small></div>)}</div>
    {!data.countries.length && <div className="forecast-notice mt-4">No countries are loaded yet. Country forecasts and case history will appear on the map when the pipeline loads the countries table.</div>}
    <div className="world-layout">
      <aside className="world-controls" aria-label="Map layers">
        <fieldset><legend className="control-label">PROJECTION</legend><div className="view-toggle"><Button size="sm" variant={globe ? 'secondary' : 'ghost'} aria-pressed={globe} onClick={() => setGlobe(true)}>Globe</Button><Button size="sm" variant={!globe ? 'secondary' : 'ghost'} aria-pressed={!globe} onClick={() => setGlobe(false)}>Flat</Button></div></fieldset>
        <fieldset><legend className="control-label">COUNTRIES</legend>
          <select className="world-select" aria-label="Country metric" value={metric} onChange={e => setMetric(e.target.value as typeof metric)}>
            <option value="prob">Dengue outbreak probability, next month</option><option value="cases">Dengue cases, latest 12 months, per 100k</option><option value="none">Outlines only</option></select>
          {metric === 'prob' && <ul className="world-legend">{RISK_SCALE.slice(0, 4).map((r, i) => <li key={r.label}><span className={`risk-swatch risk-${i}`} />{r.label}</li>)}<li><span className="hatch-swatch" />No data</li></ul>}
          {metric === 'cases' && <ul className="world-legend">{[0, 1, 2, 3, 4].map(i => <li key={i}><span className="risk-swatch" style={{ background: `var(--rain-${i})` }} />{i === 0 ? `< ${INCIDENCE_BINS[0]}` : i === 4 ? `≥ ${formatNumber(INCIDENCE_BINS[3])}` : `${formatNumber(INCIDENCE_BINS[i - 1])}–${formatNumber(INCIDENCE_BINS[i])}`}</li>)}<li><span className="hatch-swatch" />No data</li></ul>}
          {!boundariesOk && <p className="layer-unavailable">Country boundaries unavailable (world-atlas could not be loaded).</p>}
        </fieldset>
        <fieldset><legend className="control-label">BASE MAP</legend>
          {[{ key: 'dark', title: 'Dark', source: 'CARTO / OpenStreetMap' }, ...BASE_LAYERS].map(b => <label key={b.key} className="layer-row"><input type="radio" name="base" checked={base === b.key} onChange={() => setBase(b.key)} /><span>{b.title}<small>{b.source}{'time' in b && today ? ` · ${layerDate(b, today, picked)}` : ''}</small>{status[b.key] === false && <em className="layer-unavailable">Unavailable</em>}</span></label>)}
        </fieldset>
        <fieldset><legend className="control-label">DATE (TIME-ENABLED LAYERS)</legend>
          <input type="date" className="world-select" aria-label="Layer date" value={dateInput} min={minDate} max={maxDate} onChange={e => setDateInput(e.target.value)} disabled={!timeLayers.length} />
          <small className="metric-foot">{timeLayers.length ? (dateInput ? 'Each layer clamps to its own range.' : 'Each layer shows its latest available date.') : 'Turn on a daily layer to pick a date.'}</small>
          {dateInput && <Button variant="ghost" size="sm" onClick={() => setDateInput('')}>Use latest</Button>}
        </fieldset>
        <fieldset><legend className="control-label">ENVIRONMENT</legend>
          {OVERLAYS.map(o => { const s = overlays[o.key]!; return <div key={o.key} className="layer-block">
            <label className="layer-row"><input type="checkbox" checked={s.on} onChange={e => { setOverlays(p => ({ ...p, [o.key]: { ...s, on: e.target.checked } })); setStatus(p => ({ ...p, [o.key]: undefined })); }} /><span>{o.title}</span></label>
            {s.on && <div className="layer-detail">
              <label className="opacity-row"><span>Opacity</span><input type="range" min={0.1} max={1} step={0.05} value={s.opacity} aria-label={`${o.title} opacity`} onChange={e => setOverlays(p => ({ ...p, [o.key]: { ...s, opacity: Number(e.target.value) } }))} /></label>
              {o.legend && <img src={o.legend} alt={`${o.title} legend (${o.units})`} className="layer-legend" loading="lazy" />}
              <small>{o.units} · {o.source}{o.time === 'daily' && today ? ` · ${layerDate(o, today, picked)}` : ''}</small>
              {status[o.key] === false && <em className="layer-unavailable">Unavailable for this date or area</em>}
            </div>}
          </div>; })}
        </fieldset>
        <fieldset><legend className="control-label">LIVE WEATHER GRID</legend>
          <label className="layer-row"><input type="checkbox" checked={wind} disabled={!gridOk} onChange={e => setWind(e.target.checked)} /><span>Wind (live)</span></label>
          <label className="layer-row"><input type="checkbox" checked={cloud} disabled={!gridOk} onChange={e => setCloud(e.target.checked)} /><span>Cloud cover (live)</span></label>
          {wind && <ul className="world-legend">{['var(--rain-1)', 'var(--primary)', 'var(--risk-moderate)', 'var(--risk-high)'].map((c, i) => <li key={c}><span className="risk-swatch" style={{ background: c }} />{i === 0 ? `< ${WIND_BINS[0]}` : i === 3 ? `≥ ${WIND_BINS[2]}` : `${WIND_BINS[i - 1]}–${WIND_BINS[i]}`} km/h</li>)}</ul>}
          <small className="metric-foot">{gridOk ? <>Open-Meteo current conditions, 10° grid · updated <Ago ts={data.gridSource?.last_success_at} /></> : 'Weather grid unavailable: no cells have been stored yet.'}</small>
          <Button variant="outline" size="sm" onClick={refreshGrid} disabled={refreshing}><RefreshCw className={refreshing ? 'animate-spin' : ''} />Refresh grid</Button>
        </fieldset>
      </aside>
      <section className="world-map-panel">
        {today ? <Suspense fallback={<Skeleton className="map-loading" />}>
          <WorldMap globe={globe} base={base} overlays={overlays} today={today} picked={picked} metric={metric} values={values} grid={data.grid as GridCell[] | null} wind={wind} cloud={cloud} selected={context.country} onSelect={select}
            onLayerStatus={(k, ok) => setStatus(p => (p[k] === true || p[k] === ok ? p : { ...p, [k]: ok }))} onBoundaries={setBoundariesOk} />
        </Suspense> : <Skeleton className="map-loading" />}
      </section>
    </div>
    <footer className="page-footer"><span><ShieldCheck className="size-3" />DECISION SUPPORT · NOT A CLINICAL DIAGNOSIS</span><span>Satellite: NASA GIBS · Water: EC JRC/Google · Weather: Open-Meteo · Boundaries: Natural Earth (world-atlas)</span></footer>
    <CountryDrawer grid={data.grid as GridCell[] | null} today={today} />
  </>;
}

function CountryDrawer({ grid, today }: { grid: GridCell[] | null; today: string | null }) {
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate();
  const iso3 = context.country;
  const q = useQuery({ ...countryDetailQuery(iso3 ?? 'XXX', context.disease), enabled: !!iso3 });
  const model = useQuery({ ...worldModelQuery(context.disease), enabled: !!iso3 });
  const close = () => void navigate({ to: '/world', search: prev => { const { country: _c, ...rest } = validateContext(prev as Record<string, unknown>); return rest; } });
  const k = q.data?.country;
  const series = (q.data?.series ?? []).filter(s => !today || s.month >= `${Number(today.slice(0, 4)) - 6}${today.slice(4, 7)}`);
  const card = model.data?.card as Record<string, unknown> | null | undefined;
  const cardCut = typeof card?.['alert_cutoff'] === 'number' ? card['alert_cutoff'] as number : null;
  const cutoff = cardCut ?? 0.4;
  const bt = backtestCounts(q.data?.backtests ?? [], cutoff);
  const near = grid && k?.lat != null && k?.lon != null ? nearestCells(grid, k.lat, k.lon, 4) : [];
  return <Sheet open={!!iso3} onOpenChange={o => { if (!o) close(); }}>
    <SheetContent side="right" className="region-drawer">
      {q.isPending ? <><SheetTitle className="sr-only">Loading country</SheetTitle><SheetDescription className="sr-only">Loading</SheetDescription><Skeleton className="h-8 w-2/3" /><Skeleton className="mt-4 h-64" /></>
        : q.isError || !k ? <><SheetTitle>Country unavailable</SheetTitle><SheetDescription>{q.isError ? 'This country could not be retrieved. Please try again.' : 'No country matches this link.'}</SheetDescription></>
        : <>
          <header className="drawer-header"><span className="control-label">{context.disease.toUpperCase()} · NATIONAL</span><SheetTitle className="drawer-title">{k.name ?? k.iso3}</SheetTitle>
            <SheetDescription>{[k.subregion, k.region].filter(Boolean).join(', ') || '—'} · Population {formatNumber(k.population)}</SheetDescription></header>
          <div className="flex flex-wrap gap-2">
            {k.iso3 === 'BRA' && <Button asChild size="sm"><Link to="/brazil" search={{ disease: context.disease, horizon: context.horizon }}>Open municipal view</Link></Button>}
            {k.iso3 === 'IND' && <Button asChild size="sm"><Link to="/india" search={{ disease: context.disease, horizon: context.horizon }}>Open India view</Link></Button>}
          </div>
          <section className="drawer-section"><h3><Globe2 />Data coverage</h3>
            <dl className="def-list"><div><dt>Resolution</dt><dd>{k.dengue_resolution ?? '—'}</dd></div><div><dt>First month</dt><dd>{monthLabel(k.dengue_first)}</dd></div><div><dt>Last month</dt><dd>{monthLabel(k.dengue_last)}</dd></div></dl>
            {today && dataStopsEarly(k.dengue_last, today) && <p className="forecast-notice mt-3">Latest data: {monthLabel(k.dengue_last)}. Reported cases stop before the present.</p>}
            {!k.dengue_last && <p className="drawer-empty">No dengue case history is loaded for this country.</p>}
          </section>
          <section className="drawer-section"><h3><LineIcon />Monthly cases, last 6 years</h3>
            {series.length ? <div className="h-64"><ResponsiveContainer><ComposedChart data={series} margin={{ left: -8, right: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="month" {...axis} tickFormatter={m => String(m).slice(0, 4)} minTickGap={30} /><YAxis {...axis} tickFormatter={v => formatNumber(v)} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }} labelFormatter={m => monthLabel(String(m))} formatter={(v, n) => [typeof v === 'number' ? formatNumber(v) : '—', n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar name="Cases (outbreak months highlighted)" dataKey="cases" isAnimationActive={false}>{series.map(s => <Cell key={s.month} fill={s.outbreak ? 'var(--risk-high)' : 'var(--muted-foreground)'} />)}</Bar>
              <Line name="Seasonal normal" dataKey="mu" stroke="var(--primary)" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line name="Outbreak threshold" dataKey="threshold" stroke="var(--risk-moderate)" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </ComposedChart></ResponsiveContainer></div> : <p className="drawer-empty">Monthly case history will appear here when country_series is loaded for this country.</p>}
          </section>
          <section className="drawer-section"><h3><ShieldCheck />Forecast, next 3 months</h3>
            {q.data.forecasts.length ? <div className="flex flex-col gap-4">{q.data.forecasts.map(f => { const lvl = riskLabel(f.risk_level) !== 'No data' ? riskLabel(f.risk_level) : bandFromProb(f.outbreak_prob); const drv = parseDrivers(f.drivers); return <div key={f.horizon_months} className="country-forecast">
              <div className="country-forecast-head"><strong>{monthLabel(f.target_month)}</strong><span className="text-xs text-muted-foreground">{f.horizon_months} month{f.horizon_months === 1 ? '' : 's'} ahead · issued {monthLabel(f.issue_month)}</span></div>
              <div className="country-forecast-values"><span className="tabular-nums text-lg font-semibold">{formatProbability(f.outbreak_prob)}</span><span className="risk-item"><span className={`risk-swatch risk-${RISK_INDEX[lvl] ?? 4}`} />{lvl}</span><span className="text-sm">P10–P90: {formatNumber(f.cases_p10)}–{formatNumber(f.cases_p90)} cases</span></div>
              {drv.length > 0 && <ul className="text-sm mt-2">{drv.slice(0, 3).map((d, i) => <li key={i}>{d.label ?? '—'} <span className="text-muted-foreground">({d.family ?? '—'}, {num(d.contribution, 3)})</span></li>)}</ul>}
              {f.narrative && <p className="drawer-narrative mt-2">{f.narrative}</p>}
            </div>; })}<p className="sub">Drivers are associations, not proof of cause.</p></div> : <p className="drawer-empty">No forecast is loaded for this country yet.</p>}
          </section>
          <section className="drawer-section"><h3><LineIcon />How well did this work here?</h3>
            {bt.scored ? <><dl className="def-list"><div><dt>Hits</dt><dd>{formatNumber(bt.hits)}</dd></div><div><dt>Misses</dt><dd>{formatNumber(bt.misses)}</dd></div><div><dt>False alarms</dt><dd>{formatNumber(bt.falseAlarms)}</dd></div><div><dt>Correctly quiet</dt><dd>{formatNumber(bt.correctQuiet)}</dd></div></dl>
              <p className="sub mt-2">{formatNumber(bt.scored)} backtested months, 1 month ahead · alert when probability ≥ {Math.round(cutoff * 100)}% {cardCut == null ? '(High band; no model cut-off published)' : '(model cut-off)'}</p></>
              : <p className="drawer-empty">Backtest results will appear when country_backtests is loaded for this country.</p>}
          </section>
          <section className="drawer-section"><h3><CloudSun />Live environment</h3>
            {near.length ? <div className="municipality-table-wrap"><table className="municipality-table"><thead><tr><th>Grid cell</th><th>Temp</th><th>Humidity</th><th>Precip</th><th>Cloud</th><th><Wind className="inline size-3" /> Wind</th></tr></thead>
              <tbody>{near.map(c => <tr key={`${c.lat},${c.lon}`}><td className="font-mono text-xs">{c.lat}°, {c.lon}°</td><td>{num(c.temp_c)} °C</td><td>{num(c.rh, 0)}%</td><td>{num(c.precip_mm)} mm</td><td>{num(c.cloud_cover, 0)}%</td><td>{num(c.wind_speed, 0)} km/h</td></tr>)}</tbody></table>
              <p className="sub mt-2">Nearest 10° grid cells to the country centre · Open-Meteo · updated <Ago ts={near[0]?.updated_at} /></p></div>
              : <p className="drawer-empty">{grid?.length ? 'This country has no centre coordinates to match grid cells.' : 'The live weather grid is unavailable.'}</p>}
          </section>
        </>}
    </SheetContent>
  </Sheet>;
}
