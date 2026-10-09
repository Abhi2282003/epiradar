import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { validateContext } from '@/lib/epiradar';

export const getSurveillance = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string; horizon: number }) => validateContext(input))
  .handler(async ({ data }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Public data connection is not configured.');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } },
    });
    const [regionsResult, diseaseResult, eventsResult] = await Promise.all([
      client.from('regions').select('*').order('name'),
      client.from('diseases').select('id').eq('name', data.disease).maybeSingle(),
      client.from('live_events').select('id,ts,kind,message,severity,region_id').order('ts', { ascending: false }).limit(25),
    ]);
    const diseaseId = diseaseResult.data?.id;
    if (!diseaseId) return {
      regions: regionsResult.data ?? [], predictions: [], baseline: [], alerts: [], events: eventsResult.data ?? [],
      errors: { regions: Boolean(regionsResult.error), forecasts: Boolean(diseaseResult.error), alerts: Boolean(diseaseResult.error), events: Boolean(eventsResult.error) },
    };
    const [forecasts, alerts] = await Promise.all([
      client.from('latest_predictions').select('*').eq('disease_id', diseaseId).in('horizon_weeks', [...new Set([1, data.horizon])]),
      client.from('alerts').select('id,status,region_id').eq('disease_id', diseaseId),
    ]);
    return {
      regions: regionsResult.data ?? [],
      predictions: (forecasts.data ?? []).filter(row => row.horizon_weeks === data.horizon),
      baseline: (forecasts.data ?? []).filter(row => row.horizon_weeks === 1),
      alerts: alerts.data ?? [], events: eventsResult.data ?? [],
      errors: { regions: Boolean(regionsResult.error), forecasts: Boolean(forecasts.error), alerts: Boolean(alerts.error), events: Boolean(eventsResult.error) },
    };
  });