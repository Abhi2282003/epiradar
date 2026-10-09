import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, History, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { validateContext } from '@/lib/epiradar';
import { indiaDistrictQuery } from '@/lib/india-query';
import { DISEASE_FC_KEY, FC_DISEASES, asInputs, climateEffectPp, isDriverList, isTier, monthLabel, pctText, timesUsual, type FcDisease } from '@/lib/india-forecast';
import { formatIN, stateName, useT } from '@/lib/i18n';
import { DataBadge } from './i18n-ui';
import { DriverLine, Precautions, TierBadge, useForecastContext } from './india-forecast';

const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
const tip = { contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 } };
type DistrictMeta = { id: string; state_id: string; name: string; population: number | null };
type StateMeta = { id: string; name: string; name_hi?: string | null; name_mr?: string | null };
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;

export function IndiaDistrictDrawer({ districts, states }: { districts: DistrictMeta[]; states: StateMeta[] }) {
  const t = useT();
  const navigate = useNavigate();
  const { context, disease, horizon } = useForecastContext();
  const id = context.district;
  const d = districts.find(x => x.id === id);
  const s = d ? states.find(x => x.id === d.state_id) : undefined;
  const q = useQuery({ ...indiaDistrictQuery(id ?? 'IN-D0'), enabled: !!id });
  const setSearch = (patch: Record<string, unknown>) => void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...validateContext(prev), ...patch }) } as never);
  const close = () => void navigate({ to: '.', search: (prev: Record<string, unknown>) => { const { district: _d, ...rest } = validateContext(prev); return rest; } } as never);
  const fc = q.data?.forecasts ?? [];
  const sel = fc.find(r => r.disease_id === disease && r.horizon === horizon);
  const month = sel?.target_month ?? fc.find(r => r.horizon === horizon)?.target_month ?? null;
  const inp = asInputs(sel?.inputs);
  const inputs = sel ? inp : null;
  const drivers = isDriverList(sel?.drivers) ? sel!.drivers : [];
  const hist = useMemo(() => {
    const rows = (q.data?.outbreaks ?? []).filter(o => o.disease_id === disease);
    const years = new Map<number, number>(); const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, n: 0 }));
    for (const o of rows) { const y = Number(o.month.slice(0, 4)); years.set(y, (years.get(y) ?? 0) + o.outbreaks); months[Number(o.month.slice(5, 7)) - 1]!.n += o.outbreaks; }
    const yearRows = Array.from({ length: 14 }, (_, i) => ({ y: 2009 + i, n: years.get(2009 + i) ?? 0 }));
    return { total: rows.reduce((a, o) => a + o.outbreaks, 0), cases: rows.reduce((a, o) => a + (o.cases ?? 0), 0), yearRows, months };
  }, [q.data, disease]);
  const x = timesUsual(sel?.prob, sel?.typical_prob);
  const pp = climateEffectPp(sel?.prob, sel?.prob_no_climate);
  const rain3 = num(inp.r3), rainPct = num(inp.rp), tLast = num(inp.t);
  const tAnom = num(inp.ta), rh = num(inp.rh), aed = num(inp.ae), ano = num(inp.an);
  const nRain = num(inp.nr), nT = num(inp.nt);
  const monthNames = t.lang === 'en' ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] : Array.from({ length: 12 }, (_, i) => String(i + 1));

  return <Sheet open={!!id} onOpenChange={o => { if (!o) close(); }}>
    <SheetContent side="right" className="region-drawer">
      {!d ? <><SheetTitle>{t('dd.title')}</SheetTitle><SheetDescription>{t('dd.unknown')}</SheetDescription></> : <>
        <header className="drawer-header"><span className="control-label">{t('dd.title').toUpperCase()} · {stateName(s, t.lang)}</span><SheetTitle className="drawer-title">{d.name}</SheetTitle>
          <SheetDescription>{t('term.population')} {formatIN(d.population)} · {monthLabel(month, t.lang)}</SheetDescription></header>
        {q.isPending ? <Skeleton className="h-64" /> : q.isError ? <p className="drawer-empty">{t('common.error')}</p> : !fc.length ? <p className="drawer-empty">{t('fcx.none')}</p> : <>
          <section className="drawer-section"><div className="panel-title-row"><h3><Sparkles />{t('dd.allDiseases', { month: monthLabel(month, t.lang) })}</h3><DataBadge kind="forecast" /></div>
            <ul className="dd-disease-grid">{FC_DISEASES.map(dis => { const r = fc.find(f => f.disease_id === dis && f.horizon === horizon); return <li key={dis}><button type="button" aria-pressed={dis === disease} onClick={() => setSearch({ fd: dis })}>
              <span>{t(DISEASE_FC_KEY[dis as FcDisease])}</span><TierBadge tier={r?.risk_level} /><b className="tabular-nums">{pctText(r?.prob)}</b></button></li>; })}</ul></section>
          {sel && <section className="drawer-section"><h3><ShieldAlert />{t(DISEASE_FC_KEY[disease])} · {monthLabel(month, t.lang)}</h3>
            <dl className="mini-stats">
              <div><dt>{t('dd.withClimate')}</dt><dd>{pctText(sel.prob, 1)}</dd></div>
              <div><dt>{t('dd.withoutClimate')}</dt><dd>{pctText(sel.prob_no_climate, 1)}</dd></div>
              <div><dt>{t('dd.usual')}</dt><dd>{pctText(sel.typical_prob, 1)}</dd></div>
            </dl>
            <p className="sub mt-2">{isTier(sel.risk_level) && <TierBadge tier={sel.risk_level} />} {x == null ? t('fcx.noUsual') : t('fcx.vsUsual', { x: x >= 10 ? Math.round(x) : x.toFixed(1) })}{pp != null && Math.abs(pp) >= 0.5 ? ` · ${pp > 0 ? t('fcx.climateUp', { pp: pp.toFixed(1) }) : t('fcx.climateDown', { pp: Math.abs(pp).toFixed(1) })}` : ''}{sel.rank_india ? ` · ${t('dd.rank', { r: sel.rank_india, n: formatIN(districts.length) })}` : ''}</p>
            {drivers.length > 0 && <><h4 className="dd-h4">{t('dd.drivers')}</h4><ul className="fc-drivers">{drivers.map((dr, i) => <DriverLine key={i} d={dr} inputs={inp} />)}</ul><p className="fc-note mt-1">{t('dd.driversNote')}</p></>}
          </section>}
          {inputs && <section className="drawer-section"><h3><CloudRain />{t('dd.inputs')}</h3><dl className="mini-stats">
            <div><dt>{t('dd.rain3m')}</dt><dd>{rain3 == null ? '—' : `${formatIN(rain3)} mm`}{rainPct != null && <small className="block text-muted-foreground">{t('dd.vsNormal', { x: `${rainPct > 0 ? '+' : ''}${Math.round(rainPct)}` })}</small>}</dd></div>
            <div><dt>{t('dd.temp')}</dt><dd>{tLast == null ? '—' : `${tLast.toFixed(1)} °C`}</dd></div>
            <div><dt>{t('dd.tempAnom')}</dt><dd>{tAnom == null ? '—' : `${tAnom > 0 ? '+' : ''}${tAnom.toFixed(1)} °C`}</dd></div>
            <div><dt>{t('dd.rh')}</dt><dd>{rh == null ? '—' : `${Math.round(rh)}%`}</dd></div>
            <div><dt>{t('drawer.aedes')}</dt><dd>{aed == null ? '—' : aed.toFixed(2)}</dd></div>
            <div><dt>{t('drawer.anopheles')}</dt><dd>{ano == null ? '—' : ano.toFixed(2)}</dd></div>
            <div><dt>{t('dd.normal', { month: monthLabel(month, t.lang) })}</dt><dd>{nRain == null ? '—' : `${formatIN(nRain)} mm`} · {nT == null ? '—' : `${nT.toFixed(1)} °C`}</dd></div>
          </dl><p className="fc-note mt-1">NASA POWER · {monthLabel(q.data?.issue_month, t.lang)}</p></section>}
          <section className="drawer-section"><h3><ShieldCheck />{t('fcx.precautions')}</h3><Precautions disease={disease} tier={isTier(sel?.risk_level) ? sel!.risk_level : null} /></section>
          <section className="drawer-section"><div className="panel-title-row"><h3><History />{t('dd.history')}</h3><DataBadge kind="reported" /></div>
            {hist.total ? <>
              <p className="sub">{t('dd.outbreaks')}: {formatIN(hist.total)} · {t('term.cases')}: {formatIN(hist.cases)}</p>
              <div className="dd-charts"><div><p className="control-label">{t('dd.byYear')}</p><div className="h-36"><ResponsiveContainer><BarChart data={hist.yearRows} margin={{ left: -24, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="y" {...axis} tickFormatter={y => `'${String(y).slice(2)}`} interval={1} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} formatter={v => [v, t('dd.outbreaks')]} /><Bar dataKey="n" fill="var(--primary)" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>
                <div><p className="control-label">{t('dd.byMonth')}</p><div className="h-36"><ResponsiveContainer><BarChart data={hist.months} margin={{ left: -24, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="m" {...axis} tickFormatter={m => monthNames[Number(m) - 1] ?? ''} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} labelFormatter={m => monthLabel(`2000-${String(m).padStart(2, '0')}`, t.lang).replace(' 2000', '')} formatter={v => [v, t('dd.outbreaks')]} /><Bar dataKey="n" fill="var(--rain-3)" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div></div>
              <p className="fc-note mt-1">IDSP weekly outbreak reports via EpiClim (2009–2022)</p></> : <p className="drawer-empty">{t('dd.noHistory')}</p>}
          </section>
        </>}
      </>}
    </SheetContent>
  </Sheet>;
}
