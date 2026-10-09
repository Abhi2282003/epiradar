import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { getWeatherLayer } from '@/lib/weather.functions';
import { WEATHER_LAYERS, formatLayerValue, layerValue, type WeatherLayer } from '@/lib/weather';
import { ClientOnly, useNavigate, useSearch, useRouterState } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ArrowUpDown, Map, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { RISK_SCALE, validateContext } from '@/lib/epiradar';
import { formatNumber, formatProbability, riskLabel, sortMunicipalities, type Municipality } from '@/lib/surveillance';

const MunicipalityMap = lazy(() => import('./municipality-map'));
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? <div className="empty-content"><h3>Map boundaries unavailable</h3><p>Municipality boundaries could not be loaded. The real regional data remains available in Table view.</p></div> : this.props.children; }
}
export function RiskBadge({ level }: { level?: string | null | undefined }) {
  const label = riskLabel(level);
  return <span className="risk-badge"><span className={`risk-swatch risk-${RISK_SCALE.findIndex(risk => risk.label === label)}`} />{label}</span>;
}
export const weatherLayerQuery = { queryKey: ['weather', 'layer'], queryFn: () => getWeatherLayer(), staleTime: 60_000, refetchInterval: 5 * 60_000 };
export function WeatherAgo({ ts }: { ts: string | null | undefined }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (!ts) return <>never</>;
  return <time dateTime={ts}>{now == null ? ts.slice(0, 16).replace('T', ' ') : formatDistanceToNow(new Date(ts), { addSuffix: true })}</time>;
}
function LayerLegend({ layer }: { layer: WeatherLayer }) {
  const def = WEATHER_LAYERS.find(l => l.id === layer)!;
  const prefix = layer === 'suit' ? 'suit' : 'rain';
  return <div className="panel-footer" aria-label={`${def.label} scale`}><span className="legend-title">{def.label.toUpperCase()} · {def.unit.toUpperCase()}</span>
    {def.stops.map((stop, i) => { const next = def.stops[i + 1]; const f = (v: number) => layer === 'suit' ? `${Math.round(v * 100)}%` : `${v}`; return <span className="risk-item" key={stop}><span className={`risk-swatch ${prefix}-${i}`} />{next == null ? `≥ ${f(stop)}` : `${f(stop)}–${f(next)}`}</span>; })}
    <span className="risk-item"><span className="risk-swatch risk-4" />No data</span><span className="risk-item">Open-Meteo · context only, not a model input</span></div>;
}
export function RiskWorkspace({ rows, fullHeight = false, forecastError = false }: { rows: Municipality[]; fullHeight?: boolean; forecastError?: boolean }) {
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate({ from: '/brazil' });
  const pathname = useRouterState({ select: state => state.location.pathname });
  const to = pathname === '/map' ? '/map' : '/brazil';
  const select = (region: string) => { void navigate({ to, search: prev => ({ ...validateContext(prev), region }) }); };
  const table = context.view === 'table';
  const sorted = sortMunicipalities(rows, context.sort ?? 'name', context.desc ?? false);
  const noPredictions = !rows.some(row => row.prediction);
  const [layer, setLayer] = useState<WeatherLayer>('risk');
  const weather = useQuery(weatherLayerQuery);
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const byRegion = useMemo(() => new globalThis.Map((weather.data?.rows ?? []).map(w => [w.region_id, w])), [weather.data]);
  const values = useMemo(() => new globalThis.Map(rows.map(r => [r.region.id, layerValue(layer, byRegion.get(r.region.id))])), [rows, layer, byRegion]);
  const layerDef = WEATHER_LAYERS.find(l => l.id === layer)!;
  const tooltip = layer === 'risk' ? undefined : (row: Municipality) => [`${layerDef.label}: ${formatLayerValue(layer, values.get(row.region.id) ?? null)}`];
  const refreshWeather = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/public/refresh-weather', { method: 'POST' });
      const body = await res.json() as { cached?: boolean; updated?: number; next_allowed_at?: string; detail?: string };
      if (!res.ok) toast.error(`Weather refresh failed${body.detail ? `: ${body.detail}` : ''}`);
      else if (body.cached) toast(`Weather is recent; next refresh allowed ${body.next_allowed_at ? formatDistanceToNow(new Date(body.next_allowed_at), { addSuffix: true }) : 'later'}`);
      else toast(`Weather refreshed for ${body.updated ?? 0} municipalities`);
    } catch { toast.error('Weather refresh could not be reached'); }
    await client.invalidateQueries({ queryKey: ['weather'] });
    setRefreshing(false);
  };
  return <section className={`risk-workspace ${fullHeight ? 'risk-workspace-full' : ''}`}>
    <div className="risk-toolbar"><div><h2>Municipality outbreak risk</h2><p>{context.disease} · {context.horizon}-week forecast</p></div><div className="view-toggle" aria-label="Map or table view">
      <Button size="sm" variant={!table ? 'secondary' : 'ghost'} aria-pressed={!table} onClick={() => navigate({ to, search: prev => { const next = validateContext(prev); delete next.view; return next; } })}><Map />Map</Button>
      <Button size="sm" variant={table ? 'secondary' : 'ghost'} aria-pressed={table} onClick={() => navigate({ to, search: prev => ({ ...validateContext(prev), view: 'table' }) })}><Table2 />Table</Button>
    </div></div>
    <div className="layer-switch"><label htmlFor="map-layer" className="control-label">MAP LAYER</label><select id="map-layer" value={layer} onChange={e => setLayer(e.target.value as WeatherLayer)}>{WEATHER_LAYERS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
      <span className="layer-status">{weather.isError ? 'Weather unavailable' : <>Weather updated <WeatherAgo ts={weather.data?.source?.last_success_at} />{weather.data?.source?.status === 'degraded' && ' · last refresh failed'}</>}<Button size="sm" variant="outline" disabled={refreshing} onClick={refreshWeather} aria-label="Refresh weather"><RefreshCw className={refreshing ? 'refresh-spinning' : ''} />Refresh</Button></span></div>
    {layer !== 'risk' && !weather.isPending && !(weather.data?.rows.length) && <div className="forecast-notice">No weather rows loaded yet. Municipalities show as No data until the Open-Meteo refresh runs.</div>}
    {fullHeight && <div className="horizon-slider"><label id="map-horizon-label">Forecast horizon <strong>{context.horizon} {context.horizon === 1 ? 'week' : 'weeks'}</strong></label><Slider aria-labelledby="map-horizon-label" min={1} max={8} step={1} value={[context.horizon]} onValueChange={values => { const horizon = values[0]; if (horizon != null) void navigate({ to, search: prev => ({ ...validateContext(prev), horizon }) }); }} /><div className="slider-endpoints"><span>1 week</span><span>8 weeks</span></div></div>}
    {forecastError ? <div className="forecast-notice" role="alert">Forecasts could not be retrieved. Risk values are unavailable; please try again.</div> : noPredictions && <div className="forecast-notice">No forecasts loaded for this disease and horizon. Municipalities remain visible as No data until predictions arrive.</div>}
    {rows.length === 0 ? <div className="empty-content"><h3>No municipalities loaded</h3><p>Municipality boundaries and forecast values will appear when regional data is available.</p></div> : table ? <div className="municipality-table-wrap"><table className="municipality-table"><thead><tr>{[{ key: 'name', label: 'Municipality' }, { key: 'population', label: 'Population' }, { key: 'probability', label: 'Probability' }, { key: 'level', label: 'Risk level' }, { key: 'cases', label: 'Expected cases' }].map(column => <th key={column.key} aria-sort={context.sort === column.key ? context.desc ? 'descending' : 'ascending' : 'none'}><Button variant="ghost" size="sm" onClick={() => navigate({ to, search: prev => ({ ...validateContext(prev), sort: column.key, desc: context.sort === column.key ? !context.desc : false }) })}>{column.label}{context.sort === column.key ? context.desc ? <ArrowDown /> : <ArrowUp /> : <ArrowUpDown />}</Button></th>)}</tr></thead><tbody>{sorted.map(row => <tr key={row.region.id} data-selected={row.region.id === context.region}><td><Button variant="link" onClick={() => select(row.region.id)}>{row.region.name}</Button></td><td>{formatNumber(row.region.population)}</td><td>{formatProbability(row.prediction?.outbreak_prob)}</td><td><RiskBadge level={row.prediction?.risk_level} /></td><td>{formatNumber(row.prediction?.cases_p50)}</td></tr>)}</tbody></table></div> : <MapBoundary><ClientOnly fallback={<Skeleton className="map-loading" />}><Suspense fallback={<Skeleton className="map-loading" />}><MunicipalityMap rows={rows} selected={context.region} onSelect={select} layer={layer} values={values} tooltip={tooltip} label={layer === 'risk' ? undefined : `Rio de Janeiro municipality map: ${layerDef.label}`} /></Suspense></ClientOnly></MapBoundary>}
    {layer !== 'risk' && !table ? <LayerLegend layer={layer} /> : <div className="panel-footer" aria-label="Risk scale"><span className="legend-title">RISK SCALE</span>{RISK_SCALE.map((risk, index) => <span className="risk-item" key={risk.label}><span className={`risk-swatch risk-${index}`} />{risk.label}</span>)}</div>}
  </section>;
}