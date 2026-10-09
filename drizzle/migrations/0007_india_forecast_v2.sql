ALTER TABLE public.india_forecasts ADD COLUMN IF NOT EXISTS prob_climate_only real, ADD COLUMN IF NOT EXISTS silent boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS scenarios jsonb;
CREATE TABLE IF NOT EXISTS public.india_mobility (district_id text NOT NULL REFERENCES public.india_districts(id) ON DELETE CASCADE, to_district_id text NOT NULL REFERENCES public.india_districts(id) ON DELETE CASCADE, rank smallint NOT NULL, share real NOT NULL, distance_km real NOT NULL, PRIMARY KEY (district_id, to_district_id));
CREATE INDEX IF NOT EXISTS india_mobility_rank_idx ON public.india_mobility (district_id, rank);
GRANT SELECT ON public.india_mobility TO anon, authenticated;
GRANT ALL ON public.india_mobility TO service_role;
ALTER TABLE public.india_mobility ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.india_mobility;
CREATE POLICY "Public read" ON public.india_mobility FOR SELECT USING (true);
