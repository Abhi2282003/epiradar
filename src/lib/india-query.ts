import { queryOptions } from '@tanstack/react-query';
import type { Topology } from 'topojson-specification';
import { getCountryWho, getIndiaOverview, getIndiaTopo, getKarnatakaHistory, getWhoYear } from '@/lib/india.functions';
import { getIndiaDistrict, getIndiaForecast, getIndiaMobility, getIndiaModelCard, getIndiaSummary } from '@/lib/india-forecast.functions';

const TEN_MIN = 10 * 60_000;
export const indiaOverviewQuery = queryOptions({ queryKey: ['india', 'overview'], queryFn: () => getIndiaOverview(), staleTime: TEN_MIN, refetchInterval: TEN_MIN });
export const indiaTopoQuery = queryOptions({
  queryKey: ['india-topo'], staleTime: Infinity, gcTime: Infinity,
  queryFn: async () => { const r = await getIndiaTopo(); const topo = r?.topoJson ? JSON.parse(r.topoJson) as unknown : null; return r && topo && typeof topo === 'object' ? { topo: topo as Topology, source: r.source, license: r.license } : null; },
});
export const karnatakaHistoryQuery = queryOptions({ queryKey: ['india', 'ka-history'], queryFn: () => getKarnatakaHistory({ data: { state: 'IN-KA' } }), staleTime: Infinity });
export const whoYearQuery = (disease: string, indicator: string, year: number | null) => queryOptions({ queryKey: ['world', 'who', disease, indicator, year], queryFn: () => getWhoYear({ data: { disease, indicator, year } }), staleTime: TEN_MIN });
export const countryWhoQuery = (iso3: string, disease: string) => queryOptions({ queryKey: ['world', 'who-country', iso3, disease], queryFn: () => getCountryWho({ data: { iso3, disease } }), staleTime: TEN_MIN });

export const indiaForecastQuery = (disease: string, horizon: number) => queryOptions({ queryKey: ['india', 'forecast', disease, horizon], queryFn: () => getIndiaForecast({ data: { disease, horizon } }), staleTime: TEN_MIN });
export const indiaDistrictQuery = (district: string) => queryOptions({ queryKey: ['india', 'district', district], queryFn: () => getIndiaDistrict({ data: { district } }), staleTime: TEN_MIN });
export const indiaModelCardQuery = queryOptions({
  queryKey: ['india', 'model-card'], staleTime: TEN_MIN,
  queryFn: async () => { const r = await getIndiaModelCard(); if (!r) return null; const card = JSON.parse(r.cardJson) as unknown; return { model_version: r.model_version, created_at: r.created_at, card: card && typeof card === 'object' ? card as Record<string, unknown> : null }; },
});
export const indiaSummaryQuery = (horizon: number) => queryOptions({ queryKey: ['india', 'summary', horizon], queryFn: () => getIndiaSummary({ data: { horizon } }), staleTime: TEN_MIN });
export const indiaMobilityQuery = queryOptions({ queryKey: ['india', 'mobility'], queryFn: () => getIndiaMobility(), staleTime: Infinity });
