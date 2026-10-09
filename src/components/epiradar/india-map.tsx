import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, GeoJSONSource, RasterTileSource, MapLayerMouseEvent, LngLatBoundsLike } from 'maplibre-gl';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { BASE_LAYERS, OVERLAYS, layerDate, tileUrl, type RasterLayer } from '@/lib/world';
import { INDIA_BOUNDS } from '@/lib/india';
import { cssColor, hatch } from './world-map';

export type StateValue = { id: string; title: string; lines: string[]; bin: number };
export type DistrictPoint = { id: string; name: string; lat: number; lon: number; population: number | null; suit: number | null; level?: number | null; windSpeed: number | null; windDir: number | null; cloud: number | null; lines: string[] };
export type Focus = { nonce: number; bounds?: [[number, number], [number, number]]; center?: [number, number]; zoom?: number };
export type IndiaMapProps = {
  topo: Topology | null; globe: boolean; base: string; overlays: Record<string, { on: boolean; opacity: number }>;
  today: string; picked: string | null; states: Map<string, StateValue>; choropleth: boolean;
  districts: DistrictPoint[]; dots: boolean; wind: boolean; cloud: boolean; selected?: string | undefined; focus: Focus;
  noDataLabel: string; onSelect: (id: string) => void; onLayerStatus: (key: string, ok: boolean) => void; failedLabel: string;
  /** 'level' colours dots by forecast risk level (0 low … 3 very high); default colours by suitability. */
  colorBy?: 'suit' | 'level'; onSelectDistrict?: (id: string) => void;
  /** Travel links of the selected district (gravity model), drawn as lines. */
  links?: { from: [number, number]; to: [number, number]; share: number }[];
};
const ALL_RASTERS = [...BASE_LAYERS, ...OVERLAYS];
const rid = (l: RasterLayer) => `raster-${l.key}`;
export const SUIT_STEPS = [0.25, 0.5, 0.75];
export const suitClass = (v: number | null) => v == null ? -1 : v < SUIT_STEPS[0]! ? 0 : v < SUIT_STEPS[1]! ? 1 : v < SUIT_STEPS[2]! ? 2 : 3;

