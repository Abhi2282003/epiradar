import { Component, lazy, Suspense, type ReactNode } from 'react';
import { ClientOnly, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ArrowUpDown, Map, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { RISK_SCALE, validateContext } from '@/lib/epiradar';
import { formatNumber, formatProbability, riskLabel, sortMunicipalities, type Municipality } from '@/lib/surveillance';

const MunicipalityMap = lazy(() => import('./municipality-map'));
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="empty-content"><h3>Map boundaries unavailable</h3><p>Municipality boundaries could not be loaded. The real regional data remains available in Table view.</p></div> : this.props.children; }
}
export function RiskBadge({ level }: { level?: string | null }) {
  const label = riskLabel(level);
  return <span className="risk-badge"><span className={`risk-swatch risk-${RISK_SCALE.findIndex(risk => risk.label === label)}`} />{label}</span>;
}
export function RiskWorkspace({ rows, fullHeight = false, forecastError = false }: { rows: Municipality[]; fullHeight?: boolean; forecastError?: boolean }) {
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate();
  const select = (region: string) => { void navigate({ search: prev => ({ ...prev, region }) }); };
  const selected = rows.find(row => row.region.id === context.region);
  const table = context.view === 'table';
  const sorted = sortMunicipalities(rows, context.sort ?? 'name', context.desc ?? false);
  const noPredictions = !rows.some(row => row.prediction);
  return <section className={`risk-workspace ${fullHeight ? 'risk-workspace-full' : ''}`}>
    <div className="risk-toolbar"><div><h2>Municipality outbreak risk</h2><p>{context.disease} · {context.horizon}-week forecast</p></div><div className="view-toggle" aria-label="Map or table view">
      <Button size="sm" variant={!table ? 'secondary' : 'ghost'} aria-pressed={!table} onClick={() => navigate({ search: prev => ({ ...prev, view: undefined }) })}><Map />Map</Button>
      <Button size="sm" variant={table ? 'secondary' : 'ghost'} aria-pressed={table} onClick={() => navigate({ search: prev => ({ ...prev, view: 'table' }) })}><Table2 />Table</Button>
    </div></div>
    {fullHeight && <div className="horizon-slider"><label id="map-horizon-label">Forecast horizon <strong>{context.horizon} {context.horizon === 1 ? 'week' : 'weeks'}</strong></label><Slider aria-labelledby="map-horizon-label" min={1} max={8} step={1} value={[context.horizon]} onValueChange={values => { const horizon = values[0]; if (horizon != null) void navigate({ search: prev => ({ ...prev, horizon }) }); }} /><div className="slider-endpoints"><span>1 week</span><span>8 weeks</span></div></div>}
    {forecastError ? <div className="forecast-notice" role="alert">Forecasts could not be retrieved. Risk values are unavailable; please try again.</div> : noPredictions && <div className="forecast-notice">No forecasts loaded for this disease and horizon. Municipalities remain visible as No data until predictions arrive.</div>}
    {rows.length === 0 ? <div className="empty-content"><h3>No municipalities loaded</h3><p>Municipality boundaries and forecast values will appear when regional data is available.</p></div> : table ? <div className="municipality-table-wrap"><table className="municipality-table"><thead><tr>{[{ key: 'name', label: 'Municipality' }, { key: 'population', label: 'Population' }, { key: 'probability', label: 'Probability' }, { key: 'level', label: 'Risk level' }, { key: 'cases', label: 'Expected cases' }].map(column => <th key={column.key} aria-sort={context.sort === column.key ? context.desc ? 'descending' : 'ascending' : 'none'}><Button variant="ghost" size="sm" onClick={() => navigate({ search: prev => ({ ...prev, sort: column.key, desc: context.sort === column.key ? !context.desc : false }) })}>{column.label}{context.sort === column.key ? context.desc ? <ArrowDown /> : <ArrowUp /> : <ArrowUpDown />}</Button></th>)}</tr></thead><tbody>{sorted.map(row => <tr key={row.region.id} data-selected={row.region.id === context.region}><td><Button variant="link" onClick={() => select(row.region.id)}>{row.region.name}</Button></td><td>{formatNumber(row.region.population)}</td><td>{formatProbability(row.prediction?.outbreak_prob)}</td><td><RiskBadge level={row.prediction?.risk_level} /></td><td>{formatNumber(row.prediction?.cases_p50)}</td></tr>)}</tbody></table></div> : <MapBoundary><ClientOnly fallback={<Skeleton className="map-loading" />}><Suspense fallback={<Skeleton className="map-loading" />}><MunicipalityMap rows={rows} selected={context.region} onSelect={select} /></Suspense></ClientOnly></MapBoundary>}
    {selected && <div className="region-selection" aria-label="Selected municipality"><div className="selection-heading"><div><span className="control-label">SELECTED MUNICIPALITY</span><h3>{selected.region.name}</h3></div><Button size="icon" variant="ghost" aria-label="Clear municipality selection" onClick={() => navigate({ search: prev => ({ ...prev, region: undefined }) })}><X /></Button></div><div className="selection-values"><div><span>Outbreak probability</span><strong>{formatProbability(selected.prediction?.outbreak_prob)}</strong><RiskBadge level={selected.prediction?.risk_level} /></div><div><span>Expected cases</span><strong>{formatNumber(selected.prediction?.cases_p50)}</strong></div><div><span>80% range</span><strong>{formatNumber(selected.prediction?.cases_p10)}–{formatNumber(selected.prediction?.cases_p90)}</strong></div></div></div>}
    <div className="panel-footer" aria-label="Risk scale"><span className="legend-title">RISK SCALE</span>{RISK_SCALE.map((risk, index) => <span className="risk-item" key={risk.label}><span className={`risk-swatch risk-${index}`} />{risk.label}</span>)}</div>
  </section>;
}