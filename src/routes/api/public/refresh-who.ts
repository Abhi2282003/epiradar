import { createFileRoute } from '@tanstack/react-router';
import { chunk } from '@/lib/india';

const THROTTLE_MS = 6 * 3_600_000;
const SOURCE = 'who_gho';
const META = { name: 'WHO Global Health Observatory: malaria estimates and cholera reports', cadence: 'Weekly; on demand at most every 6 hours' };
export const WHO_CODES = [
  { code: 'MALARIA_EST_CASES', disease: 'malaria', indicator: 'est_cases' },
  { code: 'MALARIA_EST_INCIDENCE', disease: 'malaria', indicator: 'est_incidence' },
  { code: 'MALARIA_EST_DEATHS', disease: 'malaria', indicator: 'est_deaths' },
  { code: 'CHOLERA_0000000001', disease: 'cholera', indicator: 'reported_cases' },
  { code: 'CHOLERA_0000000002', disease: 'cholera', indicator: 'reported_deaths' },
  { code: 'CHOLERA_0000000003', disease: 'cholera', indicator: 'cfr' },
] as const;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Gho = { SpatialDim?: string; TimeDim?: number; NumericValue?: number | null; Dim1?: string | null };

// Public on purpose (weekly scheduler). It only writes WHO values; the 6-hour throttle limits calls.
async function refresh() {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const source = await db.from('data_sources').select('last_success_at,status,rows_last_run').eq('id', SOURCE).maybeSingle();
  const last = source.data?.last_success_at ? Date.parse(source.data.last_success_at) : NaN;
  if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) return json({ cached: true, last_success_at: source.data?.last_success_at, updated: source.data?.rows_last_run });
  const counts: Record<string, number> = {}; const dropped: string[] = [];
  let total = 0;
  for (const c of WHO_CODES) {
    try {
      const url = `https://ghoapi.azureedge.net/api/${c.code}?$filter=${encodeURIComponent("SpatialDimType eq 'COUNTRY'")}`;
      const res = await fetch(url);
      if (!res.ok) { dropped.push(`${c.code} (HTTP ${res.status})`); continue; }
      const body = await res.json() as { value?: Gho[] };
      const seen = new Map<string, Record<string, unknown>>();
      for (const v of body.value ?? []) {
        if (!v.SpatialDim || !/^[A-Z]{3}$/.test(v.SpatialDim) || !Number.isInteger(v.TimeDim) || typeof v.NumericValue !== 'number' || v.Dim1) continue;
        seen.set(`${v.SpatialDim}|${v.TimeDim}`, { iso3: v.SpatialDim, disease_id: c.disease, year: v.TimeDim, indicator: c.indicator, value: v.NumericValue, source: 'WHO Global Health Observatory' });
      }
      const rows = [...seen.values()];
      if (!rows.length) { dropped.push(`${c.code} (no rows)`); continue; }
      for (const part of chunk(rows, 1000)) {
        const up = await db.from('country_reported').upsert(part as never, { onConflict: 'iso3,disease_id,year,indicator' });
        if (up.error) throw new Error(up.error.message);
      }
      counts[c.code] = rows.length; total += rows.length;
    } catch (e) { dropped.push(`${c.code} (${e instanceof Error ? e.message : String(e)})`); }
  }
  const now = new Date().toISOString();
  const ok = Object.keys(counts).length > 0;
  await db.from('data_sources').upsert({ id: SOURCE, ...META, status: ok ? (dropped.length ? 'degraded' : 'ok') : 'degraded', ...(ok ? { last_success_at: now, rows_last_run: total } : {}), note: `${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}${dropped.length ? ` · not loaded: ${dropped.join(', ')}` : ''}`.slice(0, 500) });
  return json({ cached: false, counts, dropped, updated: total }, ok ? 200 : 502);
}

export const Route = createFileRoute('/api/public/refresh-who')({
  server: { handlers: { POST: () => refresh() } },
});
