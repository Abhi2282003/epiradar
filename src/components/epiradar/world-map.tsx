import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Map as MapLibreMap, GeoJSONSource, RasterTileSource, MapLayerMouseEvent } from 'maplibre-gl';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { worldTopoQuery } from '@/lib/world-query';
import { BASE_LAYERS, OVERLAYS, incidenceBin, layerDate, makeField, normIsoNum, tileUrl, windUV, WIND_BINS, type GridCell, type RasterLayer } from '@/lib/world';

export type CountryValue = { iso3: string; isoNum: string | null; name: string; value: number | null; label: string; band: string | null; freshness: string };
export type WorldMapProps = {
  globe: boolean; base: string; overlays: Record<string, { on: boolean; opacity: number }>;
  today: string; picked: string | null; metric: 'prob' | 'cases' | 'none';
  values: Map<string, CountryValue>; grid: GridCell[] | null; wind: boolean; cloud: boolean;
  selected?: string | undefined; onSelect: (iso3: string) => void; onLayerStatus: (key: string, ok: boolean) => void; onBoundaries: (ok: boolean) => void;
};

function cssColor(token: string) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const ctx = c.getContext('2d'); const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!ctx) return raw;
  ctx.fillStyle = raw; ctx.fillRect(0, 0, 1, 1);
  const p = ctx.getImageData(0, 0, 1, 1).data; return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
}
const RISK_TOKENS: Record<string, string> = { Low: '--risk-low', Moderate: '--risk-moderate', High: '--risk-high', 'Very high': '--risk-very-high' };
const ALL_RASTERS = [...BASE_LAYERS, ...OVERLAYS];
const rid = (l: RasterLayer) => `raster-${l.key}`;
const WIND_TOKENS = ['--rain-1', '--primary', '--risk-moderate', '--risk-high'];

