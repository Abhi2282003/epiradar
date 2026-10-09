import { createServerFn } from '@tanstack/react-start';
import { validateContext } from '@/lib/epiradar';
import { publicClient } from '@/lib/replay.functions';

type Client = ReturnType<typeof publicClient>;
async function diseaseId(client: Client, name: string) {
  const r = await client.from('diseases').select('id').eq('name', name).maybeSingle();
  if (r.error) throw new Error('Disease lookup failed');
  return r.data?.id ?? null;
}
const COLS = 'region_id,rain_delta_pct,temp_delta_c,horizon_weeks,outbreak_prob';
const regionCheck = (v: unknown) => { if (typeof v !== 'string' || !v || v.length > 100) throw new Error('Invalid region'); return v; };

/** Whether scenarios exist, the climate model version, and the weather outlook used by the empty state. */
export const getScenarioMeta = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string }) => ({ disease: validateContext(input).disease }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const id = await diseaseId(client, data.disease);
    const [probe, runs, outlook] = await Promise.all([
      id ? client.from('scenarios').select('region_id').eq('disease_id', id).limit(1) : Promise.resolve({ data: [], error: null }),
      id ? client.from('model_runs').select('model_version,created_at,card').eq('disease_id', id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
      client.from('weather_now').select('region_id,fc_tsuit_16d,fc_rain_16d_mm,updated_at,regions(name)').not('fc_tsuit_16d', 'is', null).order('fc_tsuit_16d', { ascending: false }).limit(5),
    ]);
    if (probe.error || runs.error) throw new Error('Scenario data could not be retrieved');
    const climateRun = (runs.data ?? []).find(r => { const c = (r.card as Record<string, unknown> | null)?.['climate_features']; return Array.isArray(c) && c.length > 0; });
    return {
      hasScenarios: (probe.data ?? []).length > 0,
      sampleRegion: probe.data?.[0]?.region_id ?? null,
      climateModel: climateRun?.model_version ?? null,
      outlook: outlook.error ? null : (outlook.data ?? []).map(o => ({ region_id: o.region_id, name: (o.regions as { name: string } | null)?.name ?? o.region_id, suit: o.fc_tsuit_16d, rain: o.fc_rain_16d_mm, updated_at: o.updated_at })),
    };
  });

/** Every scenario row for one municipality (all steps, all horizons). */
export const getScenarioRegion = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string; region: string }) => ({ disease: validateContext(input).disease, region: regionCheck(input.region) }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const id = await diseaseId(client, data.disease);
    if (!id) return [];
    const r = await client.from('scenarios').select(COLS).eq('disease_id', id).eq('region_id', data.region).limit(1000);
    if (r.error) throw new Error('Scenarios could not be retrieved');
    return r.data ?? [];
  });

/** One scenario (and the no-change scenario) for all municipalities at one horizon. */
export const getScenarioState = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string; horizon: number; rain: number; temp: number }) => {
    const c = validateContext(input);
    if (!Number.isFinite(input.rain) || !Number.isFinite(input.temp) || Math.abs(input.rain) > 1000 || Math.abs(input.temp) > 20) throw new Error('Invalid scenario');
    return { disease: c.disease, horizon: c.horizon, rain: input.rain, temp: input.temp };
  })
  .handler(async ({ data }) => {
    const client = publicClient();
    const id = await diseaseId(client, data.disease);
    if (!id) return { scenario: [], baseline: [] };
    const q = (rain: number, temp: number) => client.from('scenarios').select(COLS).eq('disease_id', id).eq('horizon_weeks', data.horizon).eq('rain_delta_pct', rain).eq('temp_delta_c', temp).limit(1000);
    const [scenario, baseline] = await Promise.all([q(data.rain, data.temp), q(0, 0)]);
    if (scenario.error || baseline.error) throw new Error('Scenarios could not be retrieved');
    return { scenario: scenario.data ?? [], baseline: baseline.data ?? [] };
  });
