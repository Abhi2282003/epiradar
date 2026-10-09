create table public.regions (
  id text primary key, country text not null, admin1 text, name text not null,
  official_code text, lat double precision, lon double precision,
  population integer, density real, rain_2050_pct int, temp_2050_c real
);
create table public.diseases (id text primary key, name text not null, vector text, color text);
create table public.observations (
  region_id text references public.regions(id) on delete cascade,
  disease_id text references public.diseases(id),
  week_start date, cases integer, cases_est real, incidence real, threshold_cases real,
  temp_mean real, rain_mm real, humidity real, ndvi real, soil_moisture real, river_discharge real,
  primary key (region_id, disease_id, week_start)
);
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  region_id text references public.regions(id) on delete cascade,
  disease_id text references public.diseases(id),
  issued_at timestamptz default now(), issue_week date, target_week date, horizon_weeks int,
  outbreak_prob real, risk_level text,
  cases_p10 real, cases_p50 real, cases_p90 real, threshold_cases real,
  narrative text, model_version text
);
create index on public.predictions (region_id, disease_id, horizon_weeks, issued_at desc);
create table public.drivers (
  prediction_id uuid references public.predictions(id) on delete cascade,
  rank int, family text, label text, contribution real,
  primary key (prediction_id, rank)
);
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  region_id text references public.regions(id) on delete cascade,
  disease_id text references public.diseases(id),
  level text, lead_weeks int, message text,
  status text default 'open', issued_at timestamptz default now()
);
create table public.scenarios (
  region_id text, disease_id text, rain_delta_pct int, temp_delta_c real,
  horizon_weeks int, outbreak_prob real,
  primary key (region_id, disease_id, rain_delta_pct, temp_delta_c, horizon_weeks)
);
create table public.backtests (
  region_id text references public.regions(id) on delete cascade,
  disease_id text references public.diseases(id),
  target_week date, horizon_weeks int,
  outbreak_prob real, outbreak_actual boolean, cases_actual int,
  cases_p10 real, cases_p50 real, cases_p90 real, threshold_cases real,
  primary key (region_id, disease_id, target_week, horizon_weeks)
);
create table public.model_runs (
  model_version text primary key, disease_id text,
  created_at timestamptz default now(), card jsonb
);
create table public.data_sources (
  id text primary key, name text, cadence text,
  last_success_at timestamptz, status text, rows_last_run int, note text
);
create table public.live_events (
  id bigint generated always as identity primary key,
  ts timestamptz default now(), kind text, severity text,
  region_id text, message text, payload jsonb
);
create view public.latest_predictions with (security_invoker = true) as
  select distinct on (region_id, disease_id, horizon_weeks) *
  from public.predictions
  order by region_id, disease_id, horizon_weeks, issued_at desc;

do $$
declare t text;
begin
  foreach t in array array['regions','diseases','observations','predictions','drivers','alerts','scenarios','backtests','model_runs','data_sources','live_events'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Public read" on public.%I for select using (true)', t);
  end loop;
end $$;
grant select on public.latest_predictions to anon, authenticated, service_role;

grant update (status) on public.alerts to authenticated;
create policy "Signed-in users update alert status" on public.alerts
  for update to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.predictions, public.alerts, public.live_events, public.data_sources;

insert into public.diseases (id, name, vector, color) values
  ('dengue','Dengue','Aedes aegypti','#2DD4BF'),
  ('chikungunya','Chikungunya','Aedes aegypti',null),
  ('zika','Zika','Aedes aegypti',null),
  ('malaria','Malaria','Anopheles',null),
  ('lepto','Leptospirosis','none',null),
  ('add','Diarrhoeal disease','none',null);