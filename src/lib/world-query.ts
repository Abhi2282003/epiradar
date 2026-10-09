import { queryOptions } from '@tanstack/react-query';
import type { Topology } from 'topojson-specification';
import { getCountryDetail, getWorldModel, getWorldOverview } from '@/lib/world.functions';

const TEN_MIN = 10 * 60_000;
export const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
export const worldOverviewQuery = (disease: string) => queryOptions({ queryKey: ['world', 'overview', disease], queryFn: () => getWorldOverview({ data: { disease } }), staleTime: TEN_MIN, refetchInterval: TEN_MIN });
export const countryDetailQuery = (iso3: string, disease: string) => queryOptions({ queryKey: ['world', 'country', iso3, disease], queryFn: () => getCountryDetail({ data: { iso3, disease } }), staleTime: TEN_MIN });
export const worldModelQuery = (disease: string) => queryOptions({ queryKey: ['world', 'model', disease], queryFn: () => getWorldModel({ data: { disease } }), staleTime: TEN_MIN });
export const worldTopoQuery = queryOptions({
  queryKey: ['world-topo'], staleTime: Infinity, gcTime: Infinity,
  queryFn: async () => { const r = await fetch(TOPO_URL); if (!r.ok) throw new Error(`Country boundaries HTTP ${r.status}`); return await r.json() as Topology; },
});
