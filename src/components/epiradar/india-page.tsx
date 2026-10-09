import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudSun, History, LineChart as LineIcon, MapPinned, RefreshCw, ShieldCheck, Sigma, Thermometer } from 'lucide-react';
import { toast } from 'sonner';
import type { Topology } from 'topojson-specification';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { validateContext } from '@/lib/epiradar';
import { indiaOverviewQuery, indiaTopoQuery, karnatakaHistoryQuery } from '@/lib/india-query';
import { aggregateIndia, binOf, cfr, chunk, defaultYear, FAVOURABLE, FOCUS, INDIA_BOUNDS, INDIA_DAILY_VARS, INDIA_DISEASES, indiaToday, isStale, KARNATAKA, MAHARASHTRA, OPEN_METEO_BATCH, PUNE, quantileBreaks, VECTOR_FOR, yearsInfo, type IndiaDaily, type IndiaDisease } from '@/lib/india';
import { BASE_LAYERS, OVERLAYS, addDays, layerDate } from '@/lib/world';
import { DISEASE_KEY, formatIN, stateName, useT, type Key, type Lang } from '@/lib/i18n';
import { DataBadge } from './i18n-ui';
import { suitClass, type DistrictPoint, type Focus, type StateValue } from './india-map';

const IndiaMap = lazy(() => import('./india-map'));
const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
const tip = { contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 } };
const n1 = (v: number | null | undefined, d = 1) => v == null ? '—' : v.toFixed(d);
type Overview = Awaited<ReturnType<typeof indiaOverviewQuery.queryFn & object>>;
type WeatherRow = Overview['weather'][number];
type BurdenRow = Overview['burden'][number];
type District = Overview['districts'][number];
const SOURCES = [
  { id: 'ncvbdc', label: 'NCVBDC state-wise dengue, chikungunya and malaria', url: 'https://ncvbdc.mohfw.gov.in/' },
  { id: 'datameet_boundaries', label: 'DataMeet state boundaries (CC BY 2.5 India)', url: 'https://github.com/datameet/maps' },
  { id: 'open_meteo_india', label: 'Open-Meteo live district weather', url: 'https://open-meteo.com/' },
  { id: 'icts_karnataka', label: 'ICTS Karnataka district dengue', url: 'https://extranet.icts.res.in/Dengue/' },
];

