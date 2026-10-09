import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function publicClient() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Public data connection is not configured.');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
}

export const getWeatherLayer = createServerFn({ method: 'GET' }).handler(async () => {
  const client = publicClient();
  const [rows, source] = await Promise.all([
    client.from('weather_now').select('region_id,updated_at,rain_7d_mm,rain_28d_mm,fc_rain_16d_mm,tsuit_7d,fc_tsuit_16d,tmean_7d'),
    client.from('data_sources').select('status,last_success_at,note').eq('id', 'open_meteo').maybeSingle(),
  ]);
  if (rows.error) throw new Error('Weather could not be retrieved');
  return { rows: rows.data ?? [], source: source.data ?? null };
});

const regionOnly = (input: { region: string }) => {
  if (typeof input.region !== 'string' || !input.region || input.region.length > 100) throw new Error('Invalid region');
  return { region: input.region };
};

export const getRegionWeather = createServerFn({ method: 'GET' }).inputValidator(regionOnly).handler(async ({ data }) => {
  const r = await publicClient().from('weather_now').select('*').eq('region_id', data.region).maybeSingle();
  if (r.error) throw new Error('Weather could not be retrieved');
  return r.data;
});

export const getCasesClimate = createServerFn({ method: 'GET' }).inputValidator((input: { region: string; disease: string }) => ({ ...regionOnly(input), disease: String(input.disease).slice(0, 60) })).handler(async ({ data }) => {
  const client = publicClient();
  const d = await client.from('diseases').select('id').eq('name', data.disease).maybeSingle();
  if (!d.data) return [];
  const r = await client.from('observations').select('week_start,cases,rain_mm,temp_mean').eq('region_id', data.region).eq('disease_id', d.data.id).order('week_start', { ascending: false }).limit(52);
  if (r.error) throw new Error('Observations could not be retrieved');
  return (r.data ?? []).reverse();
});
