import { queryOptions } from '@tanstack/react-query';
import type { FeatureCollection, Geometry } from 'geojson';

export type Boundaries = FeatureCollection<Geometry, { id: string | number; name?: string; [key: string]: unknown }>;
export const boundariesQuery = queryOptions({
  queryKey: ['rio-municipality-boundaries'],
  queryFn: async (): Promise<Boundaries> => {
    const response = await fetch('https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-33-mun.json');
    if (!response.ok) throw new Error('Municipality boundaries could not be loaded.');
    return response.json();
  },
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  retry: 1,
});