export function When({ ts, lang }: { ts: string | null | undefined; lang: Lang }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  if (!ts) return <>—</>;
  const d = new Date(ts.length <= 10 ? `${ts}T00:00:00+05:30` : ts);
  if (!Number.isFinite(d.getTime())) return <>—</>;
  return <time dateTime={ts}>{ok ? new Intl.DateTimeFormat(`${lang}-IN`, ts.length <= 10 ? { dateStyle: 'medium', timeZone: 'Asia/Kolkata' } : { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(d) : ts.slice(0, 16).replace('T', ' ')}</time>;
}

function bbox(geom: Geometry | null | undefined): [[number, number], [number, number]] | null {
  if (!geom) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const walk = (c: unknown): void => { if (Array.isArray(c) && typeof c[0] === 'number') { const p = c as Position; x0 = Math.min(x0, p[0]!); x1 = Math.max(x1, p[0]!); y0 = Math.min(y0, p[1]!); y1 = Math.max(y1, p[1]!); } else if (Array.isArray(c)) c.forEach(walk); };
  if ('coordinates' in geom) walk(geom.coordinates);
  return Number.isFinite(x0) ? [[x0, y0], [x1, y1]] : null;
}
export function stateFeatures(topo: Topology | null | undefined) {
  const obj = topo?.objects['states']; if (!topo || !obj) return [];
  const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry> | Feature<Geometry>;
  return fc.type === 'FeatureCollection' ? fc.features : [fc];
}

export function weatherSentence(t: ReturnType<typeof useT>, place: string, aedes: number | null, anoph: number | null) {
  if (aedes == null || anoph == null) return null;
  const a = aedes >= FAVOURABLE, b = anoph >= FAVOURABLE;
  return t(a && b ? 'sentence.both' : a ? 'sentence.aedes' : b ? 'sentence.anopheles' : 'sentence.neither', { place });
}

export function IndiaPage() {
  const t = useT();
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data } = useSuspenseQuery(indiaOverviewQuery);
  const topoQ = useQuery(indiaTopoQuery);
  const disease: IndiaDisease = context.india ?? 'dengue';
  const vector = VECTOR_FOR[disease];
  const [today, setToday] = useState<string | null>(null);
  const [globe, setGlobe] = useState(false);
  const [base, setBase] = useState('dark');
  const [choropleth, setChoropleth] = useState(true);
  const [overlays, setOverlays] = useState<Record<string, { on: boolean; opacity: number }>>(() => Object.fromEntries(OVERLAYS.map(o => [o.key, { on: false, opacity: 0.75 }])));
  const [dots, setDots] = useState(true);
  const [wind, setWind] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean | undefined>>({});
  const [focus, setFocus] = useState<Focus>({ nonce: 0 });
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { setToday(indiaToday()); }, []);
  useEffect(() => { const h = setTimeout(() => setPicked(dateInput || null), 400); return () => clearTimeout(h); }, [dateInput]);

  const stateIds = useMemo(() => new Set(data.states.map(s => s.id)), [data.states]);
  const stateById = useMemo(() => new Map(data.states.map(s => [s.id, s])), [data.states]);
  const rows = useMemo(() => data.burden.filter(r => r.disease_id === disease && stateIds.has(r.admin1)), [data.burden, disease, stateIds]);
  const currentYear = Number((today ?? indiaToday()).slice(0, 4));
  const info = useMemo(() => yearsInfo(rows, currentYear), [rows, currentYear]);
  const dYear = useMemo(() => defaultYear(rows, currentYear), [rows, currentYear]);
  const year = context.year != null && info.years.includes(context.year) ? context.year : dYear;
  const yearRows = rows.filter(r => r.year === year);
  const yearNotes = [...new Set(yearRows.map(r => r.note).filter((x): x is string => !!x))];
  const breaks = useMemo(() => quantileBreaks(yearRows.map(r => r.incidence)), [yearRows]);
  const weatherBy = useMemo(() => new Map(data.weather.map(w => [w.district_id, w])), [data.weather]);
  const setSearch = (patch: Record<string, unknown>) => void navigate({ to: '/india', search: prev => ({ ...validateContext(prev as Record<string, unknown>), ...patch }) as never });

  const stateValues = useMemo(() => {
    const m = new Map<string, StateValue>();
    for (const s of data.states) {
      const r = yearRows.find(x => x.admin1 === s.id);
      m.set(s.id, { id: s.id, title: stateName(s, t.lang), bin: binOf(r?.incidence, breaks), lines: r ? [
        `${t('term.cases')}: ${formatIN(r.cases)}`, `${t('term.deaths')}: ${formatIN(r.deaths)}`, `${t('term.incidence')}: ${n1(r.incidence, 2)} ${t('unit.per100k')}`, ...(r.note ? [r.note] : []),
      ] : [t('legend.noData')] });
    }
    return m;
  }, [data.states, yearRows, breaks, t.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const points: DistrictPoint[] = useMemo(() => data.districts.flatMap(d => {
    if (d.lat == null || d.lon == null) return [];
    const w = weatherBy.get(d.id); const suit = w ? (vector === 'aedes' ? w.aedes_suitability : w.anopheles_suitability) : null;
    return [{ id: d.id, name: d.name, lat: d.lat, lon: d.lon, population: d.population, suit, windSpeed: w?.wind_speed_max ?? null, windDir: w?.wind_dir_deg ?? null, cloud: w?.cloud_cover ?? null,
      lines: [`${t('term.suitability')}: ${n1(suit, 2)}`, `${t('term.temperature')}: ${n1(w?.temp_mean_7d)} °C · ${t('term.humidity')}: ${n1(w?.humidity_7d, 0)}%`, `${t('drawer.rain14')}: ${n1(w?.rain_14d_mm)} mm`, `${t('term.population')}: ${formatIN(d.population)}`] }];
  }), [data.districts, weatherBy, vector, t.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    const withCases = yearRows.filter(r => r.cases != null);
    const cases = withCases.length ? withCases.reduce((a, r) => a + r.cases!, 0) : null;
    const withDeaths = yearRows.filter(r => r.deaths != null);
    const deaths = withDeaths.length ? withDeaths.reduce((a, r) => a + r.deaths!, 0) : null;
    const deathsForCfr = withCases.filter(r => r.deaths != null);
    const rate = cfr(deathsForCfr.reduce((a, r) => a + r.cases!, 0), deathsForCfr.length ? deathsForCfr.reduce((a, r) => a + r.deaths!, 0) : null);
    const withW = data.districts.filter(d => { const w = weatherBy.get(d.id); return w && (vector === 'aedes' ? w.aedes_suitability : w.anopheles_suitability) != null; });
    const fav = withW.filter(d => { const w = weatherBy.get(d.id)!; return (vector === 'aedes' ? w.aedes_suitability! : w.anopheles_suitability!) >= FAVOURABLE; });
    const people = fav.reduce((a, d) => a + (d.population ?? 0), 0);
    return { cases, deaths, rate, reporting: withCases.length, withW: withW.length, fav: fav.length, people: fav.length ? people : null, missingPop: fav.some(d => d.population == null) };
  }, [yearRows, data.districts, weatherBy, vector]);

  const features = useMemo(() => stateFeatures(topoQ.data?.topo), [topoQ.data]);
  const doFocus = (key: string) => {
    const f = FOCUS.find(x => x.key === key)!;
    if (f.kind === 'bounds') return setFocus(p => ({ nonce: p.nonce + 1, bounds: INDIA_BOUNDS }));
    if (f.kind === 'state') { const g = features.find(x => String(x.properties?.['id']) === key); const b = bbox(g?.geometry); const s = stateById.get(key);
      return setFocus(p => b ? { nonce: p.nonce + 1, bounds: b } : s?.lat != null && s.lon != null ? { nonce: p.nonce + 1, center: [s.lon, s.lat], zoom: 6 } : p); }
    if (f.kind === 'district') { const d = data.districts.find(x => x.id === key); return setFocus(p => d?.lat != null && d.lon != null ? { nonce: p.nonce + 1, center: [d.lon, d.lat], zoom: f.zoom } : p); }
    const ds = data.districts.filter(d => d.state_id === key && d.lat != null && d.lon != null);
    if (ds.length) { const lons = ds.map(d => d.lon!), lats = ds.map(d => d.lat!); setFocus(p => ({ nonce: p.nonce + 1, bounds: [[Math.min(...lons) - 0.08, Math.min(...lats) - 0.08], [Math.max(...lons) + 0.08, Math.max(...lats) + 0.08]] })); }
  };
  const focusAvailable = (key: string) => { const f = FOCUS.find(x => x.key === key)!; return f.kind === 'bounds' || (f.kind === 'state' ? stateById.has(key) || features.some(x => x.properties?.['id'] === key) : f.kind === 'district' ? data.districts.some(d => d.id === key && d.lat != null) : data.districts.some(d => d.state_id === key)); };

  const timeLayers = [...BASE_LAYERS.filter(b => b.key === base), ...OVERLAYS.filter(o => overlays[o.key]?.on)].filter(l => l.time === 'daily');
  const maxDate = today ? timeLayers.map(l => layerDate(l, today, null)!).sort().pop() ?? addDays(today, -1) : '';
  const minDate = timeLayers.map(l => l.start!).sort()[0] ?? '';
  const src = new Map(data.sources.map(s => [s.id, s]));
  const wSrc = src.get('open_meteo_india');
  const latestWeather = data.weather.reduce<string | null>((m, w) => w.updated_at && (!m || w.updated_at > m) ? w.updated_at : m, null);
  const refreshWeather = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/public/refresh-india-weather', { method: 'POST' });
      const body = await res.json() as { cached?: boolean; updated?: number; detail?: string };
      if (!res.ok) toast.error(`${t('weather.refresh')}: ${body.detail ?? res.status}`);
      else toast(body.cached ? `${t('weather.stored')} · ${body.updated ?? 0}` : `${t('weather.refresh')} · ${body.updated ?? 0}`);
    } catch { toast.error(t('common.error')); }
    await client.invalidateQueries({ queryKey: ['india'] }); setRefreshing(false);
  };
  const tiles: [string, React.ReactNode, React.ReactNode, 'reported' | 'suitability'][] = [
    [t('kpi.cases'), formatIN(kpi.cases), year ?? '—', 'reported'],
    [t('kpi.deaths'), formatIN(kpi.deaths), year ?? '—', 'reported'],
    [t('kpi.cfr'), kpi.rate == null ? '—' : `${kpi.rate.toFixed(2)}%`, t('term.deaths'), 'reported'],
    [t('kpi.states'), formatIN(rows.length ? kpi.reporting : null), t('kpi.ofStates', { n: formatIN(data.states.length) }), 'reported'],
    [t('kpi.favourable', { vector: t(`vector.${vector}`) }), formatIN(kpi.withW ? kpi.fav : null), t('kpi.ofDistricts', { n: formatIN(kpi.withW) }), 'suitability'],
    [t('kpi.people'), kpi.people == null ? '—' : `≥ ${formatIN(kpi.people)}`, t('kpi.atLeast'), 'suitability'],
  ];

  return <>
    <p className="eyebrow">{t('india.eyebrow')}</p>
    <div className="page-heading"><div><h1>{t('india.title')}</h1><p className="page-description">{t('india.description')}</p></div></div>
    <div className="india-toolbar">
      <div className="disease-tabs" role="tablist" aria-label={t('topbar.disease')}>{INDIA_DISEASES.map(d => <button key={d} role="tab" aria-selected={disease === d} onClick={() => setSearch({ india: d, year: undefined, state: context.state })}>{t(DISEASE_KEY[d]!)}</button>)}</div>
      {info.years.length ? <label className="year-slider"><span className="control-label">{t('india.yearLabel')}</span>
        <input type="range" min={info.years[0]} max={info.years[info.years.length - 1]} step={1} value={year ?? info.years[0]} aria-label={t('india.yearLabel')} onChange={e => { const y = Number(e.target.value); const near = info.years.reduce((a, b) => Math.abs(b - y) < Math.abs(a - y) ? b : a); setSearch({ year: near }); }} />
        <output>{year}</output>{year != null && info.partial.has(year) && <span className="partial-tag">{t('common.partial')}</span>}
        <small className="metric-foot">{t('india.yearRange', { a: info.years[0]!, b: info.years[info.years.length - 1]! })}</small></label>
        : <span className="metric-foot">{t('empty.burden')}</span>}
    </div>
    {yearNotes.length > 0 && <p className="forecast-notice mb-3">{year}: {yearNotes.join(' · ')}</p>}
    {!data.states.length && <div className="forecast-notice mb-3">{t('empty.states')}</div>}
    <div className="kpi-strip india-kpis">{tiles.map(([k, v, s, b]) => <div className="command-metric" key={k}><span className="metric-label panel-title-row"><span>{k}</span><DataBadge kind={b} /></span><strong>{v}</strong><small className="metric-foot">{s}</small></div>)}</div>
    <div className="world-layout">
      <aside className="world-controls" aria-label={t('map.layers')}>
        <fieldset><legend className="control-label">{t('map.focus')}</legend><div className="focus-row">{FOCUS.map(f => <Button key={f.key} size="sm" variant="outline" disabled={!focusAvailable(f.key)} onClick={() => doFocus(f.key)}>{t(`focus.${f.key}` as Key)}</Button>)}</div></fieldset>
        <fieldset><legend className="control-label">{t('map.projection')}</legend><div className="view-toggle"><Button size="sm" variant={!globe ? 'secondary' : 'ghost'} aria-pressed={!globe} onClick={() => setGlobe(false)}>{t('map.flat')}</Button><Button size="sm" variant={globe ? 'secondary' : 'ghost'} aria-pressed={globe} onClick={() => setGlobe(true)}>{t('map.globe')}</Button></div></fieldset>
        <fieldset><legend className="control-label">{t('map.states')} <DataBadge kind="reported" /></legend>
          <label className="layer-row"><input type="checkbox" checked={choropleth} onChange={e => setChoropleth(e.target.checked)} /><span>{t('map.stateChoropleth', { year: year ?? '—' })}</span></label>
          {choropleth && <><small className="metric-foot">{t('legend.incidence')}</small><ul className="world-legend">{breaks.length ? [...breaks, null].map((b, i) => <li key={i}><span className="risk-swatch" style={{ background: `var(--rain-${i})` }} />{i === 0 ? `< ${n1(b, 1)}` : b == null ? `≥ ${n1(breaks[i - 1], 1)}` : `${n1(breaks[i - 1], 1)}–${n1(b, 1)}`}</li>) : null}<li><span className="hatch-swatch" />{t('legend.noData')}</li></ul></>}
          {topoQ.isError ? <p className="layer-unavailable">{t('map.boundariesFailed')}</p> : topoQ.isSuccess && !topoQ.data && <p className="layer-unavailable">{t('map.noBoundaries')}</p>}
        </fieldset>
        <fieldset><legend className="control-label">{t('map.districts')} <DataBadge kind="suitability" /></legend>
          <label className="layer-row"><input type="checkbox" checked={dots} onChange={e => setDots(e.target.checked)} /><span>{t('map.dots')}<small>{t(`vector.${vector}`)}</small></span></label>
          {dots && <ul className="world-legend">{['0–0.25', '0.25–0.5', '0.5–0.75', '≥ 0.75'].map((l, i) => <li key={l}><span className={`risk-swatch suit-${i}`} />{l}</li>)}<li><span className="risk-swatch risk-4" />{t('legend.noData')}</li></ul>}
          <label className="layer-row"><input type="checkbox" checked={wind} disabled={!data.weather.length} onChange={e => setWind(e.target.checked)} /><span>{t('map.wind')}</span></label>
          <label className="layer-row"><input type="checkbox" checked={cloud} disabled={!data.weather.length} onChange={e => setCloud(e.target.checked)} /><span>{t('map.cloud')}</span></label>
          <SuitabilityFormula />
          <small className="metric-foot">{data.weather.length ? <>Open-Meteo · {t('common.asOf', { d: '' })}<When ts={latestWeather} lang={t.lang} />{isStale(latestWeather) ? ` · ${t('weather.stale').split(';')[0]}` : ''}</> : t('empty.weather')}</small>
          {wSrc?.status === 'degraded' && <small className="layer-unavailable">{wSrc.note}</small>}
          <Button variant="outline" size="sm" onClick={refreshWeather} disabled={refreshing}><RefreshCw className={refreshing ? 'animate-spin' : ''} />{t('weather.refresh')}</Button>
        </fieldset>
        <fieldset><legend className="control-label">{t('map.base')}</legend>
          {[{ key: 'dark', source: 'CARTO / OpenStreetMap' }, ...BASE_LAYERS].map(b => <label key={b.key} className="layer-row"><input type="radio" name="india-base" checked={base === b.key} onChange={() => setBase(b.key)} /><span>{b.key === 'dark' ? t('map.dark') : t(`layer.${b.key}` as Key)}<small>{b.source}{'time' in b && today ? ` · ${layerDate(b, today, picked)}` : ''}</small>{status[b.key] === false && <em className="layer-unavailable">{t('map.unavailable')}</em>}</span></label>)}
        </fieldset>
        <fieldset><legend className="control-label">{t('map.date')}</legend>
          <input type="date" className="world-select" aria-label={t('map.date')} value={dateInput} min={minDate} max={maxDate} onChange={e => setDateInput(e.target.value)} disabled={!timeLayers.length} />
          {dateInput && <Button variant="ghost" size="sm" onClick={() => setDateInput('')}>{t('map.useLatest')}</Button>}
        </fieldset>
        <fieldset><legend className="control-label">{t('map.environment')}</legend>
          {OVERLAYS.map(o => { const s = overlays[o.key]!; return <div key={o.key} className="layer-block">
            <label className="layer-row"><input type="checkbox" checked={s.on} onChange={e => { setOverlays(p => ({ ...p, [o.key]: { ...s, on: e.target.checked } })); setStatus(p => ({ ...p, [o.key]: undefined })); }} /><span>{t(`layer.${o.key}` as Key)}</span></label>
            {s.on && <div className="layer-detail">
              <label className="opacity-row"><span>{t('map.opacity')}</span><input type="range" min={0.1} max={1} step={0.05} value={s.opacity} aria-label={`${t(`layer.${o.key}` as Key)} ${t('map.opacity')}`} onChange={e => setOverlays(p => ({ ...p, [o.key]: { ...s, opacity: Number(e.target.value) } }))} /></label>
              {o.legend && <img src={o.legend} alt={`${o.title} (${o.units})`} className="layer-legend" loading="lazy" />}
              <small>{o.units} · {o.source}{o.time === 'daily' && today ? ` · ${layerDate(o, today, picked)}` : ''}</small>
              {status[o.key] === false && <em className="layer-unavailable">{t('map.unavailableArea')}</em>}
            </div>}
          </div>; })}
        </fieldset>
      </aside>
      <section className="world-map-panel">
        {today ? <Suspense fallback={<Skeleton className="map-loading" />}>
          <IndiaMap topo={topoQ.data?.topo ?? null} globe={globe} base={base} overlays={overlays} today={today} picked={picked} states={stateValues} choropleth={choropleth}
            districts={points} dots={dots} wind={wind} cloud={cloud} selected={context.state} focus={focus} noDataLabel={t('map.noDataArea')} failedLabel={t('map.failed')}
            onSelect={id => setSearch({ state: id })} onLayerStatus={(k, ok) => setStatus(p => (p[k] === true || p[k] === ok ? p : { ...p, [k]: ok }))} />
        </Suspense> : <Skeleton className="map-loading" />}
      </section>
    </div>
    <div className="india-cards">
      <Spotlight data={data} />
      <Seasonality series={data.series} />
      <section className="replay-card"><div className="panel-title-row"><h2>{t('fc.title')}</h2><DataBadge kind="forecast" /></div>
        <p className="sub mt-2">{t('fc.body1')}</p><p className="sub mt-2">{t('fc.body2')}</p></section>
    </div>
    <footer className="page-footer"><span><ShieldCheck className="size-3" />{t('footer.decision')}</span><span>NCVBDC · DataMeet (CC BY 2.5 India) · Open-Meteo · NASA GIBS</span></footer>
    <StateDrawer data={data} year={year} disease={disease} />
  </>;
}

