import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';

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

export const getReplay = createServerFn({ method: 'GET' }).handler(async () => {
  const client = publicClient();
  const [regions, disease, run] = await Promise.all([
    client.from('regions').select('*').order('name'),
    client.from('diseases').select('id').eq('name', 'Dengue').maybeSingle(),
    client.from('model_runs').select('model_version,card').eq('model_version', 'epiradar-cases-v1').maybeSingle(),
  ]);
  if (regions.error || disease.error || run.error) throw new Error('Replay data could not be retrieved');
  const rows: Database['public']['Tables']['backtests']['Row'][] = [];
  if (disease.data) {
    for (let from = 0; ; from += 1000) {
      const page = await client.from('backtests').select('*').eq('disease_id', disease.data.id).eq('horizon_weeks', 4)
        .order('region_id').order('target_week').range(from, from + 999);
      if (page.error) throw new Error('Backtests could not be retrieved');
      rows.push(...(page.data ?? []));
      if ((page.data ?? []).length < 1000) break;
    }
  }
  return { regions: regions.data ?? [], rows, card: (run.data?.card ?? null) as Json };
});

export const getFreshness = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().from('data_sources').select('last_success_at').not('last_success_at', 'is', null).order('last_success_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('Data freshness could not be retrieved');
  return data?.last_success_at ?? null;
});
