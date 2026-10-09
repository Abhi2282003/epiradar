import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, Droplets, Hospital, ListChecks, Thermometer } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateContext } from '@/lib/epiradar';
import { formatNumber, formatProbability, riskLabel } from '@/lib/surveillance';
import { getLastSeason, getPredictionDrivers, getRegionForecast, getRegionSummary } from '@/lib/region.functions';
import { buildForecastSeries, estimatedAdmissions, RECOMMENDED_ACTIONS, seasonStats, type ChartPoint } from '@/lib/region';
import { RiskBadge, WeatherAgo } from './risk-workspace';
import { isClimateFamily } from '@/lib/trust';
import { getCasesClimate, getRegionWeather } from '@/lib/weather.functions';
import { weatherSentence, type WeatherDay } from '@/lib/weather';


const fmtDate = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="drawer-section"><h3>{icon}{title}</h3>{children}</section>;
}
function Unavailable({ children }: { children: React.ReactNode }) { return <p className="drawer-empty">{children}</p>; }

function Gauge({ value }: { value: number | null | undefined }) {
  const p = value == null ? 0 : Math.max(0, Math.min(1, value));
  const r = 52, c = Math.PI * r;
  return <svg viewBox="0 0 120 70" className="gauge" role="img" aria-label={`Outbreak probability ${formatProbability(value)}`}>
    <path d="M8 62 A52 52 0 0 1 112 62" className="gauge-track" />
    {value != null && <path d="M8 62 A52 52 0 0 1 112 62" className="gauge-value" strokeDasharray={`${c * p} ${c}`} />}
    <text x="60" y="58" textAnchor="middle" className="gauge-text">{formatProbability(value)}</text>
  </svg>;
}

function ForecastChart({ region, disease }: { region: string; disease: string }) {
  const [log, setLog] = useState(false);
  const q = useQuery({ queryKey: ['region-forecast', region, disease], queryFn: () => getRegionForecast({ data: { region, disease } }), staleTime: 60_000 });
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return <Unavailable>Forecast series could not be retrieved.</Unavailable>;
  const series = buildForecastSeries(q.data.observations, q.data.forecasts);
  if (!series.length) return <Unavailable>Reported cases and forecasts will appear here once observations and predictions are loaded for this municipality.</Unavailable>;
  const safe = (v: number | null | undefined) => v == null ? null : log ? (v > 0 ? v : null) : v;
  const data = series.map(p => ({ ...p, raw: p, cases: safe(p.cases), p50: safe(p.p50), threshold: safe(p.threshold), band: p.band && log ? (p.band[0] > 0 ? p.band : null) : p.band }));
  return <>
    <div className="chart-toggle" role="group" aria-label="Y-axis scale">
      <Button size="sm" variant={!log ? 'secondary' : 'ghost'} aria-pressed={!log} onClick={() => setLog(false)}>Linear</Button>
      <Button size="sm" variant={log ? 'secondary' : 'ghost'} aria-pressed={log} onClick={() => setLog(true)}>Log</Button>
    </div>
    <div className="h-64"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -8 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey="week" tickFormatter={shortDate} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} stroke="var(--border)" minTickGap={24} />
      <YAxis scale={log ? 'log' : 'linear'} domain={log ? [1, 'auto'] : [0, 'auto']} allowDataOverflow tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} stroke="var(--border)" tickFormatter={v => formatNumber(v)} />
      <Tooltip content={({ active, payload }) => {
        const p = (payload?.[0]?.payload as { raw?: ChartPoint } | undefined)?.raw;
        if (!active || !p) return null;
        return <div className="chart-tooltip"><strong>Week of {fmtDate(p.week)}</strong>
          {p.cases !== undefined && <p>Reported cases: {formatNumber(p.cases)}</p>}
          {p.p50 !== undefined && <p>Forecast P50: {formatNumber(p.p50)}</p>}
          {p.band !== undefined && <p>80% range: {p.band ? `${formatNumber(p.band[0])}–${formatNumber(p.band[1])}` : '—'}</p>}
          <p>Outbreak threshold: {formatNumber(p.threshold)}</p></div>;
      }} />
      <Area dataKey="band" stroke="none" fill="var(--primary)" fillOpacity={0.18} isAnimationActive={false} connectNulls />
      <Line dataKey="threshold" type="stepAfter" stroke="var(--risk-high)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
      <Line dataKey="cases" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
      <Line dataKey="p50" stroke="var(--primary)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} isAnimationActive={false} />
      {q.data.issueWeek && <ReferenceLine x={q.data.issueWeek} stroke="var(--muted-foreground)" strokeDasharray="3 3" label={{ value: 'Forecast issued', position: 'insideTopLeft', fill: 'var(--muted-foreground)', fontSize: 11 }} />}
    </ComposedChart></ResponsiveContainer></div>
    <p className="drawer-caption">Solid: reported cases · Dashed: forecast median with 80% band · Red step: outbreak threshold{log ? ' · Zero values are hidden on the log scale' : ''}</p>
  </>;
}

