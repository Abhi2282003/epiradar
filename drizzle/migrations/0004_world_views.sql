CREATE VIEW public.latest_country_forecasts WITH (security_invoker = true) AS
  SELECT DISTINCT ON (iso3, disease_id, horizon_months) *
  FROM public.country_forecasts
  ORDER BY iso3, disease_id, horizon_months, issue_month DESC NULLS LAST, target_month DESC;
CREATE VIEW public.country_cases_12m WITH (security_invoker = true) AS
  WITH last AS (
    SELECT iso3, disease_id, max(month) AS last_month FROM public.country_series WHERE cases IS NOT NULL GROUP BY iso3, disease_id
  )
  SELECT s.iso3, s.disease_id, l.last_month,
    sum(s.cases) AS cases_12m, count(s.cases)::int AS months_reported
  FROM public.country_series s JOIN last l ON l.iso3 = s.iso3 AND l.disease_id = s.disease_id
  WHERE s.month > (l.last_month - interval '12 months') AND s.cases IS NOT NULL
  GROUP BY s.iso3, s.disease_id, l.last_month;
GRANT SELECT ON public.latest_country_forecasts, public.country_cases_12m TO anon, authenticated;
GRANT ALL ON public.latest_country_forecasts, public.country_cases_12m TO service_role;