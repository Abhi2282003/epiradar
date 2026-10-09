import { createFileRoute } from '@tanstack/react-router';
import { chunk, weekStart } from '@/lib/india';

const THROTTLE_MS = 24 * 3_600_000;
const SOURCE = 'icts_karnataka';
const URL_CSV = 'https://extranet.icts.res.in/Dengue/Data/Updated_Daily_File.csv';
const META = { name: 'ICTS Karnataka district dengue (daily, historical)', cadence: 'Historical archive; on demand at most daily' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Parse the ICTS CSV and sum daily counts into Monday-starting weeks per district. */
export function weeklyFromCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const head = (lines.shift() ?? '').split(',').map(h => h.replace(/"/g, '').trim());
  const iDate = head.indexOf('metadata.recordDate'), iName = head.indexOf('location.admin2.name');
  const iPos = head.indexOf('daily_positive_total'), iDeath = head.indexOf('daily_deaths');
  if ([iDate, iName, iPos, iDeath].some(i => i < 0)) throw new Error('Unexpected ICTS columns');
  const weeks = new Map<string, { district_name: string; week_start: string; cases: number; deaths: number }>();
  let lastDate = '';
  for (const line of lines) {
    const c = line.split(',').map(s => s.replace(/"/g, '').trim());
    const date = c[iDate] ?? '', name = c[iName] ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) continue;
    const pos = Number(c[iPos]), death = Number(c[iDeath]);
    const key = `${name}|${weekStart(date)}`;
    const w = weeks.get(key) ?? { district_name: name, week_start: weekStart(date), cases: 0, deaths: 0 };
    if (Number.isFinite(pos)) w.cases += pos; if (Number.isFinite(death)) w.deaths += death;
    weeks.set(key, w); if (date > lastDate) lastDate = date;
  }
  return { rows: [...weeks.values()], lastDate };
}

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