function hatch(color: string) {
  const size = 8; const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!; ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(size, 0); ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

export default function WorldMap(props: WorldMapProps) {
  const { data: topo, isError: topoError } = useQuery(worldTopoQuery);
  const container = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const [ready, setReady] = useState(0);
  const [light, setLight] = useState(false);
  const [failed, setFailed] = useState(false);
  const geo = useRef<FeatureCollection<Geometry> | null>(null);
  if (topo && !geo.current) {
    const obj = topo.objects['countries'];
    if (obj) geo.current = feature(topo, obj) as unknown as FeatureCollection<Geometry>;
  }
  useEffect(() => { props.onBoundaries(!topoError); }, [topoError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const update = () => setLight(document.documentElement.dataset['theme'] === 'light');
    update(); const o = new MutationObserver(update);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  }, []);

  // Map lifetime (recreated on theme change so the basemap style matches).
  useEffect(() => {
    let cancelled = false; let cleanup: (() => void) | undefined;
    void import('maplibre-gl').then(maplibre => {
      if (cancelled || !container.current) return;
      maplibre.setWorkerUrl(mapWorkerUrl);
      const map = new maplibre.Map({
        container: container.current,
        style: light ? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-20, 12], zoom: 1.6, attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibre.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap contributors © CARTO · NASA GIBS · EC JRC/Google · Natural Earth via world-atlas · Open-Meteo' }), 'bottom-right');
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false, className: 'municipality-tooltip', maxWidth: '260px' });
      map.on('style.load', () => {
        map.setProjection({ type: propsRef.current.globe ? 'globe' : 'mercator' });
        const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
        map.addSource('countries', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        if (!map.hasImage('hatch')) map.addImage('hatch', hatch(cssColor('--muted-foreground')));
        map.addLayer({ id: 'country-fill', type: 'fill', source: 'countries', filter: ['==', ['get', 'has'], true], paint: { 'fill-color': ['coalesce', ['get', 'fill'], cssColor('--risk-no-data')], 'fill-opacity': 0.6 } }, firstSymbol);
        map.addLayer({ id: 'country-nodata', type: 'fill', source: 'countries', filter: ['==', ['get', 'has'], false], paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.5 } }, firstSymbol);
        map.addLayer({ id: 'country-line', type: 'line', source: 'countries', paint: { 'line-color': cssColor('--border'), 'line-width': 0.6 } }, firstSymbol);
        map.addLayer({ id: 'country-selected', type: 'line', source: 'countries', filter: ['==', ['get', 'iso3'], ''], paint: { 'line-color': cssColor('--primary'), 'line-width': 2.5 } }, firstSymbol);
        setReady(v => v + 1);
      });
      const hover = (e: MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties ?? {};
        const v = propsRef.current.values.get(String(p['iso3'] ?? ''));
        map.getCanvas().style.cursor = v ? 'pointer' : '';
        const node = document.createElement('div');
        const t = document.createElement('strong'); t.textContent = v?.name ?? String(p['name'] ?? 'Country'); node.append(t);
        const lines = v ? [v.label, v.freshness] : ['No data'];
        lines.forEach(s => { const l = document.createElement('p'); l.textContent = s; node.append(l); });
        popup.setLngLat(e.lngLat).setDOMContent(node).addTo(map);
      };
      for (const id of ['country-fill', 'country-nodata']) {
        map.on('mousemove', id, hover);
        map.on('mouseleave', id, () => { popup.remove(); map.getCanvas().style.cursor = ''; });
        map.on('click', id, e => { const iso = e.features?.[0]?.properties?.['iso3']; if (iso && propsRef.current.values.has(String(iso))) { popup.remove(); propsRef.current.onSelect(String(iso)); } });
      }
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

  // Projection
  useEffect(() => { const m = mapRef.current; if (m?.isStyleLoaded()) m.setProjection({ type: props.globe ? 'globe' : 'mercator' }); }, [props.globe, ready]);

  // Rasters: added only when switched on, removed when off.
  const tilesRef = useRef(new Map<string, string>());
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !map.getLayer('country-fill')) return;
    const want = (l: RasterLayer) => BASE_LAYERS.includes(l) ? props.base === l.key : !!props.overlays[l.key]?.on;
    for (const l of ALL_RASTERS) {
      const id = rid(l);
      if (!want(l)) { if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); tilesRef.current.delete(id); continue; }
      const url = tileUrl(l, layerDate(l, props.today, props.picked));
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'raster', tiles: [url], tileSize: 256, maxzoom: l.maxzoom });
        const before = BASE_LAYERS.includes(l) ? OVERLAYS.map(rid).find(o => map.getLayer(o)) ?? 'country-fill' : 'country-fill';
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 1 } }, before);
        tilesRef.current.set(id, url);
      } else if (tilesRef.current.get(id) !== url) { (map.getSource(id) as RasterTileSource).setTiles([url]); tilesRef.current.set(id, url); }
      map.setPaintProperty(id, 'raster-opacity', BASE_LAYERS.includes(l) ? 1 : props.overlays[l.key]?.opacity ?? 0.8);
    }
  }, [props.base, props.overlays, props.today, props.picked, ready]);

  // Countries
  useEffect(() => {
    const map = mapRef.current; const src = map?.getSource('countries') as GeoJSONSource | undefined;
    if (!src || !geo.current) return;
    const byNum = new Map<string, CountryValue>();
    const isoByNum = new Map<string, string>();
    for (const v of props.values.values()) { const n = (v as CountryValue & { isoNum?: string | null }).isoNum; if (n) { byNum.set(n, v); isoByNum.set(n, v.iso3); } }
    const risk = Object.fromEntries(Object.entries(RISK_TOKENS).map(([k, t]) => [k, cssColor(t)]));
    const ramp = [0, 1, 2, 3, 4].map(i => cssColor(`--rain-${i}`));
    src.setData({ ...geo.current, features: geo.current.features.map(f => {
      const num = normIsoNum(f.id); const v = num ? byNum.get(num) : undefined;
      let fill: string | null = null;
      if (v && props.metric === 'prob') fill = v.band ? risk[v.band] ?? null : null;
      if (v && props.metric === 'cases') { const b = incidenceBin(v.value); fill = b < 0 ? null : ramp[b] ?? null; }
      const has = props.metric === 'none' ? true : fill != null;
      return { ...f, properties: { ...f.properties, iso3: v?.iso3 ?? '', fill, has } };
    }) });
    map!.setPaintProperty('country-fill', 'fill-opacity', props.metric === 'none' ? 0 : 0.6);
    map!.setFilter('country-selected', ['==', ['get', 'iso3'], props.selected ?? '']);
  }, [props.values, props.metric, props.selected, ready, topo]);

  // Live wind and cloud canvas
  useEffect(() => {
    const map = mapRef.current; const canvas = canvasRef.current;
    if (!map || !canvas || !ready || !props.grid?.length || (!props.wind && !props.cloud)) { if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); return; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grid = props.grid;
    const uField = makeField(grid, c => c.wind_speed != null && c.wind_dir != null ? windUV(c.wind_speed, c.wind_dir).u : null);
    const vField = makeField(grid, c => c.wind_speed != null && c.wind_dir != null ? windUV(c.wind_speed, c.wind_dir).v : null);
    const cField = makeField(grid, c => c.cloud_cover);
    const colors = WIND_TOKENS.map(cssColor);
    const cloudRgb = cssColor('--foreground').match(/\d+/g)?.slice(0, 3).join(',') ?? '255,255,255';
    const speedColor = (s: number) => colors[s < WIND_BINS[0]! ? 0 : s < WIND_BINS[1]! ? 1 : s < WIND_BINS[2]! ? 2 : 3]!;
    const cloudLayer = document.createElement('canvas'); const trail = document.createElement('canvas');
    let w = 0, h = 0; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => { w = canvas.clientWidth; h = canvas.clientHeight; for (const c of [canvas, trail]) { c.width = w * dpr; c.height = h * dpr; } };
    size();
    const valid = (x: number, y: number) => { const ll = map.unproject([x, y]); const p = map.project(ll); return Math.hypot(p.x - x, p.y - y) < 1.5 ? ll : null; };
    const drawCloud = () => {
      if (!props.cloud) return;
      const step = 8; const cw = Math.ceil(w / step), ch = Math.ceil(h / step);
      cloudLayer.width = cw; cloudLayer.height = ch;
      const cctx = cloudLayer.getContext('2d')!; const img = cctx.createImageData(cw, ch);
      const [r, g, b] = cloudRgb.split(',').map(Number);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const ll = valid(i * step + step / 2, j * step + step / 2); if (!ll) continue;
        const v = cField.get(ll.lat, ll.lng); if (v == null) continue;
        const k = (j * cw + i) * 4; img.data[k] = r!; img.data[k + 1] = g!; img.data[k + 2] = b!; img.data[k + 3] = Math.round((v / 100) * 150);
      }
      cctx.putImageData(img, 0, 0);
    };
    const wind = (ll: { lat: number; lng: number }) => { const u = uField.get(ll.lat, ll.lng), v = vField.get(ll.lat, ll.lng); return u == null || v == null ? null : { u, v, s: Math.hypot(u, v) }; };
    const screenDir = (ll: { lat: number; lng: number }, u: number, v: number) => {
      const a = map.project(ll); const k = 0.5 / Math.max(Math.hypot(u, v), 1e-6);
      const b = map.project([ll.lng + (u * k) / Math.max(Math.cos((ll.lat * Math.PI) / 180), 0.2), ll.lat + v * k]);
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; return { dx: dx / d, dy: dy / d };
    };
    type P = { x: number; y: number; age: number };
    const count = Math.round(Math.min(2500, (w * h) / 450));
    const spawn = (): P => ({ x: Math.random() * w, y: Math.random() * h, age: Math.floor(Math.random() * 90) });
    let particles: P[] = Array.from({ length: count }, spawn);
    const tctx = trail.getContext('2d')!;
    const compose = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (props.cloud) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.filter = 'blur(6px)'; ctx.drawImage(cloudLayer, 0, 0, canvas.width, canvas.height); ctx.restore(); }
      if (props.wind) ctx.drawImage(trail, 0, 0);
    };
    const drawArrows = () => {
      tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, trail.width, trail.height); tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const c of grid) {
        if (c.wind_speed == null || c.wind_dir == null) continue;
        const p = map.project([c.lon, c.lat]); if (p.x < 0 || p.y < 0 || p.x > w || p.y > h || !valid(p.x, p.y)) continue;
        const { u, v } = windUV(c.wind_speed, c.wind_dir); const d = screenDir({ lat: c.lat, lng: c.lon }, u, v);
        const len = 6 + Math.min(c.wind_speed, 60) / 3;
        tctx.strokeStyle = speedColor(c.wind_speed); tctx.lineWidth = 1.5; tctx.beginPath();
        tctx.moveTo(p.x - d.dx * len / 2, p.y - d.dy * len / 2); tctx.lineTo(p.x + d.dx * len / 2, p.y + d.dy * len / 2);
        const hx = p.x + d.dx * len / 2, hy = p.y + d.dy * len / 2;
        tctx.lineTo(hx - d.dx * 4 - d.dy * 3, hy - d.dy * 4 + d.dx * 3); tctx.moveTo(hx, hy); tctx.lineTo(hx - d.dx * 4 + d.dy * 3, hy - d.dy * 4 - d.dx * 3); tctx.stroke();
      }
    };
    let raf = 0; let moving = false;
    const frame = () => {
      if (props.wind && !moving) {
        tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.globalCompositeOperation = 'destination-in'; tctx.fillStyle = 'rgba(0,0,0,0.92)'; tctx.fillRect(0, 0, trail.width, trail.height);
        tctx.globalCompositeOperation = 'source-over'; tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.lineWidth = 1.1;
        particles = particles.map(p => {
          if (p.age++ > 100) return spawn();
          const ll = valid(p.x, p.y); if (!ll) return spawn();
          const wv = wind(ll); if (!wv) return spawn();
          const d = screenDir(ll, wv.u, wv.v); const step = 0.25 + wv.s * 0.04;
          const nx = p.x + d.dx * step, ny = p.y + d.dy * step;
          tctx.strokeStyle = speedColor(wv.s); tctx.beginPath(); tctx.moveTo(p.x, p.y); tctx.lineTo(nx, ny); tctx.stroke();
          return { x: nx, y: ny, age: p.age };
        });
      }
      compose(); raf = requestAnimationFrame(frame);
    };
    const redrawStatic = () => { drawCloud(); if (props.wind) drawArrows(); compose(); };
    const onMoveStart = () => { moving = true; tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, trail.width, trail.height); };
    const onMoveEnd = () => { moving = false; drawCloud(); particles = Array.from({ length: count }, spawn); if (reduced) redrawStatic(); };
    let pendingMove = 0;
    const onMove = () => { if (pendingMove) return; pendingMove = requestAnimationFrame(() => { pendingMove = 0; if (reduced) redrawStatic(); else { drawCloud(); compose(); } }); };
    const onResize = () => { size(); onMoveEnd(); };
    map.on('movestart', onMoveStart); map.on('moveend', onMoveEnd); map.on('move', onMove); map.on('resize', onResize);
    drawCloud();
    if (reduced) redrawStatic(); else raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(pendingMove); map.off('movestart', onMoveStart); map.off('moveend', onMoveEnd); map.off('move', onMove); map.off('resize', onResize); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [props.grid, props.wind, props.cloud, ready, props.globe]);

  return <div className="map-stage world-stage">
    <div ref={container} className="map-canvas" aria-label="World map of country dengue outlook and environmental layers" />
    <canvas ref={canvasRef} className="world-overlay-canvas" aria-hidden="true" />
    {failed && <div className="map-error">The basemap could not be loaded. Country data is still available in the panel.</div>}
  </div>;
}
