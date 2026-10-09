import { queryOptions } from '@tanstack/react-query';
import { getSurveillance } from '@/lib/surveillance.functions';

export const surveillanceQuery = (disease: string, horizon: number) => queryOptions({
  queryKey: ['surveillance', disease, horizon],
  queryFn: () => getSurveillance({ data: { disease, horizon } }),
  staleTime: 15_000,
  refetchInterval: 30_000,
});