function SuitabilityFormula() {
  const t = useT();
  return <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t('trust.india.formulas')}</summary><ul className="mt-1 flex flex-col gap-1">{formulaLines().map(l => <li key={l} className="font-mono">{l}</li>)}</ul></details>;
}
import { SUITABILITY_FORMULAS } from '@/lib/india';
export const formulaLines = () => [...SUITABILITY_FORMULAS];

function Spotlight({ data }: { data: Overview }) {
  const t = useT();
  const mh = data.states.find(s => s.id === MAHARASHTRA);
  const trend = useMemo(() => {
    const years = [...new Set(data.burden.filter(r => r.admin1 === MAHARASHTRA).map(r => r.year))].sort();
    return years.map(y => Object.fromEntries([['year', y], ...INDIA_DISEASES.map(d => [d, data.burden.find(r => r.admin1 === MAHARASHTRA && r.disease_id === d && r.year === y)?.cases ?? null])]));
  }, [data.burden]);
  const pune = data.weather.find(w => w.district_id === PUNE);
  const puneName = data.districts.find(d => d.id === PUNE)?.name ?? 'Pune';
  const top = data.districts.filter(d => d.state_id === MAHARASHTRA).map(d => ({ d, w: data.weather.find(w => w.district_id === d.id) })).filter(x => x.w?.aedes_suitability != null).sort((a, b) => b.w!.aedes_suitability! - a.w!.aedes_suitability!).slice(0, 5);
  const sentence = weatherSentence(t, puneName, pune?.aedes_suitability ?? null, pune?.anopheles_suitability ?? null);
  return <section className="replay-card"><div className="panel-title-row"><h2><MapPinned className="inline size-4 mr-1" />{t('spot.title')}</h2><DataBadge kind="reported" /></div>
    <p className="sub mt-1">{t('spot.trend')} · {stateName(mh, t.lang)}</p>
    {trend.length ? <div className="h-48 mt-2"><ResponsiveContainer><LineChart data={trend} margin={{ left: -4, right: 8 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="year" {...axis} /><YAxis {...axis} tickFormatter={v => formatIN(v)} /><Tooltip {...tip} formatter={(v, n) => [typeof v === 'number' ? formatIN(v) : '—', t(DISEASE_KEY[String(n)] ?? 'term.cases')]} /><Legend wrapperStyle={{ fontSize: 11 }} formatter={v => t(DISEASE_KEY[String(v)] ?? 'term.cases')} />
      <Line dataKey="dengue" stroke="var(--primary)" dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} /><Line dataKey="chikungunya" stroke="var(--risk-moderate)" dot={false} strokeWidth={2} isAnimationActive={false} /><Line dataKey="malaria" stroke="var(--rain-2)" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <p className="drawer-empty">{t('empty.burden')}</p>}
    <div className="panel-title-row mt-4"><h3 className="text-sm font-semibold"><Thermometer className="inline size-4 mr-1" />{t('spot.pune')}</h3><DataBadge kind="suitability" /></div>
    {pune ? <><dl className="mini-stats">
      <div><dt>{t('drawer.temp7')}</dt><dd>{n1(pune.temp_mean_7d)} °C</dd></div><div><dt>{t('term.humidity')}</dt><dd>{n1(pune.humidity_7d, 0)}%</dd></div><div><dt>{t('drawer.rain14')}</dt><dd>{n1(pune.rain_14d_mm)} mm</dd></div>
      <div><dt>{t('drawer.rainNext7')}</dt><dd>{n1(pune.rain_next7d_mm)} mm</dd></div><div><dt>{t('drawer.aedes')}</dt><dd>{n1(pune.aedes_suitability, 2)}</dd></div><div><dt>{t('drawer.anopheles')}</dt><dd>{n1(pune.anopheles_suitability, 2)}</dd></div></dl>
      {sentence && <p className="drawer-narrative mt-2">{sentence}</p>}<p className="sub mt-1">Open-Meteo · {t('common.asOf', { d: pune.as_of ?? '—' })}</p></> : <p className="drawer-empty">{t('spot.noPune')}</p>}
    <h3 className="text-sm font-semibold mt-4">{t('spot.top5')}</h3>
    {top.length ? <ol className="text-sm mt-1 flex flex-col gap-1">{top.map(x => <li key={x.d.id} className="flex justify-between gap-2"><span>{x.d.name}</span><span className={`suit-chip suit-${suitClass(x.w!.aedes_suitability)}`}>{n1(x.w!.aedes_suitability, 2)}</span></li>)}</ol> : <p className="drawer-empty">{t('empty.weather')}</p>}
  </section>;
}

function Seasonality({ series }: { series: Overview['series'] }) {
  const t = useT();
  return <section className="replay-card"><div className="panel-title-row"><h2><Sigma className="inline size-4 mr-1" />{t('season.title')}</h2><DataBadge kind="reported" /></div>
    <p className="sub mt-1">{t('season.caption')}</p>
    {series.length ? <div className="h-56 mt-2"><ResponsiveContainer><ComposedChart data={series} margin={{ left: -4, right: 8 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="month" {...axis} tickFormatter={m => String(m).slice(0, 4)} minTickGap={30} /><YAxis {...axis} tickFormatter={v => formatIN(v)} />
      <Tooltip {...tip} labelFormatter={m => String(m).slice(0, 7)} formatter={v => [typeof v === 'number' ? formatIN(v) : '—', t('term.cases')]} /><Bar dataKey="cases" fill="var(--primary)" isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>
      : <p className="drawer-empty">{t('empty.series')}</p>}
  </section>;
}

type SortKey = 'name' | 'population' | 'temp' | 'rh' | 'rain14' | 'next7' | 'aedes' | 'anopheles';
async function fetchBrowserWeather(districts: District[]) {
  const today = indiaToday();
  const out = new Map<string, ReturnType<typeof aggregateIndia>>();
  const list = districts.filter(d => d.lat != null && d.lon != null);
  for (const [i, batch] of chunk(list, OPEN_METEO_BATCH).entries()) {
    if (i > 0) await new Promise(r => setTimeout(r, 3000));
    const params = new URLSearchParams({ latitude: batch.map(d => d.lat!.toFixed(4)).join(','), longitude: batch.map(d => d.lon!.toFixed(4)).join(','), daily: INDIA_DAILY_VARS, past_days: '14', forecast_days: '7', timezone: 'Asia/Kolkata', wind_speed_unit: 'kmh' });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const body = await res.json() as { daily?: IndiaDaily } | { daily?: IndiaDaily }[];
    const results = Array.isArray(body) ? body : [body];
    batch.forEach((d, j) => out.set(d.id, aggregateIndia(results[j]?.daily ?? {}, today)));
  }
  return out;
}

function StateDrawer({ data, year, disease }: { data: Overview; year: number | null; disease: IndiaDisease }) {
  const t = useT();
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate();
  const id = context.state;
  const state = data.states.find(s => s.id === id);
  const close = () => void navigate({ to: '/india', search: prev => { const { state: _s, ...rest } = validateContext(prev as Record<string, unknown>); return rest as never; } });
  const districts = useMemo(() => data.districts.filter(d => d.state_id === id), [data.districts, id]);
  const stored = new Map(data.weather.map(w => [w.district_id, w]));
  const needLive = !!id && districts.length > 0 && districts.some(d => { const w = stored.get(d.id); return !w || isStale(w.updated_at); });
  const live = useQuery({ queryKey: ['india', 'browser-weather', id], queryFn: () => fetchBrowserWeather(districts), enabled: needLive, staleTime: 30 * 60_000, retry: false });
  const history = useQuery({ ...karnatakaHistoryQuery, enabled: id === KARNATAKA });
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false });
  const [histDistrict, setHistDistrict] = useState('');
  const weatherOf = (d: District): Partial<WeatherRow> | undefined => { const w = stored.get(d.id); if (w && !isStale(w.updated_at)) return w; return live.data?.get(d.id) ?? w; };
  const rowsFor = (dis: IndiaDisease) => data.burden.filter(r => r.admin1 === id && r.disease_id === dis).sort((a, b) => a.year - b.year);
  const rank = (dis: IndiaDisease) => {
    if (year == null) return null;
    const ranked = data.burden.filter(r => r.disease_id === dis && r.year === year && r.incidence != null && data.states.some(s => s.id === r.admin1)).sort((a, b) => b.incidence! - a.incidence!);
    const i = ranked.findIndex(r => r.admin1 === id); return i < 0 ? null : { r: i + 1, n: ranked.length };
  };
  const val = (d: District, k: SortKey): number | string | null => { const w = weatherOf(d); return k === 'name' ? d.name : k === 'population' ? d.population : k === 'temp' ? w?.temp_mean_7d ?? null : k === 'rh' ? w?.humidity_7d ?? null : k === 'rain14' ? w?.rain_14d_mm ?? null : k === 'next7' ? w?.rain_next7d_mm ?? null : k === 'aedes' ? w?.aedes_suitability ?? null : w?.anopheles_suitability ?? null; };
  const sorted = [...districts].sort((a, b) => { const x = val(a, sort.key), y = val(b, sort.key); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number); return sort.desc ? -c : c; });
  const th = (k: SortKey, label: string) => <th className="sortable-th" aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}><button type="button" onClick={() => setSort(s => ({ key: k, desc: s.key === k ? !s.desc : k !== 'name' }))}>{label}{sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}</button></th>;
  const hist = history.data ?? [];
  const histNames = [...new Set(hist.map(h => h.district_name))].sort();
  const histSeries = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hist) if (!histDistrict || h.district_name === histDistrict) m.set(h.week_start, (m.get(h.week_start) ?? 0) + (h.cases ?? 0));
    return [...m.entries()].sort().map(([week, cases]) => ({ week, cases }));
  }, [hist, histDistrict]);
  const src = new Map(data.sources.map(s => [s.id, s]));
  return <Sheet open={!!id} onOpenChange={o => { if (!o) close(); }}>
    <SheetContent side="right" className="region-drawer">
      {!state ? <><SheetTitle>{t('term.state')}</SheetTitle><SheetDescription>{t('drawer.unknownState')}</SheetDescription></> : <>
        <header className="drawer-header"><span className="control-label">{t('term.state').toUpperCase()} · {state.id}</span><SheetTitle className="drawer-title">{stateName(state, t.lang)}</SheetTitle>
          <SheetDescription>{t('term.population')} {formatIN(state.population)}</SheetDescription></header>
        {INDIA_DISEASES.map(dis => { const r = rowsFor(dis); const rk = rank(dis); const latest = [...r].reverse().find(x => x.cases != null); const notes = r.filter(x => x.note);
          return <section key={dis} className="drawer-section"><div className="panel-title-row"><h3><LineIcon />{t(DISEASE_KEY[dis]!)} · {t('drawer.trend')}</h3><DataBadge kind="reported" /></div>
            {r.length ? <><div className="h-52"><ResponsiveContainer><ComposedChart data={r} margin={{ left: -4, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="year" {...axis} /><YAxis yAxisId="c" {...axis} tickFormatter={v => formatIN(v)} /><YAxis yAxisId="d" orientation="right" {...axis} tickFormatter={v => formatIN(v)} />
              <Tooltip {...tip} formatter={(v, n) => [typeof v === 'number' ? formatIN(v) : '—', n]} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="c" name={t('term.cases')} dataKey="cases" fill={dis === disease ? 'var(--primary)' : 'var(--muted-foreground)'} isAnimationActive={false} /><Line yAxisId="d" name={t('term.deaths')} dataKey="deaths" stroke="var(--risk-high)" strokeWidth={2} dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>
              <dl className="def-list"><div><dt>{t('kpi.cfr')} ({latest?.year ?? '—'})</dt><dd>{latest ? (cfr(latest.cases, latest.deaths) == null ? '—' : `${cfr(latest.cases, latest.deaths)!.toFixed(2)}%`) : '—'}</dd></div>
                <div><dt>{t('term.incidence')} ({year ?? '—'})</dt><dd>{rk ? t('drawer.rank', { r: rk.r, n: rk.n }) : '—'}</dd></div>
                {dis === 'chikungunya' && latest?.confirmed != null && <div><dt>Lab-confirmed</dt><dd>{formatIN(latest.confirmed)}</dd></div>}
                {dis === 'malaria' && latest?.tested != null && <div><dt>Blood smears examined</dt><dd>{formatIN(latest.tested)}</dd></div>}
                {dis === 'malaria' && latest?.pf != null && <div><dt>P. falciparum</dt><dd>{formatIN(latest.pf)}</dd></div>}</dl>
              {notes.length > 0 && <ul className="sub mt-2">{notes.map(x => <li key={x.year}>{x.year}: {x.note}</li>)}</ul>}</>
              : <p className="drawer-empty">{t('empty.burden')}</p>}
          </section>; })}
        {id === KARNATAKA && <section className="drawer-section"><div className="panel-title-row"><h3><History />{t('drawer.history')}</h3><DataBadge kind="reported" /></div>
          {history.isPending ? <Skeleton className="h-40" /> : hist.length ? <>
            <select className="world-select mb-2" value={histDistrict} aria-label={t('term.district')} onChange={e => setHistDistrict(e.target.value)}><option value="">{t('drawer.allDistricts')}</option>{histNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
            <div className="h-48"><ResponsiveContainer><LineChart data={histSeries} margin={{ left: -4, right: 8 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="week" {...axis} tickFormatter={w => String(w).slice(0, 4)} minTickGap={30} /><YAxis {...axis} tickFormatter={v => formatIN(v)} /><Tooltip {...tip} formatter={v => [typeof v === 'number' ? formatIN(v) : '—', t('term.cases')]} /><Line dataKey="cases" stroke="var(--primary)" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            <p className="sub mt-1">{t('drawer.historical', { d: hist[hist.length - 1]?.week_start ?? '—' })} · {src.get('icts_karnataka')?.note ?? 'ICTS'}</p></> : <p className="drawer-empty">{t('empty.history')}</p>}
        </section>}
        <section className="drawer-section"><div className="panel-title-row"><h3><CloudSun />{t('drawer.districts')}</h3><DataBadge kind="suitability" /></div>
          {needLive && <p className="forecast-notice mb-2">{live.isPending ? t('common.loading') : live.isError ? t('common.error') : <><strong>{t('weather.live')}</strong> · {t('weather.stale')}</>}</p>}
          {districts.length ? <div className="municipality-table-wrap"><table className="municipality-table"><thead><tr>{th('name', t('term.district'))}{th('population', t('term.population'))}{th('temp', '°C')}{th('rh', 'RH %')}{th('rain14', t('drawer.rain14'))}{th('next7', t('drawer.rainNext7'))}{th('aedes', t('drawer.aedes'))}{th('anopheles', t('drawer.anopheles'))}</tr></thead>
            <tbody>{sorted.map(d => { const w = weatherOf(d); return <tr key={d.id}><td>{d.name}</td><td>{formatIN(d.population)}</td><td>{n1(w?.temp_mean_7d)}</td><td>{n1(w?.humidity_7d, 0)}</td><td>{n1(w?.rain_14d_mm)}</td><td>{n1(w?.rain_next7d_mm)}</td>
              <td><span className={`suit-chip suit-${suitClass(w?.aedes_suitability ?? null)}`}>{n1(w?.aedes_suitability, 2)}</span></td><td><span className={`suit-chip suit-${suitClass(w?.anopheles_suitability ?? null)}`}>{n1(w?.anopheles_suitability, 2)}</span></td></tr>; })}</tbody></table></div>
            : <p className="drawer-empty">{t('empty.districts')}</p>}
        </section>
        <section className="drawer-section"><h3><ShieldCheck />{t('drawer.sources')}</h3>
          <ul className="text-sm flex flex-col gap-1">{SOURCES.filter(s => s.id !== 'icts_karnataka' || id === KARNATAKA).map(s => <li key={s.id}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>{src.get(s.id)?.note ? <span className="text-muted-foreground"> · {src.get(s.id)!.note}</span> : null}</li>)}</ul>
        </section>
      </>}
    </SheetContent>
  </Sheet>;
}
