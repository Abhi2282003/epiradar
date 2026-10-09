import { createServerFn } from '@tanstack/react-start';
import { validateContext } from '@/lib/epiradar';
import { publicClient } from '@/lib/replay.functions';

async function diseaseId(client: ReturnType<typeof publicClient>, name: string) {
  const d = await client.from('diseases').select('id').eq('name', name).maybeSingle();
  if (d.error) throw new Error('Disease could not be retrieved');
  return d.data?.id ?? null;
}

/** Everything the world map needs at once: countries, next-month forecasts, 12-month cases and the live grid. */
export const getWorldOverview = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string }) => ({ disease: validateContext(input).disease }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const id = await diseaseId(client, data.disease);
    const [countries, grid, source] = await Promise.all([
      client.from('countries').select('iso3,iso_num,name,region,subregion,lat,lon,population,dengue_resolution,dengue_first,dengue_last,has_forecast').order('name').limit(400),
      client.from('world_weather_grid').select('lat,lon,updated_at,temp_c,rh,precip_mm,cloud_cover,wind_speed,wind_dir').limit(1000),
      client.from('data_sources').select('status,last_success_at,note').eq('id', 'open_meteo_world').maybeSingle(),
    ]);
    if (countries.error) throw new Error('Countries could not be retrieved');
    let forecasts: { iso3: string | null; outbreak_prob: number | null; risk_level: string | null; issue_month: string | null; target_month: string | null }[] = [];
    let cases: { iso3: string | null; cases_12m: number | null; last_month: string | null; months_reported: number | null }[] = [];
    if (id) {
      const [f, c] = await Promise.all([
        client.from('latest_country_forecasts').select('iso3,outbreak_prob,risk_level,issue_month,target_month').eq('disease_id', id).eq('horizon_months', 1).limit(400),
        client.from('country_cases_12m').select('iso3,cases_12m,last_month,months_reported').eq('disease_id', id).limit(400),
      ]);
      if (f.error || c.error) throw new Error('Country forecasts could not be retrieved');
      forecasts = f.data ?? []; cases = c.data ?? [];
    }
    return { countries: countries.data ?? [], forecasts, cases, grid: grid.error ? null : grid.data ?? [], gridSource: source.data ?? null };
  });

/** One country's history, forecast, backtest and environment; all reads are scoped to that country. */
export const getCountryDetail = createServerFn({ method: 'GET' })
  .inputValidator((input: { iso3: string; disease: string }) => {
    if (typeof input.iso3 !== 'string' || !/^[A-Z]{3}$/.test(input.iso3)) throw new Error('Invalid country');
    return { iso3: input.iso3, disease: validateContext(input).disease };
  })
  .handler(async ({ data }) => {
    const client = publicClient();
    const id = await diseaseId(client, data.disease);
    const country = await client.from('countries').select('*').eq('iso3', data.iso3).maybeSingle();
    if (country.error) throw new Error('Country could not be retrieved');
    if (!id) return { country: country.data, series: [], forecasts: [], backtests: [] };
    const [series, forecasts, backtests] = await Promise.all([
      client.from('country_series').select('month,cases,mu,threshold,outbreak').eq('iso3', data.iso3).eq('disease_id', id).order('month', { ascending: false }).limit(72),
      client.from('latest_country_forecasts').select('*').eq('iso3', data.iso3).eq('disease_id', id).lte('horizon_months', 3).order('horizon_months'),
      client.from('country_backtests').select('target_month,outbreak_prob,outbreak_actual').eq('iso3', data.iso3).eq('disease_id', id).eq('horizon_months', 1).order('target_month').limit(1000),
    ]);
    if (series.error || forecasts.error || backtests.error) throw new Error('Country data could not be retrieved');
    const all = forecasts.data ?? [];
    const issue = all.reduce<string | null>((m, f) => f.issue_month && (!m || f.issue_month > m) ? f.issue_month : m, null);
    return { country: country.data, series: (series.data ?? []).reverse(), forecasts: all.filter(f => f.issue_month === issue), backtests: backtests.data ?? [] };
  });

/** Latest world-national model cut-off, for scoring backtests. */
export const getWorldModel = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string }) => ({ disease: validateContext(input).disease }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const id = await diseaseId(client, data.disease);
    if (!id) return null;
    const r = await client.from('model_runs').select('model_version,created_at,card').eq('disease_id', id).eq('scope', 'world-national').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (r.error) throw new Error('Model could not be retrieved');
    return r.data as { model_version: string; created_at: string | null; card: never } | null;
  });
