import { useEffect, useRef, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';
import { boundariesQuery } from '@/lib/municipality-boundaries';
import { formatNumber, formatProbability, riskLabel, type Municipality } from '@/lib/surveillance';
import { RISK_SCALE } from '@/lib/epiradar';
import { Button } from '@/components/ui/button';
import { LocateFixed } from 'lucide-react';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

function cssColor(token: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  ctx.fillRect(0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
}
export default function MunicipalityMap({ rows, selected, onSelect }: { rows: Municipality[]; selected?: string | undefined; onSelect: (id: string) => void }) {
  const { data: boundaries } = useSuspenseQuery(boundariesQuery);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const selectRef = useRef(onSelect); selectRef.current = onSelect;
  const [light, setLight] = useState(false);
  const [ready, setReady] = useState(0);
  const [error, setError] = useState(false);
  const boundsRef = useRef<[number, number, number, number] | null>(null);
  useEffect(() => {
    const update = () => setLight(document.documentElement.dataset['theme'] === 'light');
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setError(false);
    void import('maplibre-gl').then(maplibre => {
      if (cancelled || !container.current) return;
      maplibre.setWorkerUrl(mapWorkerUrl);
      const map = new maplibre.Map({
        container: container.current,
        style: light ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        attributionControl: false,
        renderWorldCopies: false,
      });
      mapRef.current = map;
      map.addControl(new maplibre.AttributionControl({ customAttribution: '© OpenStreetMap contributors © CARTO', compact: true }), 'bottom-right');
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false, className: 'municipality-tooltip', maxWidth: '260px' });
      const bounds = new maplibre.LngLatBounds();
      const visit = (coords: unknown) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') bounds.extend([coords[0], coords[1]]);
        else coords.forEach(visit);
      };
      boundaries.features.forEach(feature => { if ('coordinates' in feature.geometry) visit(feature.geometry.coordinates); });
      if (!bounds.isEmpty()) boundsRef.current = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      map.on('load', () => {
        map.addSource('municipalities', { type: 'geojson', data: boundaries });
        const color: ExpressionSpecification = ['match', ['get', 'risk'], RISK_SCALE[0].label, cssColor('--risk-low'), RISK_SCALE[1].label, cssColor('--risk-moderate'), RISK_SCALE[2].label, cssColor('--risk-high'), RISK_SCALE[3].label, cssColor('--risk-very-high'), cssColor('--risk-no-data')];
        map.addLayer({ id: 'municipality-fill', type: 'fill', source: 'municipalities', paint: { 'fill-color': color, 'fill-opacity': 0.65 } });
        map.addLayer({ id: 'municipality-outline', type: 'line', source: 'municipalities', paint: { 'line-color': cssColor('--background'), 'line-width': 1 } });
        map.addLayer({ id: 'municipality-selected', type: 'line', source: 'municipalities', filter: ['==', ['get', 'region_id'], ''], paint: { 'line-color': cssColor('--primary'), 'line-width': 3 } });
        if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: 32, duration: 0 });
        setError(false);
        setReady(value => value + 1);
      });
      map.on('mousemove', 'municipality-fill', event => {
        const code = event.features?.[0]?.properties?.['id'];
        const row = rowsRef.current.find(item => String(item.region.official_code) === String(code));
        map.getCanvas().style.cursor = row ? 'pointer' : '';
        const node = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = row?.region.name ?? String(event.features?.[0]?.properties?.['name'] ?? 'Municipality'); node.append(title);
        const lines = row ? [
          `${formatProbability(row.prediction?.outbreak_prob)} · ${riskLabel(row.prediction?.risk_level)}`,
          `Expected cases: ${formatNumber(row.prediction?.cases_p50)}`,
          `80% range: ${formatNumber(row.prediction?.cases_p10)}–${formatNumber(row.prediction?.cases_p90)}`,
        ] : ['No data'];
        lines.forEach(text => { const line = document.createElement('p'); line.textContent = text; node.append(line); });
        popup.setLngLat(event.lngLat).setDOMContent(node).addTo(map);
      });
      map.on('mouseleave', 'municipality-fill', () => { popup.remove(); map.getCanvas().style.cursor = ''; });
      map.on('click', 'municipality-fill', event => {
        const code = event.features?.[0]?.properties?.['id'];
        const row = rowsRef.current.find(item => String(item.region.official_code) === String(code));
        if (row) { popup.remove(); selectRef.current(row.region.id); }
      });
      map.on('error', () => { if (!map.isStyleLoaded()) setError(true); });
      let previousWidth = container.current.clientWidth;
      const resize = new ResizeObserver(() => {
        map.resize();
        const width = container.current?.clientWidth ?? previousWidth;
        if (width !== previousWidth && boundsRef.current && map.getLayer('municipality-fill')) map.fitBounds(boundsRef.current, { padding: 32, duration: 0 });
        previousWidth = width;
      }); resize.observe(container.current);
      cleanup = () => { resize.disconnect(); popup.remove(); map.remove(); mapRef.current = null; };
    }).catch(() => setError(true));
    return () => { cancelled = true; cleanup?.(); };
  }, [boundaries, light]);
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('municipalities') as GeoJSONSource | undefined;
    if (!source) return;
    const byCode = new Map(rows.map(row => [String(row.region.official_code), row]));
    source.setData({ ...boundaries, features: boundaries.features.map(feature => {
      const row = byCode.get(String(feature.properties.id));
      return { ...feature, properties: { ...feature.properties, risk: riskLabel(row?.prediction?.risk_level), region_id: row?.region.id ?? '' } };
    }) });
    map?.setFilter('municipality-selected', ['==', ['get', 'region_id'], selected ?? '']);
  }, [rows, selected, boundaries, ready]);
  return <div className="map-stage"><div ref={container} className="map-canvas" aria-label="Rio de Janeiro municipality outbreak risk map" />
    <Button className="map-fit" variant="secondary" size="icon" title="Fit all municipalities" aria-label="Fit all municipalities" onClick={() => { if (boundsRef.current) mapRef.current?.fitBounds(boundsRef.current, { padding: 32, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 }); }}><LocateFixed /></Button>
    {error && <div className="map-message" role="alert">Map tiles could not load. Municipality data remains available in Table view.</div>}
  </div>;
}