import { createServerFn } from '@tanstack/react-start';
import { validateContext } from '@/lib/epiradar';
import { publicClient } from '@/lib/replay.functions';

/** Latest model card for the disease plus all data sources. */
export const getTrust = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string }) => ({ disease: validateContext(input).disease }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const [disease, sources] = await Promise.all([
      client.from('diseases').select('id').eq('name', data.disease).maybeSingle(),
      client.from('data_sources').select('*').order('name'),
    ]);
    if (disease.error || sources.error) throw new Error('Model and data information could not be retrieved');
    let run: { model_version: string; created_at: string | null; card: unknown } | null = null;
    if (disease.data) {
      const r = await client.from('model_runs').select('model_version,created_at,card').eq('disease_id', disease.data.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (r.error) throw new Error('Model card could not be retrieved');
      run = r.data;
    }
    return { run: run as { model_version: string; created_at: string | null; card: never } | null, sources: sources.data ?? [] };
  });

/** Open alerts for the disease, newest first, with municipality names. */
export const getOpenAlerts = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string }) => ({ disease: validateContext(input).disease }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const disease = await client.from('diseases').select('id').eq('name', data.disease).maybeSingle();
    if (disease.error) throw new Error('Alerts could not be retrieved');
    if (!disease.data) return [];
    const alerts = await client.from('alerts').select('id,region_id,level,lead_weeks,message,issued_at,regions(name)').eq('disease_id', disease.data.id).eq('status', 'open').order('issued_at', { ascending: false }).limit(200);
    if (alerts.error) throw new Error('Alerts could not be retrieved');
    return (alerts.data ?? []).map(a => ({ id: a.id, region_id: a.region_id, region_name: (a.regions as { name: string } | null)?.name ?? null, level: a.level, lead_weeks: a.lead_weeks, message: a.message, issued_at: a.issued_at }));
  });
