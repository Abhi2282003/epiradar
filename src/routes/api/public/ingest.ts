import { createFileRoute } from '@tanstack/react-router';

const CONFLICT: Record<string, string> = {
  regions: 'id', observations: 'region_id,disease_id,week_start', predictions: 'id', drivers: 'prediction_id,rank',
  alerts: 'id', scenarios: 'region_id,disease_id,rain_delta_pct,temp_delta_c,horizon_weeks',
  backtests: 'region_id,disease_id,target_week,horizon_weeks', model_runs: 'model_version', data_sources: 'id', live_events: 'id',
  countries: 'iso3', country_series: 'iso3,disease_id,month', country_forecasts: 'iso3,disease_id,target_month,horizon_months',
  country_backtests: 'iso3,disease_id,target_month,horizon_months', world_weather_grid: 'lat,lon', admin1_burden: 'country_iso3,admin1,disease_id,year',
  geo_assets: 'id', india_states: 'id', india_districts: 'id', india_district_weather: 'district_id', country_reported: 'iso3,disease_id,year,indicator', india_district_history: 'district_name,week_start',
};
const ALLOWED = new Set(Object.keys(CONFLICT));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute('/api/public/ingest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['INGEST_TOKEN'];
        if (!secret) return json({ error: 'Ingest is not configured' }, 503);
        const token = request.headers.get('x-ingest-token') ?? '';
        if (!safeEqual(token, secret)) return json({ error: 'Unauthorized' }, 401);
        let body: { table?: unknown; rows?: unknown };
        try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
        const { table, rows } = body;
        if (typeof table !== 'string' || !ALLOWED.has(table)) return json({ error: 'Table not allowed' }, 400);
        if (!Array.isArray(rows) || rows.some(r => typeof r !== 'object' || r === null || Array.isArray(r))) return json({ error: 'rows must be an array of objects' }, 400);
        if (rows.length === 0) return json({ table, upserted: 0 });
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error, count } = await (supabaseAdmin.from(table as any) as any).upsert(rows, { onConflict: CONFLICT[table], count: 'exact' });
        if (error) return json({ error: error.message }, 400);
        return json({ table, upserted: count ?? rows.length });
      },
    },
  },
});
