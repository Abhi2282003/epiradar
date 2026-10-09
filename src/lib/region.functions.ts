import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { validateContext } from '@/lib/epiradar';

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
const regionInput = (input: { region: string; disease: string; horizon?: number }) => {
  const context = validateContext({ disease: input.disease, horizon: input.horizon ?? 4 });
  if (typeof input.region !== 'string' || !input.region || input.region.length > 100) throw new Error('Invalid region');
  return { region: input.region, disease: context.disease, horizon: context.horizon };
};
async function diseaseId(client: ReturnType<typeof publicClient>, name: string) {
  const { data, error } = await client.from('diseases').select('id').eq('name', name).maybeSingle();
  if (error) throw new Error('Disease lookup failed');
  return data?.id ?? null;
}

export const getRegionList = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().from('regions').select('id,name,admin1').order('name');
  if (error) throw new Error('Regions could not be retrieved');
  return data ?? [];
});

export const getRegionSummary = createServerFn({ method: 'GET' }).inputValidator(regionInput).handler(async ({ data }) => {
  const client = publicClient();
  const id = await diseaseId(client, data.disease);
  const regionResult = await client.from('regions').select('*').eq('id', data.region).maybeSingle();
  if (regionResult.error) throw new Error('Region could not be retrieved');
  if (!id) return { region: regionResult.data, prediction: null };
  const prediction = await client.from('latest_predictions').select('*').eq('region_id', data.region).eq('disease_id', id).eq('horizon_weeks', data.horizon).maybeSingle();
  if (prediction.error) throw new Error('Forecast could not be retrieved');
  return { region: regionResult.data, prediction: prediction.data };
});

export const getRegionForecast = createServerFn({ method: 'GET' }).inputValidator(regionInput).handler(async ({ data }) => {
  const client = publicClient();
  const id = await diseaseId(client, data.disease);
  if (!id) return { issueWeek: null, observations: [], forecasts: [] };
  const forecasts = await client.from('latest_predictions').select('horizon_weeks,target_week,issue_week,cases_p10,cases_p50,cases_p90,threshold_cases,model_version').eq('region_id', data.region).eq('disease_id', id).order('horizon_weeks');
  if (forecasts.error) throw new Error('Forecasts could not be retrieved');
  const rows = forecasts.data ?? [];
  const issueWeek = rows.find(row => row.horizon_weeks === 1)?.issue_week ?? rows[0]?.issue_week ?? null;
  const sameIssue = rows.filter(row => row.issue_week === issueWeek);
  if (!issueWeek) return { issueWeek: null, observations: [], forecasts: [] };
  const obs = await client.from('observations').select('week_start,cases,threshold_cases').eq('region_id', data.region).eq('disease_id', id).lte('week_start', issueWeek).order('week_start', { ascending: false }).limit(26);
  if (obs.error) throw new Error('Observations could not be retrieved');
  return { issueWeek, observations: (obs.data ?? []).reverse(), forecasts: sameIssue };
});

export const getPredictionDrivers = createServerFn({ method: 'GET' }).inputValidator((input: { prediction: string }) => {
  if (!/^[0-9a-f-]{36}$/i.test(input.prediction)) throw new Error('Invalid prediction');
  return input;
}).handler(async ({ data }) => {
  const result = await publicClient().from('drivers').select('rank,family,label,contribution').eq('prediction_id', data.prediction).order('rank');
  if (result.error) throw new Error('Drivers could not be retrieved');
  return result.data ?? [];
});

export const getLastSeason = createServerFn({ method: 'GET' }).inputValidator(regionInput).handler(async ({ data }) => {
  const client = publicClient();
  const id = await diseaseId(client, data.disease);
  if (!id) return [];
  const result = await client.from('observations').select('week_start,cases').eq('region_id', data.region).eq('disease_id', id).gte('week_start', '2024-01-01').lte('week_start', '2024-12-31').order('week_start');
  if (result.error) throw new Error('Season data could not be retrieved');
  return result.data ?? [];
});
