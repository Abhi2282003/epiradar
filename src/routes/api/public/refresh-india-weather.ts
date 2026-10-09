import { createFileRoute } from '@tanstack/react-router';
import { backoffUntil, rateLimitNote } from '@/lib/india';
import { aggregateIndia, chunk, indiaToday, INDIA_DAILY_VARS, OPEN_METEO_BATCH, type IndiaDaily } from '@/lib/india';

const THROTTLE_MS = 6 * 3_600_000;
const PAUSE_MS = 3000;
const SOURCE = 'open_meteo_india';
const META = { name: 'Open-Meteo live district weather (India)', cadence: 'Daily ~05:40 IST; on demand at most every 6 hours' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Public on purpose (in-app button and the daily scheduler). It only writes values fetched from
// Open-Meteo; the 6-hour throttle stops repeated calls from reaching the API.
async function refresh() {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const source = await db.from('data_sources').select('last_success_at,status,rows_last_run,note').eq('id', SOURCE).maybeSingle();
  const until = backoffUntil(source.data?.note);
  if (until && Date.now() < Date.parse(until)) return json({ cached: true, backoff: true, status: 'degraded', last_success_at: source.data?.last_success_at, next_allowed_at: until, detail: 'Open-Meteo rate limit reached; keeping the last good values' });
  const last = source.data?.last_success_at ? Date.parse(source.data.last_success_at) : NaN;
  if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) {
    return json({ cached: true, status: source.data?.status, last_success_at: source.data?.last_success_at, updated: source.data?.rows_last_run, next_allowed_at: new Date(last + THROTTLE_MS).toISOString() });
  }
  const districts = await db.from('india_districts').select('id,lat,lon').not('lat', 'is', null).not('lon', 'is', null).order('id').limit(2000);
  if (districts.error) return json({ error: 'Districts could not be read' }, 500);
  const list = districts.data ?? [];
  if (!list.length) return json({ error: 'No districts are loaded yet' }, 409);
  const today = indiaToday();
  const rows: Record<string, unknown>[] = [];
  let failure: string | null = null;
  const batches = chunk(list, OPEN_METEO_BATCH);
  for (let b = 0; b < batches.length; b++) {
    if (b > 0) await sleep(PAUSE_MS);
    const batch = batches[b]!;
    const params = new URLSearchParams({
      latitude: batch.map(d => d.lat!.toFixed(4)).join(','), longitude: batch.map(d => d.lon!.toFixed(4)).join(','),
      daily: INDIA_DAILY_VARS, past_days: '14', forecast_days: '7', timezone: 'Asia/Kolkata', wind_speed_unit: 'kmh',
    });
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) { failure = `Open-Meteo HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; break; }
      const body = await res.json() as { daily?: IndiaDaily } | { daily?: IndiaDaily }[];
      const results = Array.isArray(body) ? body : [body];
      if (results.length !== batch.length) { failure = `Open-Meteo returned ${results.length} locations for ${batch.length}`; break; }
      const now = new Date().toISOString();
      batch.forEach((d, j) => rows.push({ district_id: d.id, updated_at: now, ...aggregateIndia(results[j]?.daily ?? {}, today) }));
    } catch (e) { failure = e instanceof Error ? e.message : String(e); break; }
  }
  // Batches fetched before a failure are saved; districts not reached keep their previous rows.
  if (rows.length) {
    const up = await db.from('india_district_weather').upsert(rows as never, { onConflict: 'district_id' });
    if (up.error) return json({ error: 'Weather rows could not be saved', detail: up.error.message }, 500);
  }
  const now = new Date().toISOString();
  if (failure) {
    await db.from('data_sources').upsert({ id: SOURCE, ...META, status: 'degraded', note: `Refresh stopped: ${failure}. Kept previous values; ${rows.length} of ${list.length} districts updated.`.slice(0, 500) });
    return json({ error: 'Open-Meteo refresh stopped', detail: failure, updated: rows.length }, 502);
  }
  await db.from('data_sources').upsert({ id: SOURCE, ...META, status: 'ok', last_success_at: now, rows_last_run: rows.length, note: `Last 14 days + 7-day forecast for ${rows.length} districts, as of ${today}` });
  await db.from('live_events').insert({ kind: 'weather', severity: 'info', message: `India district weather refreshed: ${rows.length} districts (Open-Meteo)` });
  return json({ cached: false, status: 'ok', last_success_at: now, updated: rows.length });
}

export const Route = createFileRoute('/api/public/refresh-india-weather')({
  server: { handlers: { POST: () => refresh() } },
});