function Drivers({ prediction }: { prediction: string | null | undefined }) {
  const q = useQuery({ queryKey: ['drivers', prediction], queryFn: () => getPredictionDrivers({ data: { prediction: prediction! } }), enabled: !!prediction, staleTime: 300_000 });
  if (!prediction) return <Unavailable>Drivers will appear once a forecast is loaded for this horizon.</Unavailable>;
  if (q.isPending) return <Skeleton className="h-28" />;
  if (q.isError) return <Unavailable>Drivers could not be retrieved.</Unavailable>;
  if (!q.data.length) return <Unavailable>No driver contributions recorded for this forecast.</Unavailable>;
  const max = Math.max(...q.data.map(d => Math.abs(d.contribution ?? 0)), 1e-9);
  return <><ul className="driver-list">{q.data.map(d => {
    const v = d.contribution ?? 0; const width = `${(Math.abs(v) / max) * 50}%`;
    return <li key={d.rank}><div className="driver-text"><span>{d.label ?? 'Unnamed driver'}</span><small>{d.family ?? '—'}{isClimateFamily(d.family) && <span className="climate-tag">climate</span>}</small></div>
      <div className="driver-bar" aria-label={`${v >= 0 ? 'Raises' : 'Lowers'} risk by ${v.toFixed(3)}`}><span className={`${v >= 0 ? 'driver-up' : 'driver-down'} ${isClimateFamily(d.family) ? 'driver-climate' : ''}`} style={v >= 0 ? { left: '50%', width } : { right: '50%', width }} /></div>
      <span className="driver-value">{v >= 0 ? 'raises risk' : 'lowers risk'} · {v > 0 ? '+' : ''}{v.toFixed(3)}</span></li>;
  })}</ul><p className="drawer-caption">Contributions are SHAP values from the model. They explain the model's reasoning, not proven causes.</p></>;
}

