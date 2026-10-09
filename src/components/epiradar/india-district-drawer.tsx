import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, Copy, Eye, FlaskConical, History, Printer, Route, Send, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { validateContext } from '@/lib/epiradar';
import { indiaDistrictQuery, indiaModelCardQuery } from '@/lib/india-query';
import {
  DISEASE_FC_KEY, FC_DISEASES, TIER_KEY, WEEKS_OF, WHATIF_RAIN, WHATIF_TEMP, asInputs, climateEffectPp, dayLabel, driverSentence, isDriverList,
  isScenarios, isTier, pctText, tierIndex, tierOf, timesUsual, windowLabel, windowStart, type FcDisease, type Tier,
} from '@/lib/india-forecast';
import { PRECAUTIONS, TIER_ACTION, pick } from '@/lib/precautions';
import { formatIN, stateName, useT } from '@/lib/i18n';
import { DataBadge } from './i18n-ui';
import { DriverLine, Precautions, TierBadge, tierStats, useForecastContext } from './india-forecast';

const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
const tip = { contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 } };
type DistrictMeta = { id: string; state_id: string; name: string; population: number | null };
type StateMeta = { id: string; name: string; name_hi?: string | null; name_mr?: string | null };
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const APP_URL = 'https://epiradar.lovable.app';

