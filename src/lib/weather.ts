// Browser-safe weather helpers shared by the refresh route, the map layer and the drawer.

/** Temperature suitability for Aedes-borne transmission; must match the model pipeline exactly. */
export function tempSuitability(t: number | null | undefined): number | null {
  if (t == null || !Number.isFinite(t)) return null;
  if (t < 17 || t > 35) return 0;
  const width = t < 29 ? 6 : 3;
  return Math.exp(-(((t - 29) / width) ** 2));
}

export type WeatherDay = { date: string; rain: number | null; tmean: number | null; tmax: number | null; tmin: number | null; rh: number | null; forecast: boolean };
export type OpenMeteoDaily = {
  time?: string[];
  temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[]; temperature_2m_mean?: (number | null)[];
  precipitation_sum?: (number | null)[]; relative_humidity_2m_mean?: (number | null)[];
};
export type WeatherAggregate = {
  rain_7d_mm: number | null; rain_28d_mm: number | null; tmean_7d: number | null; tmax_7d: number | null; rh_7d: number | null; tsuit_7d: number | null;
  fc_rain_16d_mm: number | null; fc_tmean_16d: number | null; fc_tsuit_16d: number | null; daily: WeatherDay[];
};

const known = (values: (number | null)[]) => values.filter((v): v is number => v != null && Number.isFinite(v));
const sum = (values: (number | null)[]) => { const k = known(values); return k.length ? k.reduce((a, b) => a + b, 0) : null; };
const mean = (values: (number | null)[]) => { const k = known(values); return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null; };
const round = (v: number | null, digits = 2) => v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits;

/** Today's date (YYYY-MM-DD) in the given time zone. */
export function localDate(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Days before `today` are observed; today and later count as forecast. */
export function aggregateWeather(daily: OpenMeteoDaily, today: string): WeatherAggregate {
  const days: WeatherDay[] = (daily.time ?? []).map((date, i) => ({
    date, forecast: date >= today,
    rain: daily.precipitation_sum?.[i] ?? null, tmean: daily.temperature_2m_mean?.[i] ?? null,
    tmax: daily.temperature_2m_max?.[i] ?? null, tmin: daily.temperature_2m_min?.[i] ?? null, rh: daily.relative_humidity_2m_mean?.[i] ?? null,
  }));
  const past = days.filter(d => !d.forecast);
  const last7 = past.slice(-7), last28 = past.slice(-28);
  const future = days.filter(d => d.forecast).slice(0, 16);
  const tmean7 = mean(last7.map(d => d.tmean));
  const fcTmean = mean(future.map(d => d.tmean));
  return {
    rain_7d_mm: round(sum(last7.map(d => d.rain)), 1), rain_28d_mm: round(sum(last28.map(d => d.rain)), 1),
    tmean_7d: round(tmean7), tmax_7d: round(mean(last7.map(d => d.tmax))), rh_7d: round(mean(last7.map(d => d.rh)), 1),
    tsuit_7d: round(tempSuitability(tmean7), 4),
    fc_rain_16d_mm: round(sum(future.map(d => d.rain)), 1), fc_tmean_16d: round(fcTmean), fc_tsuit_16d: round(tempSuitability(fcTmean), 4),
    daily: days,
  };
}

/** Plain-language reading: suitability >= 0.7 is favourable; more than 100 mm in 28 days is wet. */
export function weatherSentence(w: { tsuit_7d: number | null; fc_tsuit_16d: number | null; rain_28d_mm: number | null }) {
  const suit = w.fc_tsuit_16d ?? w.tsuit_7d;
  if (suit == null && w.rain_28d_mm == null) return null;
  const warm = suit != null && suit >= 0.7;
  const wet = w.rain_28d_mm != null && w.rain_28d_mm > 100;
  if (warm && wet) return 'Warm and wet: conditions favour Aedes mosquitoes over the next two weeks.';
  if (warm) return 'Warm but fairly dry: temperatures favour Aedes mosquitoes, though recent rain is limited.';
  if (wet) return 'Wet but cooler: recent rain adds breeding sites, but temperatures are below the transmission optimum.';
  return 'Cooler and drier: conditions are less favourable for Aedes mosquitoes over the next two weeks.';
}

export type WeatherLayer = 'risk' | 'rain7' | 'rain16' | 'suit';
export const WEATHER_LAYERS: { id: WeatherLayer; label: string; unit: string; stops: number[] }[] = [
  { id: 'risk', label: 'Outbreak risk', unit: '', stops: [] },
  { id: 'rain7', label: 'Rain, last 7 days', unit: 'mm', stops: [0, 10, 25, 50, 100] },
  { id: 'rain16', label: 'Rain, next 16 days', unit: 'mm', stops: [0, 25, 50, 100, 200] },
  { id: 'suit', label: 'Transmission suitability', unit: '% of peak', stops: [0, 0.2, 0.4, 0.6, 0.8] },
];
export function layerValue(layer: WeatherLayer, w: { rain_7d_mm: number | null; fc_rain_16d_mm: number | null; tsuit_7d: number | null } | undefined) {
  if (!w) return null;
  return layer === 'rain7' ? w.rain_7d_mm : layer === 'rain16' ? w.fc_rain_16d_mm : layer === 'suit' ? w.tsuit_7d : null;
}
/** Index into the 5-step sequential scale, or -1 for no data. */
export function layerBin(layer: WeatherLayer, value: number | null) {
  if (value == null) return -1;
  const stops = WEATHER_LAYERS.find(l => l.id === layer)?.stops ?? [];
  let bin = 0;
  stops.forEach((s, i) => { if (value >= s) bin = i; });
  return bin;
}
export function formatLayerValue(layer: WeatherLayer, value: number | null) {
  if (value == null) return 'No data';
  return layer === 'suit' ? `${Math.round(value * 100)}% of peak` : `${Math.round(value)} mm`;
}
