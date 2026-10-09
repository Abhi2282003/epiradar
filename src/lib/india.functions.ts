import { createServerFn } from '@tanstack/react-start';
import { publicClient } from '@/lib/replay.functions';
import { isIndiaDisease, KARNATAKA } from '@/lib/india';

const INDIA_SOURCES = ['ncvbdc', 'datameet_boundaries', 'open_meteo_india', 'who_gho', 'icts_karnataka', 'epiclim_idsp', 'nasa_power_india', 'india_forecast'];

/** Everything /india needs: states, yearly burden (all three diseases), districts, district weather, IND monthly dengue. */
export const getIndiaOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const c = publicClient();
  const [states, burden, districts, weather, series, sources] = await Promise.all([
    c.from('india_states').select('id,name,name_hi,name_mr,population,area_km2,lat,lon').order('name'),
    c.from('admin1_burden').select('admin1,disease_id,year,cases,deaths,confirmed,tested,pf,population,incidence,source,note').eq('country_iso3', 'IND').in('disease_id', ['dengue', 'chikungunya', 'malaria']).order('year').limit(2000),
    c.from('india_districts').select('id,state_id,name,lat,lon,population').order('name').limit(1000),
    c.from('india_district_weather').select('*').limit(1000),
    c.from('country_series').select('month,cases').eq('iso3', 'IND').eq('disease_id', 'dengue').order('month').limit(1000),
    c.from('data_sources').select('id,name,status,last_success_at,note,cadence,rows_last_run').in('id', INDIA_SOURCES),
  ]);
  for (const r of [states, burden, districts, weather, series, sources]) if (r.error) throw new Error('India data could not be retrieved');
  return { states: states.data ?? [], burden: burden.data ?? [], districts: districts.data ?? [], weather: weather.data ?? [], series: series.data ?? [], sources: sources.data ?? [] };
});

/** TopoJSON for India's states (cached forever on the client). */
export const getIndiaTopo = createServerFn({ method: 'GET' }).handler(async () => {
  const r = await publicClient().from('geo_assets').select('topo,source,license,updated_at').eq('id', 'india-states-v1').maybeSingle();
  if (r.error) throw new Error('India boundaries could not be retrieved');
  if (!r.data) return null;
  return { topoJson: JSON.stringify(r.data.topo), source: r.data.source as string | null, license: r.data.license as string | null, updated_at: r.data.updated_at as string | null };
});

/** Karnataka ICTS weekly district history, paged past the 1,000-row default. */
export const getKarnatakaHistory = createServerFn({ method: 'GET' })
  .inputValidator((input: { state: string }) => { if (input.state !== KARNATAKA) throw new Error('Only Karnataka has district history'); return input; })
  .handler(async () => {
    const c = publicClient();
    const rows: { district_name: string; week_start: string; cases: number | null; deaths: number | null }[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      const r = await c.from('india_district_history').select('district_name,week_start,cases,deaths').order('week_start').order('district_name').range(from, from + 999);
      if (r.error) throw new Error('District history could not be retrieved');
      rows.push(...(r.data ?? []));
      if ((r.data ?? []).length < 1000) break;
    }
    return rows;
  });

/** WHO GHO values for one disease and year (choropleth) plus the years available. */
export const getWhoYear = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string; indicator: string; year: number | null }) => {
    if (!['malaria', 'cholera'].includes(input.disease)) throw new Error('Invalid disease');
    if (typeof input.indicator !== 'string' || !/^[a-z_]{2,30}$/.test(input.indicator)) throw new Error('Invalid indicator');
    return { disease: input.disease, indicator: input.indicator, year: Number.isInteger(input.year) ? input.year : null };
  })
  .handler(async ({ data }) => {
    const c = publicClient();
    const latest = await c.from('country_reported').select('year').eq('disease_id', data.disease).eq('indicator', data.indicator).order('year', { ascending: false }).limit(1).maybeSingle();
    const first = await c.from('country_reported').select('year').eq('disease_id', data.disease).eq('indicator', data.indicator).order('year').limit(1).maybeSingle();
    if (latest.error || first.error) throw new Error('WHO data could not be retrieved');
    const year = data.year ?? latest.data?.year ?? null;
    if (year == null) return { year: null, first: null, last: null, rows: [] };
    const r = await c.from('country_reported').select('iso3,value').eq('disease_id', data.disease).eq('indicator', data.indicator).eq('year', year).limit(400);
    if (r.error) throw new Error('WHO data could not be retrieved');
    return { year, first: first.data?.year ?? null, last: latest.data?.year ?? null, rows: r.data ?? [] };
  });

/** One country's WHO series for a disease. */
export const getCountryWho = createServerFn({ method: 'GET' })
  .inputValidator((input: { iso3: string; disease: string }) => {
    if (!/^[A-Z]{3}$/.test(input.iso3) || !['malaria', 'cholera'].includes(input.disease)) throw new Error('Invalid input');
    return input;
  })
  .handler(async ({ data }) => {
    const r = await publicClient().from('country_reported').select('year,indicator,value').eq('iso3', data.iso3).eq('disease_id', data.disease).order('year').limit(500);
    if (r.error) throw new Error('WHO data could not be retrieved');
    return r.data ?? [];
  });

export const isDisease = isIndiaDisease;
