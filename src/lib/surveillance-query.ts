import { getTrust, getOpenAlerts } from '@/lib/trust.functions';
import { queryOptions } from '@tanstack/react-query';
import { getSurveillance } from '@/lib/surveillance.functions';

export const surveillanceQuery = (disease: string, horizon: number) => queryOptions({
  queryKey: ['surveillance', disease, horizon],
  queryFn: () => getSurveillance({ data: { disease, horizon } }),
  staleTime: 15_000,
  refetchInterval: 30_000,
});
export const trustQuery = (disease: string) => queryOptions({ queryKey: ['trust', disease], queryFn: () => getTrust({ data: { disease } }), staleTime: 60_000 });
export const openAlertsQuery = (disease: string) => queryOptions({ queryKey: ['open-alerts', disease], queryFn: () => getOpenAlerts({ data: { disease } }), staleTime: 15_000, refetchInterval: 30_000 });
