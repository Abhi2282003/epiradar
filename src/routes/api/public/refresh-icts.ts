import { createFileRoute } from '@tanstack/react-router';
import { chunk, weeklyFromCsv } from '@/lib/india';

const THROTTLE_MS = 24 * 3_600_000;
const SOURCE = 'icts_karnataka';
const URL_CSV = 'https://extranet.icts.res.in/Dengue/Data/Updated_Daily_File.csv';
const META = { name: 'ICTS Karnataka district dengue (daily, historical)', cadence: 'Historical archive; on demand at most daily' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function refresh() {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const source = await db.from('data_sources').select('last_success_at,rows_last_run').eq('id', SOURCE).maybeSingle();
  const last = source.data?.last_success_at ? Date.parse(source.data.last_success_at) : NaN;
  if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) return json({ cached: true, updated: source.data?.rows_last_run });
  try {
    const res = await fetch(URL_CSV);
    if (!res.ok) throw new Error(`ICTS HTTP ${res.status}`);
    const { rows, lastDate } = weeklyFromCsv(await res.text());
    for (const part of chunk(rows, 1000)) { const up = await db.from('india_district_history').upsert(part as never, { onConflict: 'district_name,week_start' }); if (up.error) throw new Error(up.error.message); }
    await db.from('data_sources').upsert({ id: SOURCE, ...META, status: 'ok', last_success_at: new Date().toISOString(), rows_last_run: rows.length, note: `Historical daily counts aggregated to weeks; last date ${lastDate}` });
    return json({ updated: rows.length, lastDate });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from('data_sources').upsert({ id: SOURCE, ...META, status: 'degraded', note: `Refresh failed: ${message}`.slice(0, 500) });
    return json({ error: 'ICTS refresh failed', detail: message }, 502);
  }
}

export const Route = createFileRoute('/api/public/refresh-icts')({
  server: { handlers: { POST: () => refresh() } },
});
