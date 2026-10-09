CREATE TABLE public.weather_now (
  region_id text PRIMARY KEY REFERENCES public.regions(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  rain_7d_mm real, rain_28d_mm real,
  tmean_7d real, tmax_7d real, rh_7d real,
  tsuit_7d real CHECK (tsuit_7d IS NULL OR (tsuit_7d >= 0 AND tsuit_7d <= 1)),
  fc_rain_16d_mm real, fc_tmean_16d real,
  fc_tsuit_16d real CHECK (fc_tsuit_16d IS NULL OR (fc_tsuit_16d >= 0 AND fc_tsuit_16d <= 1)),
  daily jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.weather_now TO anon, authenticated;
GRANT ALL ON public.weather_now TO service_role;
ALTER TABLE public.weather_now ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.weather_now FOR SELECT USING (true);
ALTER TABLE public.weather_now REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weather_now;