type Weather = { current?: { temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number }; daily?: { time?: string[]; precipitation_sum?: (number | null)[] } };
function LiveWeather({ lat, lon }: { lat: number | null; lon: number | null }) {
  const q = useQuery({
    queryKey: ['weather', lat, lon], enabled: lat != null && lon != null, refetchInterval: 15 * 60_000, staleTime: 15 * 60_000,
    queryFn: async (): Promise<Weather> => {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation&daily=precipitation_sum,temperature_2m_max&forecast_days=7&timezone=auto`);
      if (!r.ok) throw new Error(`Weather request failed (${r.status})`);
      return r.json();
    },
  });
  if (lat == null || lon == null) return <Unavailable>Coordinates are missing for this municipality, so live weather is unavailable.</Unavailable>;
  if (q.isPending) return <Skeleton className="h-36" />;
  if (q.isError) return <Unavailable>Live weather could not be retrieved from Open-Meteo.</Unavailable>;
  const days = (q.data.daily?.time ?? []).map((t, i) => ({ day: t, rain: q.data.daily?.precipitation_sum?.[i] ?? null }));
  const c = q.data.current;
  const fmt = (v: number | undefined, unit: string) => v == null ? '—' : `${v.toFixed(1)}${unit}`;
  return <>
    <div className="weather-now"><div><Thermometer /><strong>{fmt(c?.temperature_2m, '°C')}</strong><span>Temperature</span></div><div><Droplets /><strong>{c?.relative_humidity_2m == null ? '—' : `${Math.round(c.relative_humidity_2m)}%`}</strong><span>Humidity</span></div><div><CloudRain /><strong>{fmt(c?.precipitation, ' mm')}</strong><span>Rain now</span></div></div>
    {days.length > 0 && <div className="h-24"><ResponsiveContainer width="100%" height="100%"><BarChart data={days} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
      <XAxis dataKey="day" tickFormatter={d => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" />
      <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" />
      <Tooltip formatter={(v: number) => [`${v} mm`, 'Rain']} labelFormatter={d => fmtDate(String(d))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
      <Bar dataKey="rain" fill="var(--primary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
    </BarChart></ResponsiveContainer></div>}
    <p className="drawer-caption">7-day rain forecast (mm) · Context only: model v1 does not use weather yet.</p>
  </>;
}

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 10 };
const one = (v: number | null | undefined, unit: string, d = 0) => v == null ? '—' : `${v.toFixed(d)}${unit}`;
function WeatherSection({ region }: { region: string }) {
  const q = useQuery({ queryKey: ['weather', 'region', region], queryFn: () => getRegionWeather({ data: { region } }), staleTime: 60_000 });
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return <Unavailable>Weather could not be retrieved.</Unavailable>;
  const w = q.data;
  if (!w) return <Unavailable>Daily weather will appear after the next Open-Meteo refresh for this municipality.</Unavailable>;
  const days = (Array.isArray(w.daily) ? w.daily : []) as WeatherDay[];
  const firstFc = days.find(d => d.forecast)?.date, lastDay = days[days.length - 1]?.date;
  const sentence = weatherSentence(w);
  return <>
    <div className="weather-stats">
      <div><span>Rain, last 7 days</span><strong>{one(w.rain_7d_mm, ' mm')}</strong></div>
      <div><span>Rain, next 16 days</span><strong>{one(w.fc_rain_16d_mm, ' mm')}</strong></div>
      <div><span>Mean temp, 7 days</span><strong>{one(w.tmean_7d, ' °C', 1)}</strong></div>
      <div><span>Suitability</span><strong>{w.tsuit_7d == null ? '—' : `${Math.round(w.tsuit_7d * 100)}% of peak`}</strong></div>
    </div>
    {sentence && <p className="drawer-narrative">{sentence}</p>}
    {days.length > 0 && <div className="h-56"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={days} margin={{ top: 16, right: 0, bottom: 0, left: -16 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      {firstFc && lastDay && <ReferenceArea x1={firstFc} x2={lastDay} yAxisId="rain" fill="var(--muted-foreground)" fillOpacity={0.12} label={{ value: 'Forecast', position: 'insideTop', fill: 'var(--muted-foreground)', fontSize: 11 }} />}
      <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} stroke="var(--border)" minTickGap={24} />
      <YAxis yAxisId="rain" tick={axisTick} stroke="var(--border)" />
      <YAxis yAxisId="temp" orientation="right" tick={axisTick} stroke="var(--border)" domain={['auto', 'auto']} unit="°" />
      <Tooltip content={({ active, payload }) => { const d = payload?.[0]?.payload as WeatherDay | undefined; if (!active || !d) return null; return <div className="chart-tooltip"><strong>{fmtDate(d.date)}{d.forecast ? ' · Forecast' : ''}</strong><p>Rain: {one(d.rain, ' mm', 1)}</p><p>Mean temp: {one(d.tmean, ' °C', 1)}</p><p>Max / min: {one(d.tmax, '°', 1)} / {one(d.tmin, '°', 1)}</p><p>Humidity: {one(d.rh, '%')}</p></div>; }} />
      <Bar yAxisId="rain" dataKey="rain" fill="var(--rain-3)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      <Line yAxisId="temp" dataKey="tmean" stroke="var(--risk-moderate)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
    </ComposedChart></ResponsiveContainer></div>}
    <p className="drawer-caption">Bars: daily rain (mm) · Line: mean temperature (°C) · Last 28 days and 16-day forecast · Open-Meteo · updated <WeatherAgo ts={w.updated_at} /></p>
  </>;
}
function CasesClimate({ region, disease }: { region: string; disease: string }) {
  const [temp, setTemp] = useState(false);
  const q = useQuery({ queryKey: ['cases-climate', region, disease], queryFn: () => getCasesClimate({ data: { region, disease } }), staleTime: 300_000 });
  if (!q.data || !q.data.some(r => r.rain_mm != null)) return null;
  const key = temp ? 'temp_mean' : 'rain_mm';
  return <Section title="Cases and climate">
    <div className="chart-toggle" role="group" aria-label="Climate variable">
      <Button size="sm" variant={!temp ? 'secondary' : 'ghost'} aria-pressed={!temp} onClick={() => setTemp(false)}>Rain</Button>
      <Button size="sm" variant={temp ? 'secondary' : 'ghost'} aria-pressed={temp} onClick={() => setTemp(true)}>Temperature</Button>
    </div>
    <div className="h-56"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={q.data} margin={{ top: 8, right: 0, bottom: 0, left: -16 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey="week_start" tickFormatter={shortDate} tick={axisTick} stroke="var(--border)" minTickGap={24} />
      <YAxis yAxisId="cases" tick={axisTick} stroke="var(--border)" tickFormatter={v => formatNumber(v)} />
      <YAxis yAxisId="climate" orientation="right" tick={axisTick} stroke="var(--border)" unit={temp ? '°' : ''} domain={['auto', 'auto']} />
      <Tooltip content={({ active, payload }) => { const d = payload?.[0]?.payload as { week_start: string; cases: number | null; rain_mm: number | null; temp_mean: number | null } | undefined; if (!active || !d) return null; return <div className="chart-tooltip"><strong>Week of {fmtDate(d.week_start)}</strong><p>Cases: {formatNumber(d.cases)}</p><p>Rain: {one(d.rain_mm, ' mm', 1)}</p><p>Mean temp: {one(d.temp_mean, ' °C', 1)}</p></div>; }} />
      <Bar yAxisId="cases" dataKey="cases" fill="var(--foreground)" fillOpacity={0.55} isAnimationActive={false} />
      <Line yAxisId="climate" dataKey={key} stroke={temp ? 'var(--risk-moderate)' : 'var(--rain-3)'} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
    </ComposedChart></ResponsiveContainer></div>
    <p className="drawer-caption">Last 52 weeks · Bars: weekly cases · Line: {temp ? 'mean temperature (°C)' : 'weekly rain (mm)'} · associations, not proof of cause</p>
  </Section>;
}

function HospitalLoad({ cases }: { cases: number | null | undefined }) {
  const [rate, setRate] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const admissions = estimatedAdmissions(cases, rate);
  return <>
    <div className="rate-chips" role="group" aria-label="Hospitalisation rate">{[2, 5, 10].map(r => <Button key={r} size="sm" variant={rate === r && !custom ? 'secondary' : 'outline'} aria-pressed={rate === r && !custom} onClick={() => { setCustom(''); setRate(r); }}>{r}%</Button>)}
      <Input className="rate-input" inputMode="decimal" aria-label="Custom hospitalisation rate (%)" placeholder="Custom %" value={custom} onChange={e => { setCustom(e.target.value); const n = Number(e.target.value); setRate(e.target.value && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null); }} /></div>
    <p className="hospital-value"><strong>{admissions == null ? '—' : formatNumber(admissions)}</strong> estimated admissions</p>
    <p className="drawer-caption">{cases == null ? 'Expected cases are unavailable for this horizon.' : rate == null ? 'Pick a rate to estimate admissions.' : `${formatNumber(cases)} expected cases × ${rate}%`} · assumption: use your local rate</p>
  </>;
}

function LastSeason({ region, disease }: { region: string; disease: string }) {
  const q = useQuery({ queryKey: ['last-season', region, disease], queryFn: () => getLastSeason({ data: { region, disease } }), staleTime: 300_000 });
  if (q.isPending) return <Skeleton className="h-16" />;
  if (q.isError) return <Unavailable>Season data could not be retrieved.</Unavailable>;
  const s = seasonStats(q.data);
  if (!s) return <Unavailable>2024 weekly observations will appear here once loaded.</Unavailable>;
  return <div className="season-stats"><div><span>Total 2024 cases</span><strong>{formatNumber(s.total)}</strong></div><div><span>Peak week</span><strong>{fmtDate(s.peakWeek)}</strong><small>{formatNumber(s.peakCases)} cases</small></div>
    {s.missing > 0 && <p className="drawer-caption">{s.missing} weeks without reported counts are excluded.</p>}</div>;
}

export function RegionDrawer() {
  const context = validateContext(useSearch({ strict: false }));
  const navigate = useNavigate();
  const region = context.region;
  const close = () => { void navigate({ to: '.', search: (prev: Record<string, unknown>) => { const next = validateContext(prev); delete next.region; return next; } } as never); };
  const summary = useQuery({ queryKey: ['region-summary', region, context.disease, context.horizon], queryFn: () => getRegionSummary({ data: { region: region!, disease: context.disease, horizon: context.horizon } }), enabled: !!region, staleTime: 30_000 });
  const r = summary.data?.region, p = summary.data?.prediction;
  const level = riskLabel(p?.risk_level);
  return <Sheet open={!!region} onOpenChange={open => { if (!open) close(); }}>
    <SheetContent side="right" className="region-drawer">
      {summary.isPending ? <><SheetTitle className="sr-only">Loading municipality</SheetTitle><SheetDescription className="sr-only">Loading</SheetDescription><Skeleton className="h-8 w-2/3" /><Skeleton className="mt-4 h-32" /><Skeleton className="mt-4 h-64" /></>
        : summary.isError || !r ? <><SheetTitle>Municipality unavailable</SheetTitle><SheetDescription>{summary.isError ? 'This municipality could not be retrieved. Please try again.' : 'No municipality matches this link.'}</SheetDescription></>
        : <>
          <header className="drawer-header"><span className="control-label">{context.disease.toUpperCase()} · {context.horizon}-WEEK FORECAST</span><SheetTitle className="drawer-title">{r.name}</SheetTitle>
            <SheetDescription>{[r.admin1, r.country].filter(Boolean).join(', ')} · Population {formatNumber(r.population)}</SheetDescription></header>
          <div className="drawer-risk"><Gauge value={p?.outbreak_prob} /><div className="drawer-risk-values"><RiskBadge level={p?.risk_level} />
            <div><span>Expected cases</span><strong>{formatNumber(p?.cases_p50)}</strong></div>
            <div><span>80% range</span><strong>{formatNumber(p?.cases_p10)}–{formatNumber(p?.cases_p90)}</strong></div>
            <div><span>Target week</span><strong className="font-mono">{fmtDate(p?.target_week)}</strong></div></div></div>
          {!p && <Unavailable>No forecast is loaded for {context.disease} at this horizon.</Unavailable>}
          {p?.narrative && <p className="drawer-narrative">{p.narrative}</p>}
          <Section title="Cases and forecast"><ForecastChart region={r.id} disease={context.disease} /></Section>
          <Section title="What drives this forecast"><Drivers prediction={p?.id} /></Section>
          <Section title="Recommended actions" icon={<ListChecks />}>{p && RECOMMENDED_ACTIONS[level] ? <><p className="drawer-action"><RiskBadge level={p.risk_level} />{RECOMMENDED_ACTIONS[level]}</p><p className="drawer-caption">Public-health operations guidance, not medical advice.</p></> : <Unavailable>Actions appear once a risk level is available.</Unavailable>}</Section>
          <Section title="Hospital load" icon={<Hospital />}><HospitalLoad cases={p?.cases_p50} /></Section>
          <Section title="Live weather · Open-Meteo" icon={<CloudRain />}><LiveWeather lat={r.lat} lon={r.lon} /></Section>
          <Section title="Weather" icon={<Thermometer />}><WeatherSection region={r.id} /></Section>
          <CasesClimate region={r.id} disease={context.disease} />
          <Section title="Last season"><LastSeason region={r.id} disease={context.disease} /></Section>
          <p className="drawer-caption">Data: OpenDengue V1.3 weekly cases · Forecast {p?.model_version ?? 'unavailable'}, issued for the week of {fmtDate(p?.issue_week)}</p>
        </>}
    </SheetContent>
  </Sheet>;
}