export function IndiaDistrictDrawer({ districts, states }: { districts: DistrictMeta[]; states: StateMeta[] }) {
  const t = useT();
  const navigate = useNavigate();
  const { context, disease, horizon } = useForecastContext();
  const id = context.district;
  const d = districts.find(x => x.id === id);
  const s = d ? states.find(x => x.id === d.state_id) : undefined;
  const q = useQuery({ ...indiaDistrictQuery(id ?? 'IN-D0'), enabled: !!id });
  const card = useQuery(indiaModelCardQuery);
  const [copied, setCopied] = useState(false);
  const setSearch = (patch: Record<string, unknown>) => void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...validateContext(prev), ...patch }) } as never);
  const close = () => void navigate({ to: '.', search: (prev: Record<string, unknown>) => { const { district: _d, ...rest } = validateContext(prev); return rest; } } as never);
  const fc = q.data?.forecasts ?? [];
  const issue = q.data?.issue_month ?? null;
  const sel = fc.find(r => r.disease_id === disease && r.horizon === horizon);
  const win = issue ? windowLabel(windowStart(issue, horizon), t.lang) : '—';
  const inp = asInputs(sel?.inputs);
  const drivers = isDriverList(sel?.drivers) ? sel!.drivers : [];
  const stats = tierStats(card.data?.card, disease, horizon);
  const byName = useMemo(() => new Map(districts.map(x => [x.id, x])), [districts]);
  const hist = useMemo(() => {
    const rows = (q.data?.outbreaks ?? []).filter(o => o.disease_id === disease);
    const years = new Map<number, number>(); const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, n: 0 }));
    for (const o of rows) { const y = Number(o.month.slice(0, 4)); years.set(y, (years.get(y) ?? 0) + o.outbreaks); months[Number(o.month.slice(5, 7)) - 1]!.n += o.outbreaks; }
    const yearRows = Array.from({ length: 14 }, (_, i) => ({ y: 2009 + i, n: years.get(2009 + i) ?? 0 }));
    return { total: rows.reduce((a, o) => a + o.outbreaks, 0), cases: rows.reduce((a, o) => a + (o.cases ?? 0), 0), yearRows, months };
  }, [q.data, disease]);
  const links = (q.data?.links ?? []).slice(0, 6);
  const linkRisk = q.data?.linkRisk ?? [];
  const riskOf = (did: string) => linkRisk.find(r => r.district_id === did && r.disease_id === disease && r.horizon === horizon);
  const imported = links.reduce((a, l) => a + l.share * (riskOf(l.to_district_id)?.prob ?? 0), 0);
  const x = timesUsual(sel?.prob, sel?.typical_prob);
  const pp = climateEffectPp(sel?.prob, sel?.prob_no_climate);
  const tier = isTier(sel?.risk_level) ? sel!.risk_level : null;
  const monthNames = t.lang === 'en' ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] : Array.from({ length: 12 }, (_, i) => String(i + 1));
  const grid = isScenarios(sel?.scenarios) ? sel!.scenarios : null;

  const advisory = () => {
    if (!d || !sel || !tier) return '';
    const why = drivers.filter(x => x.w > 0).slice(0, 2).map(x => `• ${driverSentence(x, inp, t)}`).join('\n');
    const pre = PRECAUTIONS[disease].public.slice(0, 3).map(l => `• ${pick(l, t.lang)}`).join('\n');
    return [`*${t('adv.header')}*`, t('adv.risk', { disease: t(DISEASE_FC_KEY[disease]), district: d.name, state: stateName(s, t.lang), window: `${t('fcx.weeks', { w: WEEKS_OF[horizon]! })} (${win})`, tier: t(TIER_KEY[tier]), p: pctText(sel.prob) }),
      '', `*${t('adv.why')}*`, why, '', `*${t('adv.do')}*`, pick(TIER_ACTION[tier], t.lang), pre, '', t('adv.footer'), `${APP_URL}/india?district=${d.id}&fd=${disease}&fh=${horizon}`].join('\n');
  };
  const share = () => { const text = advisory(); if (text) window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); };
  const copy = async () => { try { await navigator.clipboard.writeText(advisory()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } };
  const print = () => {
    const text = advisory(); if (!text) return;
    const w = window.open('', '_blank', 'noopener,width=720,height=900'); if (!w) return;
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    w.document.write(`<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><title>${esc(t('adv.header'))}</title><style>body{font-family:system-ui,'Noto Sans Devanagari',sans-serif;max-width:640px;margin:32px auto;padding:0 16px;line-height:1.55;color:#111}pre{white-space:pre-wrap;font:inherit}</style></head><body><pre>${esc(text.replace(/\*/g, ''))}</pre><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return <Sheet open={!!id} onOpenChange={o => { if (!o) close(); }}>
    <SheetContent side="right" className="region-drawer">
      {!d ? <><SheetTitle>{t('dd.title')}</SheetTitle><SheetDescription>{t('dd.unknown')}</SheetDescription></> : <>
        <header className="drawer-header"><span className="control-label">{t('dd.title').toUpperCase()} · {stateName(s, t.lang)}</span><SheetTitle className="drawer-title">{d.name}</SheetTitle>
          <SheetDescription>{t('term.population')} {formatIN(d.population)} · {t('fcx.weeks', { w: WEEKS_OF[horizon]! })}, {win}</SheetDescription></header>
        {q.isPending ? <Skeleton className="h-64" /> : q.isError ? <p className="drawer-empty">{t('common.error')}</p> : !fc.length ? <p className="drawer-empty">{t('fcx.none')}</p> : <>
          <section className="drawer-section"><div className="panel-title-row"><h3><Sparkles />{t('dd.allDiseases', { month: win })}</h3><DataBadge kind="forecast" /></div>
            <ul className="dd-disease-grid">{FC_DISEASES.map(dis => { const r = fc.find(f => f.disease_id === dis && f.horizon === horizon); return <li key={dis}><button type="button" aria-pressed={dis === disease} onClick={() => setSearch({ fd: dis })}>
              <span>{t(DISEASE_FC_KEY[dis as FcDisease])}{r?.silent && <span className="bs-badge ml-2"><Eye className="size-3" />{t('bs.badge')}</span>}</span><TierBadge tier={r?.risk_level} /><b className="tabular-nums">{pctText(r?.prob)}</b></button></li>; })}</ul></section>
          {sel && <section className="drawer-section"><h3><ShieldAlert />{t(DISEASE_FC_KEY[disease])} · {win}</h3>
            <dl className="mini-stats mini-stats-4">
              <div><dt>{t('dd.withClimate')}</dt><dd>{pctText(sel.prob, 1)}</dd></div>
              <div><dt>{t('dd.withoutClimate')}</dt><dd>{pctText(sel.prob_no_climate, 1)}</dd></div>
              <div><dt>{t('dd.climateOnly')}</dt><dd>{pctText(sel.prob_climate_only, 1)}</dd></div>
              <div><dt>{t('dd.usual')}</dt><dd>{pctText(sel.typical_prob, 1)}</dd></div>
            </dl>
            <p className="sub mt-2">{tier && <TierBadge tier={tier} />} {x == null ? t('fcx.noUsual') : t('fcx.vsUsual', { x: x >= 10 ? Math.round(x) : x.toFixed(1) })}{pp != null && Math.abs(pp) >= 0.5 ? ` · ${pp > 0 ? t('fcx.climateUp', { pp: pp.toFixed(1) }) : t('fcx.climateDown', { pp: Math.abs(pp).toFixed(1) })}` : ''}{sel.rank_india ? ` · ${t('dd.rank', { r: sel.rank_india, n: formatIN(districts.length) })}` : ''}</p>
            {sel.silent && <p className="fc-whatif-note mt-2"><Eye className="size-4" />{t('bs.sub', { disease: t(DISEASE_FC_KEY[disease]) })}</p>}
            {drivers.length > 0 && <><h4 className="dd-h4">{t('dd.drivers')}</h4><ul className="fc-drivers">{drivers.map((dr, i) => <DriverLine key={i} d={dr} inputs={inp} />)}</ul><p className="fc-note mt-1">{t('dd.driversNote')}</p></>}
          </section>}
          {sel && tier && <section className="drawer-section"><h3><Send />{t('adv.title')}</h3>
            <div className="flex flex-wrap gap-2"><Button size="sm" onClick={share}><Send />{t('adv.whatsapp')}</Button><Button size="sm" variant="outline" onClick={copy}><Copy />{copied ? t('adv.copied') : t('adv.copy')}</Button><Button size="sm" variant="outline" onClick={print}><Printer />{t('adv.print')}</Button></div>
            <pre className="adv-preview">{advisory().replace(/\*/g, '')}</pre></section>}
          {grid && <section className="drawer-section"><h3><FlaskConical />{t('dd.whatif')}</h3>
            <div className="municipality-table-wrap"><table className="municipality-table whatif-table"><thead><tr><th>{t('wi.temp')} \ {t('dd.rainX')}</th>{grid.r.map(r => <th key={r}>×{r}</th>)}</tr></thead>
              <tbody>{grid.t.map((dt, i) => <tr key={dt}><th>{dt > 0 ? `+${dt}` : dt === 0 ? '0' : `−${Math.abs(dt)}`} °C</th>{grid.p[i]!.map((p, j) => { const lv = tierOf(p, stats?.thresholds) as Tier | null; const obs = WHATIF_RAIN[j] === 1 && WHATIF_TEMP[i] === 0;
                return <td key={j} className={`${lv ? `heat-${tierIndex(lv)}` : ''} ${obs ? 'whatif-obs' : ''}`}>{pctText(p, 1)}</td>; })}</tr>)}</tbody></table></div>
            <p className="fc-note mt-1">{t('wi.sub')}</p></section>}
          {links.length > 0 && <section className="drawer-section"><h3><Route />{t('mob.title')}</h3><p className="fc-note">{t('mob.sub')}</p>
            <ul className="mob-list">{links.map(l => { const r = riskOf(l.to_district_id); const o = byName.get(l.to_district_id); return <li key={l.to_district_id}><button type="button" onClick={() => setSearch({ district: l.to_district_id })}>{o?.name ?? l.to_district_id}</button>
              <span className="text-muted-foreground tabular-nums">{t('mob.share', { x: (l.share * 100).toFixed(0) })} · {formatIN(l.distance_km)} km</span><TierBadge tier={r?.risk_level} /></li>; })}</ul>
            <p className="sub mt-1">{t('mob.imported')}: <b>{pctText(imported / Math.max(1e-9, links.reduce((a, l) => a + l.share, 0)), 1)}</b> · {t('mob.mapHint')}</p></section>}
          {sel && <section className="drawer-section"><h3><CloudRain />{t('dd.inputs')}</h3><dl className="mini-stats">
            <div><dt>{t('dd.rain3m')}</dt><dd>{num(inp.r3) == null ? '—' : `${formatIN(inp.r3)} mm`}{num(inp.rp) != null && <small className="block text-muted-foreground">{t('dd.vsNormal', { x: `${inp.rp! > 0 ? '+' : inp.rp! < 0 ? '−' : ''}${Math.abs(Math.round(inp.rp!))}` })}</small>}</dd></div>
            <div><dt>{t('dd.temp')}</dt><dd>{num(inp.t) == null ? '—' : `${inp.t!.toFixed(1)} °C`}</dd></div>
            <div><dt>{t('dd.tempAnom')}</dt><dd>{num(inp.ta) == null ? '—' : `${inp.ta! > 0 ? '+' : inp.ta! < 0 ? '−' : ''}${Math.abs(inp.ta!).toFixed(1)} °C`}</dd></div>
            <div><dt>{t('dd.rh')}</dt><dd>{num(inp.rh) == null ? '—' : `${Math.round(inp.rh!)}%`}</dd></div>
            <div><dt>{t('sig.water')}</dt><dd>{num(inp.sw) == null ? '—' : inp.sw!.toFixed(2)}{num(inp.swa) != null && <small className="block text-muted-foreground">{t('dd.vsNormalVal', { x: `${inp.swa! >= 0 ? '+' : '−'}${Math.abs(inp.swa!).toFixed(2)}` })}</small>}</dd></div>
            <div><dt>{t('sig.satellite')}</dt><dd>{num(inp.sol) == null ? '—' : `${inp.sol!.toFixed(1)} MJ/m²/day`}</dd></div>
            <div><dt>{t('drawer.aedes')}</dt><dd>{num(inp.ae) == null ? '—' : inp.ae!.toFixed(2)}</dd></div>
            <div><dt>{t('drawer.anopheles')}</dt><dd>{num(inp.an) == null ? '—' : inp.an!.toFixed(2)}</dd></div>
            <div><dt>{t('sig.mobility')}</dt><dd>{num(inp.mb) == null ? '—' : `${(inp.mb! * 100).toFixed(1)}%`}</dd></div>
          </dl><p className="fc-note mt-1">NASA POWER · {t('fcx.weatherTo', { d: dayLabel(issue, t.lang) })}</p></section>}
          <section className="drawer-section"><h3><ShieldCheck />{t('fcx.precautions')}</h3><Precautions disease={disease} tier={tier} /></section>
          <section className="drawer-section"><div className="panel-title-row"><h3><History />{t('dd.history')}</h3><DataBadge kind="reported" /></div>
            {hist.total ? <>
              <p className="sub">{t('dd.outbreaks')}: {formatIN(hist.total)} · {t('term.cases')}: {formatIN(hist.cases)}</p>
              <div className="dd-charts"><div><p className="control-label">{t('dd.byYear')}</p><div className="h-36"><ResponsiveContainer><BarChart data={hist.yearRows} margin={{ left: -24, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="y" {...axis} tickFormatter={y => `'${String(y).slice(2)}`} interval={1} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} formatter={v => [v, t('dd.outbreaks')]} /><Bar dataKey="n" fill="var(--primary)" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>
                <div><p className="control-label">{t('dd.byMonth')}</p><div className="h-36"><ResponsiveContainer><BarChart data={hist.months} margin={{ left: -24, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="m" {...axis} tickFormatter={m => monthNames[Number(m) - 1] ?? ''} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} formatter={v => [v, t('dd.outbreaks')]} /><Bar dataKey="n" fill="var(--rain-3)" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div></div>
              <p className="fc-note mt-1">IDSP weekly outbreak reports via EpiClim (2009–2022)</p></> : <p className="drawer-empty">{t('dd.noHistory')}</p>}
          </section>
        </>}
      </>}
    </SheetContent>
  </Sheet>;
}
