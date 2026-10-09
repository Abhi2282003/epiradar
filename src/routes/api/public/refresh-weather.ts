import { createFileRoute } from '@tanstack/react-router';
import { aggregateWeather, localDate, type OpenMeteoDaily } from '@/lib/weather';

const TZ = 'America/Sao_Paulo';
const BATCH = 23;
const THROTTLE_MS = 30 * 60_000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Public on purpose (the in-app Refresh button and the scheduler both call it). It only
// writes values fetched from Open-Meteo, and the 30-minute throttle stops anyone hammering the API.
async function refresh() {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const source = await db.from('data_sources').select('last_success_at,status,rows_last_run,note').eq('id', 'open_meteo').maybeSingle();
  const last = source.data?.last_success_at ? Date.parse(source.data.last_success_at) : NaN;
  if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) {
    return json({ cached: true, status: source.data?.status, last_success_at: source.data?.last_success_at, updated: source.data?.rows_last_run, next_allowed_at: new Date(last + THROTTLE_MS).toISOString() });
  }
  const regions = await db.from('regions').select('id,lat,lon').not('lat', 'is', null).not('lon', 'is', null).order('id');
  if (regions.error) return json({ error: 'Regions could not be read' }, 500);
  const list = regions.data ?? [];
  const today = localDate(TZ);
  const rows: Record<string, unknown>[] = [];
  try {
    for (let i = 0; i < list.length; i += BATCH) {
      if (i > 0) await sleep(2000);
      const batch = list.slice(i, i + BATCH);
      const params = new URLSearchParams({
        latitude: batch.map(r => r.lat!.toFixed(4)).join(','), longitude: batch.map(r => r.lon!.toFixed(4)).join(','),
        daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean',
        past_days: '28', forecast_days: '16', timezone: TZ,
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = await res.json() as { daily?: OpenMeteoDaily } | { daily?: OpenMeteoDaily }[];
      const results = Array.isArray(body) ? body : [body];
      if (results.length !== batch.length) throw new Error(`Open-Meteo returned ${results.length} locations for ${batch.length}`);
      const now = new Date().toISOString();
      batch.forEach((region, j) => rows.push({ region_id: region.id, updated_at: now, ...aggregateWeather(results[j]?.daily ?? {}, today) }));
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from('data_sources').update({ status: 'degraded', note: `Refresh failed: ${message}`.slice(0, 500) }).eq('id', 'open_meteo');
    return json({ error: 'Open-Meteo refresh failed', detail: message }, 502);
  }
  const up = await db.from('weather_now').upsert(rows as never, { onConflict: 'region_id' });
  if (up.error) return json({ error: 'Weather rows could not be saved', detail: up.error.message }, 500);
  const n = rows.length;
  const now = new Date().toISOString();
  await db.from('data_sources').update({ status: 'ok', last_success_at: now, rows_last_run: n, note: `Live: last 28 days + 16-day forecast, ${n} municipalities` }).eq('id', 'open_meteo');
  await db.from('live_events').insert({ kind: 'weather', severity: 'info', message: `Weather refreshed for ${n} municipalities (Open-Meteo)` });
  return json({ cached: false, status: 'ok', last_success_at: now, updated: n });
}

export const Route = createFileRoute('/api/public/refresh-weather')({
  server: { handlers: { POST: () => refresh() } },
});