function arrowImage(color: string) {
  const s = 24; const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d')!; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(12, 21); ctx.lineTo(12, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, 2); ctx.lineTo(7, 9); ctx.lineTo(17, 9); ctx.closePath(); ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}

export default function IndiaMap(props: IndiaMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const [ready, setReady] = useState(0);
  const [light, setLight] = useState(false);
  const [failed, setFailed] = useState(false);
  const geo = useRef<FeatureCollection<Geometry> | null>(null);
  if (props.topo && !geo.current) {
    const obj = props.topo.objects['states'];
    if (obj) { const fc = feature(props.topo, obj) as unknown as FeatureCollection<Geometry> | Feature<Geometry>; geo.current = fc.type === 'FeatureCollection' ? fc : { type: 'FeatureCollection', features: [fc] }; }
  }

  useEffect(() => {
    const update = () => setLight(document.documentElement.dataset['theme'] === 'light');
    update(); const o = new MutationObserver(update);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false; let cleanup: (() => void) | undefined;
    void import('maplibre-gl').then(maplibre => {
      if (cancelled || !container.current) return;
      maplibre.setWorkerUrl(mapWorkerUrl);
      const map = new maplibre.Map({
        container: container.current,
        style: light ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        bounds: INDIA_BOUNDS as LngLatBoundsLike, fitBoundsOptions: { padding: 20 }, attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibre.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap contributors © CARTO · NASA GIBS · EC JRC/Google · Boundaries: DataMeet (CC BY 2.5 India) · Open-Meteo' }), 'bottom-right');
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false, className: 'municipality-tooltip', maxWidth: '280px' });
      map.on('style.load', () => {
        map.setProjection({ type: propsRef.current.globe ? 'globe' : 'mercator' });
        const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
        const empty = { type: 'FeatureCollection' as const, features: [] };
        map.addSource('states', { type: 'geojson', data: empty });
        map.addSource('districts', { type: 'geojson', data: empty });
        map.addSource('links', { type: 'geojson', data: empty });
        if (!map.hasImage('hatch')) map.addImage('hatch', hatch(cssColor('--muted-foreground')));
        if (!map.hasImage('arrow')) map.addImage('arrow', arrowImage(cssColor('--foreground')));
        map.addLayer({ id: 'state-fill', type: 'fill', source: 'states', filter: ['==', ['get', 'has'], true], paint: { 'fill-color': ['coalesce', ['get', 'fill'], cssColor('--risk-no-data')], 'fill-opacity': 0.65 } }, firstSymbol);
        map.addLayer({ id: 'state-nodata', type: 'fill', source: 'states', filter: ['==', ['get', 'has'], false], paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.55 } }, firstSymbol);
        map.addLayer({ id: 'state-line', type: 'line', source: 'states', paint: { 'line-color': cssColor('--muted-foreground'), 'line-width': 0.7 } }, firstSymbol);
        map.addLayer({ id: 'state-selected', type: 'line', source: 'states', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': cssColor('--primary'), 'line-width': 2.5 } }, firstSymbol);
        map.addLayer({ id: 'district-cloud', type: 'circle', source: 'districts', filter: ['!=', ['get', 'cloud'], null], layout: { visibility: 'none' }, paint: { 'circle-color': cssColor('--foreground'), 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 14, 6, 50, 9, 160], 'circle-blur': 1, 'circle-opacity': ['*', 0.45, ['/', ['get', 'cloud'], 100]] } });
        map.addLayer({ id: 'district-links', type: 'line', source: 'links', layout: { 'line-cap': 'round' }, paint: { 'line-color': cssColor('--primary'), 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['get', 'share'], 0, 1, 0.5, 6] } });
        map.addLayer({ id: 'district-dots', type: 'circle', source: 'districts', layout: { visibility: 'none' }, paint: {
          'circle-color': ['coalesce', ['get', 'suitColor'], cssColor('--risk-no-data')],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['+', 1.5, ['*', 0.0011, ['sqrt', ['coalesce', ['get', 'population'], 0]]]], 8, ['+', 4, ['*', 0.004, ['sqrt', ['coalesce', ['get', 'population'], 0]]]]],
          'circle-stroke-color': cssColor('--background'), 'circle-stroke-width': 0.6, 'circle-opacity': 0.9 } });
        map.addLayer({ id: 'district-wind', type: 'symbol', source: 'districts', filter: ['all', ['!=', ['get', 'windDir'], null], ['!=', ['get', 'windSpeed'], null]], layout: { visibility: 'none', 'icon-image': 'arrow', 'icon-rotate': ['+', ['get', 'windDir'], 180], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-size': ['interpolate', ['linear'], ['get', 'windSpeed'], 0, 0.35, 40, 1] }, paint: { 'icon-opacity': 0.85 } });
        setReady(v => v + 1);
      });
      const show = (e: MapLayerMouseEvent, title: string, lines: string[]) => {
        const node = document.createElement('div');
        const t = document.createElement('strong'); t.textContent = title; node.append(t);
        lines.forEach(s => { const l = document.createElement('p'); l.textContent = s; node.append(l); });
        popup.setLngLat(e.lngLat).setDOMContent(node).addTo(map);
      };
      const stateHover = (e: MapLayerMouseEvent) => {
        const id = String(e.features?.[0]?.properties?.['id'] ?? '');
        const v = propsRef.current.states.get(id);
        map.getCanvas().style.cursor = v ? 'pointer' : '';
        show(e, v?.title ?? propsRef.current.noDataLabel, v?.lines ?? []);
      };
      for (const id of ['state-fill', 'state-nodata']) {
        map.on('mousemove', id, stateHover);
        map.on('mouseleave', id, () => { popup.remove(); map.getCanvas().style.cursor = ''; });
        map.on('click', id, e => { if (e.defaultPrevented) return; const hit = map.getLayer('district-dots') && map.getLayoutProperty('district-dots', 'visibility') === 'visible' ? map.queryRenderedFeatures(e.point, { layers: ['district-dots'] }) : []; if (hit.length) return; const sid = String(e.features?.[0]?.properties?.['id'] ?? ''); if (propsRef.current.states.has(sid)) { popup.remove(); propsRef.current.onSelect(sid); } });
      }
      map.on('mousemove', 'district-dots', e => {
        const id = String(e.features?.[0]?.properties?.['id'] ?? '');
        const d = propsRef.current.districts.find(x => x.id === id);
        if (d) { show(e, d.name, d.lines); map.getCanvas().style.cursor = propsRef.current.onSelectDistrict ? 'pointer' : ''; }
      });
      map.on('mouseleave', 'district-dots', () => { popup.remove(); map.getCanvas().style.cursor = ''; });
      map.on('click', 'district-dots', e => {
        const id = String(e.features?.[0]?.properties?.['id'] ?? '');
        if (id && propsRef.current.onSelectDistrict) { popup.remove(); e.preventDefault(); propsRef.current.onSelectDistrict(id); }
      });
      map.on('error', e => {
        const src = (e as unknown as { sourceId?: string }).sourceId;
        if (src?.startsWith('raster-')) propsRef.current.onLayerStatus(src.slice(7), false);
        else if (!map.isStyleLoaded()) setFailed(true);
      });
      map.on('sourcedata', e => { if (e.sourceId.startsWith('raster-') && e.tile) propsRef.current.onLayerStatus(e.sourceId.slice(7), true); });
      const ro = new ResizeObserver(() => map.resize()); ro.observe(container.current);
      cleanup = () => { ro.disconnect(); popup.remove(); map.remove(); mapRef.current = null; };
    }).catch(() => setFailed(true));
    return () => { cancelled = true; cleanup?.(); };
  }, [light]);

  useEffect(() => { const m = mapRef.current; if (m?.isStyleLoaded()) m.setProjection({ type: props.globe ? 'globe' : 'mercator' }); }, [props.globe, ready]);

  const tilesRef = useRef(new Map<string, string>());
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !map.getLayer('state-fill')) return;
    const want = (l: RasterLayer) => BASE_LAYERS.includes(l) ? props.base === l.key : !!props.overlays[l.key]?.on;
    for (const l of ALL_RASTERS) {
      const id = rid(l);
      if (!want(l)) { if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); tilesRef.current.delete(id); continue; }
      const url = tileUrl(l, layerDate(l, props.today, props.picked));
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'raster', tiles: [url], tileSize: 256, maxzoom: l.maxzoom });
        const before = BASE_LAYERS.includes(l) ? OVERLAYS.map(rid).find(o => map.getLayer(o)) ?? 'state-fill' : 'state-fill';
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 1 } }, before);
        tilesRef.current.set(id, url);
      } else if (tilesRef.current.get(id) !== url) { (map.getSource(id) as RasterTileSource).setTiles([url]); tilesRef.current.set(id, url); }
      map.setPaintProperty(id, 'raster-opacity', BASE_LAYERS.includes(l) ? 1 : props.overlays[l.key]?.opacity ?? 0.8);
    }
  }, [props.base, props.overlays, props.today, props.picked, ready]);

  // States
  useEffect(() => {
    const map = mapRef.current; const src = map?.getSource('states') as GeoJSONSource | undefined;
    if (!src || !geo.current) return;
    const ramp = [0, 1, 2, 3, 4].map(i => cssColor(`--rain-${i}`));
    src.setData({ ...geo.current, features: geo.current.features.map(f => {
      const id = String(f.properties?.['id'] ?? f.id ?? '');
      const v = props.states.get(id);
      const fill = v && v.bin >= 0 ? ramp[v.bin] ?? null : null;
      const has = !props.choropleth ? true : fill != null;
      return { ...f, properties: { ...f.properties, id, fill, has } };
    }) });
    map!.setPaintProperty('state-fill', 'fill-opacity', props.choropleth ? 0.65 : 0);
    map!.setFilter('state-selected', ['==', ['get', 'id'], props.selected ?? '']);
  }, [props.states, props.choropleth, props.selected, ready, props.topo]);

  // Districts
  useEffect(() => {
    const map = mapRef.current; const src = map?.getSource('districts') as GeoJSONSource | undefined;
    if (!src) return;
    const colors = ['--risk-low', '--risk-moderate', '--risk-high', '--risk-very-high'].map(cssColor);
    const byLevel = props.colorBy === 'level';
    const colorOf = (d: DistrictPoint) => byLevel ? (d.level != null && d.level >= 0 ? colors[d.level] ?? null : null) : suitClass(d.suit) >= 0 ? colors[suitClass(d.suit)] : null;
    // draw higher levels last so they sit on top
    const list = byLevel ? [...props.districts].sort((a, b) => (a.level ?? -1) - (b.level ?? -1)) : props.districts;
    src.setData({ type: 'FeatureCollection', features: list.map(d => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lon, d.lat] }, properties: { id: d.id, population: d.population, suitColor: colorOf(d), windDir: d.windDir, windSpeed: d.windSpeed, cloud: d.cloud } })) });
    map!.setLayoutProperty('district-dots', 'visibility', props.dots ? 'visible' : 'none');
    map!.setLayoutProperty('district-wind', 'visibility', props.wind ? 'visible' : 'none');
    map!.setLayoutProperty('district-cloud', 'visibility', props.cloud ? 'visible' : 'none');
  }, [props.districts, props.dots, props.wind, props.cloud, props.colorBy, ready]);

  // Travel links of the selected district
  useEffect(() => {
    const map = mapRef.current; const src = map?.getSource('links') as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({ type: 'FeatureCollection', features: (props.links ?? []).map(l => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [l.from, l.to] }, properties: { share: l.share } })) });
  }, [props.links, ready]);

  // Focus
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !props.focus.nonce) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (props.focus.bounds) map.fitBounds(props.focus.bounds as LngLatBoundsLike, { padding: 30, animate: !reduced, maxZoom: 10 });
    else if (props.focus.center) map.flyTo({ center: props.focus.center, zoom: props.focus.zoom ?? 8, animate: !reduced });
  }, [props.focus.nonce, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="relative">
    <div ref={container} className="world-stage" role="region" aria-label="India map" />
    {failed && <p className="map-error">{props.failedLabel}</p>}
  </div>;
}
