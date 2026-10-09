import { queryOptions } from '@tanstack/react-query';
import type { Topology } from 'topojson-specification';
import { getCountryWho, getIndiaOverview, getIndiaTopo, getKarnatakaHistory, getWhoYear } from '@/lib/india.functions';

const TEN_MIN = 10 * 60_000;
export const indiaOverviewQuery = queryOptions({ queryKey: ['india', 'overview'], queryFn: () => getIndiaOverview(), staleTime: TEN_MIN, refetchInterval: TEN_MIN });
export const indiaTopoQuery = queryOptions({
  queryKey: ['india-topo'], staleTime: Infinity, gcTime: Infinity,
  queryFn: async () => { const r = await getIndiaTopo(); const topo = r?.topoJson ? JSON.parse(r.topoJson) as unknown : null; return r && topo && typeof topo === 'object' ? { topo: topo as Topology, source: r.source, license: r.license } : null; },
});
export const karnatakaHistoryQuery = queryOptions({ queryKey: ['india', 'ka-history'], queryFn: () => getKarnatakaHistory({ data: { state: 'IN-KA' } }), staleTime: Infinity });
export const whoYearQuery = (disease: string, indicator: string, year: number | null) => queryOptions({ queryKey: ['world', 'who', disease, indicator, year], queryFn: () => getWhoYear({ data: { disease, indicator, year } }), staleTime: TEN_MIN });
export const countryWhoQuery = (iso3: string, disease: string) => queryOptions({ queryKey: ['world', 'who-country', iso3, disease], queryFn: () => getCountryWho({ data: { iso3, disease } }), staleTime: TEN_MIN });
