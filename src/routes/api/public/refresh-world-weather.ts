import { createFileRoute } from '@tanstack/react-router';
import { backoffUntil, rateLimitNote } from '@/lib/india';
import { gridPoints } from '@/lib/world';

const BATCH = 100;
const THROTTLE_MS = 30 * 60_000;
const SOURCE = 'open_meteo_world';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type Current = { temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number; cloud_cover?: number; wind_speed_10m?: number; wind_direction_10m?: number; time?: string };
const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;

// Public on purpose (the in-app button and the scheduler call it). It only writes values fetched
// from Open-Meteo; the 30-minute throttle keeps repeated calls from reaching the API.
async function refresh() {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const source = await db.from('data_sources').select('last_success_at,status,rows_last_run,note').eq('id', SOURCE).maybeSingle();
  const until = backoffUntil(source.data?.note);
  if (until && Date.now() < Date.parse(until)) return json({ cached: true, backoff: true, status: 'degraded', last_success_at: source.data?.last_success_at, next_allowed_at: until, detail: 'Open-Meteo rate limit reached; keeping the last good values' });
  const last = source.data?.last_success_at ? Date.parse(source.data.last_success_at) : NaN;
  if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) {
    return json({ cached: true, status: source.data?.status, last_success_at: source.data?.last_success_at, updated: source.data?.rows_last_run, next_allowed_at: new Date(last + THROTTLE_MS).toISOString() });
  }
  const points = gridPoints();
  const rows: Record<string, unknown>[] = [];
  try {
    for (let i = 0; i < points.length; i += BATCH) {
      if (i > 0) await sleep(2500);
      const batch = points.slice(i, i + BATCH);
      const params = new URLSearchParams({
        latitude: batch.map(p => p.lat).join(','), longitude: batch.map(p => p.lon).join(','),
        current: 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m',
        wind_speed_unit: 'kmh', timezone: 'GMT',
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = await res.json() as { current?: Current } | { current?: Current }[];
      const results = Array.isArray(body) ? body : [body];
      if (results.length !== batch.length) throw new Error(`Open-Meteo returned ${results.length} locations for ${batch.length}`);
      const now = new Date().toISOString();
      batch.forEach((p, j) => {
        const c = results[j]?.current ?? {};
        rows.push({ lat: p.lat, lon: p.lon, updated_at: now, temp_c: n(c.temperature_2m), rh: n(c.relative_humidity_2m), precip_mm: n(c.precipitation), cloud_cover: n(c.cloud_cover), wind_speed: n(c.wind_speed_10m), wind_dir: n(c.wind_direction_10m) });
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from('data_sources').upsert({ id: SOURCE, name: 'Open-Meteo world grid', cadence: 'Every 12 hours', status: 'degraded', note: `Refresh failed: ${message}`.slice(0, 500) });
    return json({ error: 'Open-Meteo refresh failed', detail: message }, 502);
  }
  const up = await db.from('world_weather_grid').upsert(rows as never, { onConflict: 'lat,lon' });
  if (up.error) return json({ error: 'Grid rows could not be saved', detail: up.error.message }, 500);
  const now = new Date().toISOString();
  await db.from('data_sources').upsert({ id: SOURCE, name: 'Open-Meteo world grid', cadence: 'Every 12 hours', status: 'ok', last_success_at: now, rows_last_run: rows.length, note: `Live current conditions on a 10° global grid, ${rows.length} cells` });
  await db.from('live_events').insert({ kind: 'weather', severity: 'info', message: `World weather grid refreshed: ${rows.length} cells (Open-Meteo)` });
  return json({ cached: false, status: 'ok', last_success_at: now, updated: rows.length });
}

export const Route = createFileRoute('/api/public/refresh-world-weather')({
  server: { handlers: { POST: () => refresh() } },
});
