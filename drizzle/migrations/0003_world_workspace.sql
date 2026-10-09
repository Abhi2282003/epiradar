CREATE TABLE public.countries (
  iso3 text PRIMARY KEY, iso_num text, name text, region text, subregion text,
  lat double precision, lon double precision, area_km2 real, population bigint,
  dengue_resolution text, dengue_first date, dengue_last date, has_forecast boolean DEFAULT false
);
CREATE INDEX countries_iso_num_idx ON public.countries (iso_num);
CREATE TABLE public.country_series (
  iso3 text NOT NULL, disease_id text NOT NULL, month date NOT NULL,
  cases real, mu real, threshold real, outbreak boolean,
  PRIMARY KEY (iso3, disease_id, month)
);
CREATE TABLE public.country_forecasts (
  iso3 text NOT NULL, disease_id text NOT NULL, issue_month date, target_month date NOT NULL, horizon_months int NOT NULL,
  outbreak_prob real, risk_level text, cases_p10 real, cases_p50 real, cases_p90 real, threshold real,
  drivers jsonb, narrative text, model_version text,
  PRIMARY KEY (iso3, disease_id, target_month, horizon_months)
);
CREATE INDEX country_forecasts_issue_idx ON public.country_forecasts (disease_id, horizon_months, issue_month DESC);
CREATE TABLE public.country_backtests (
  iso3 text NOT NULL, disease_id text NOT NULL, target_month date NOT NULL, horizon_months int NOT NULL,
  outbreak_prob real, outbreak_actual boolean, cases_actual real,
  PRIMARY KEY (iso3, disease_id, target_month, horizon_months)
);
CREATE TABLE public.world_weather_grid (
  lat real NOT NULL, lon real NOT NULL, updated_at timestamptz DEFAULT now(),
  temp_c real, rh real, precip_mm real, cloud_cover real, wind_speed real, wind_dir real,
  PRIMARY KEY (lat, lon)
);
CREATE TABLE public.admin1_burden (
  country_iso3 text NOT NULL, admin1 text NOT NULL, disease_id text NOT NULL, year int NOT NULL,
  cases real, population bigint, incidence real, source text, note text,
  PRIMARY KEY (country_iso3, admin1, disease_id, year)
);
GRANT SELECT ON public.countries, public.country_series, public.country_forecasts, public.country_backtests, public.world_weather_grid, public.admin1_burden TO anon, authenticated;
GRANT ALL ON public.countries, public.country_series, public.country_forecasts, public.country_backtests, public.world_weather_grid, public.admin1_burden TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_weather_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin1_burden ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.countries FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.country_series FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.country_forecasts FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.country_backtests FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.world_weather_grid FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.admin1_burden FOR SELECT USING (true);
ALTER TABLE public.model_runs ADD COLUMN scope text DEFAULT 'brazil-municipal';
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_weather_grid;