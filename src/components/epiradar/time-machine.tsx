import { RiskName } from './i18n-ui';
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ClientOnly } from '@tanstack/react-router';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { RISK_SCALE } from '@/lib/epiradar';
import { getReplay } from '@/lib/replay.functions';
import { ALERT_CUTOFF, defaultSeason, seasonOf, seasonsOf, byRegion, firstAlertsAt, municipalityLead, riskFromProbability, scorecard, shiftWeeks, stateSeries, weeksBetween, type BacktestRow } from '@/lib/replay';
import { formatNumber, formatProbability, type Municipality, type Prediction } from '@/lib/surveillance';
import { addReplayEvents } from '@/lib/live-store';

export const replayQuery = queryOptions({ queryKey: ['replay'], queryFn: () => getReplay(), staleTime: 5 * 60_000 });
const MunicipalityMap = lazy(() => import('./municipality-map'));
const fmt = (w: string | null | undefined) => w ? new Date(`${w.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const short = (w: string) => new Date(`${w}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
const tooltipStyle = { contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 } };

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? <p className="drawer-empty">The map could not be loaded.</p> : this.props.children; }
}

type Horizon = { h: number; test?: { pr_auc?: number; roc_auc?: number }; baseline_persistence_pr_auc?: number; baseline_seasonal_pr_auc?: number };
function AccuracyCard({ card }: { card: unknown }) {
  const metrics = (card && typeof card === 'object' && Array.isArray((card as { metrics_by_horizon?: unknown }).metrics_by_horizon) ? (card as { metrics_by_horizon: Horizon[] }).metrics_by_horizon : []);
  const data = metrics.map(m => ({ h: m.h, model: m.test?.pr_auc ?? null, roc: m.test?.roc_auc ?? null, persistence: m.baseline_persistence_pr_auc ?? null, seasonal: m.baseline_seasonal_pr_auc ?? null }));
  return <section className="replay-card"><h2>Model accuracy by horizon</h2><p className="sub">PR-AUC on the 2024 test set · epiradar-cases-v1 vs simple baselines</p>
    {data.length ? <div className="h-56"><ResponsiveContainer><LineChart data={data} margin={{ left: -16, right: 8 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey="h" {...axis} tickFormatter={h => `${h}w`} />
      <YAxis domain={[0, 1]} {...axis} />
      <Tooltip {...tooltipStyle} labelFormatter={h => `${h} weeks ahead`} content={({ active, payload, label }) => {
        const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
        if (!active || !p) return null;
        return <div className="chart-tooltip"><strong>{label} weeks ahead</strong><p>Model PR-AUC: {p.model?.toFixed(3) ?? '—'}</p><p>ROC-AUC: {p.roc?.toFixed(3) ?? '—'}</p><p>Persistence baseline: {p.persistence?.toFixed(3) ?? '—'}</p><p>Seasonal baseline: {p.seasonal?.toFixed(3) ?? '—'}</p></div>;
      }} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <Line name="Model" dataKey="model" stroke="var(--primary)" strokeWidth={2} isAnimationActive={false} />
      <Line name="Persistence baseline" dataKey="persistence" stroke="var(--muted-foreground)" strokeDasharray="5 4" isAnimationActive={false} />
      <Line name="Seasonal baseline" dataKey="seasonal" stroke="var(--risk-no-data)" strokeDasharray="2 3" isAnimationActive={false} />
    </LineChart></ResponsiveContainer></div> : <p className="drawer-empty">Accuracy metrics will appear once the model card for epiradar-cases-v1 is loaded.</p>}
  </section>;
}

function MunicipalityReplay({ name, rows, week, onClose }: { name: string; rows: BacktestRow[]; week: string; onClose: () => void }) {
  const lead = municipalityLead(rows);
  const alertWeek = lead.alertWeek ?? lead.firstAlertWeek;
  const warning = alertWeek && lead.peakWeek ? weeksBetween(shiftWeeks(alertWeek, -4), lead.peakWeek) : null;
  const data = rows.map(r => ({ week: r.target_week, cases: r.cases_actual, threshold: r.threshold_cases, prob: r.outbreak_prob == null ? null : r.outbreak_prob * 100 }));
  const sentence = !alertWeek ? `No forecast reached ${ALERT_CUTOFF * 100}% during the replay${lead.onset ? `; outbreak began in the week of ${fmt(lead.onset)}` : ''}.`
    : `First alert issued 4 weeks before the week of ${fmt(alertWeek)}${lead.peakWeek ? `; peak in the week of ${fmt(lead.peakWeek)}` : ''}${warning != null ? `: ${warning} weeks of warning` : ''}.`;
  return <section className="replay-card"><div className="flex items-start justify-between gap-2"><div><h2>{name}</h2><p className="sub">{sentence}</p></div><Button size="icon" variant="ghost" aria-label="Close municipality chart" onClick={onClose}><X /></Button></div>
    <div className="h-64"><ResponsiveContainer><ComposedChart data={data} margin={{ left: -12, right: -8 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey="week" tickFormatter={short} {...axis} minTickGap={20} />
      <YAxis yAxisId="c" {...axis} tickFormatter={v => formatNumber(v)} />
      <YAxis yAxisId="p" orientation="right" domain={[0, 100]} {...axis} tickFormatter={v => `${v}%`} />
      <Tooltip {...tooltipStyle} labelFormatter={w => `Week of ${fmt(String(w))}`} formatter={(v: number, n: string) => [n === 'Forecast probability' ? `${Math.round(v)}%` : formatNumber(v), n]} />
      <Bar yAxisId="c" name="Cases" dataKey="cases" fill="var(--muted-foreground)" fillOpacity={0.55} isAnimationActive={false} />
      <Line yAxisId="c" name="Outbreak threshold" dataKey="threshold" type="stepAfter" stroke="var(--risk-high)" dot={false} isAnimationActive={false} />
      <Line yAxisId="p" name="Forecast probability" dataKey="prob" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
      <ReferenceLine yAxisId="p" y={ALERT_CUTOFF * 100} stroke="var(--risk-moderate)" strokeDasharray="5 4" label={{ value: '40% alert', fill: 'var(--risk-moderate)', fontSize: 10, position: 'insideTopRight' }} />
      <ReferenceLine yAxisId="c" x={week} stroke="var(--foreground)" strokeOpacity={0.4} />
      {alertWeek && <ReferenceDot yAxisId="p" x={alertWeek} y={(rows.find(r => r.target_week === alertWeek)?.outbreak_prob ?? 0) * 100} r={5} fill="var(--risk-moderate)" stroke="var(--background)" label={{ value: 'First alert', fill: 'var(--risk-moderate)', fontSize: 10, position: 'top' }} />}
      {lead.peakWeek && lead.peakCases != null && <ReferenceDot yAxisId="c" x={lead.peakWeek} y={lead.peakCases} r={5} fill="var(--risk-high)" stroke="var(--background)" label={{ value: 'Peak', fill: 'var(--risk-high)', fontSize: 10, position: 'top' }} />}
    </ComposedChart></ResponsiveContainer></div>
  </section>;
}

export function TimeMachine() {
  const { data: all } = useSuspenseQuery(replayQuery);
  const seasons = useMemo(() => seasonsOf(all.rows), [all.rows]);
  const [season, setSeason] = useState<number | null>(() => defaultSeason(seasons));
  const activeSeason = season != null && seasons.includes(season) ? season : defaultSeason(seasons);
  const data = useMemo(() => ({ ...all, rows: all.rows.filter(r => seasonOf(r.target_week) === activeSeason) }), [all, activeSeason]);
  const regions = useMemo(() => byRegion(data.rows), [data.rows]);
  const weeks = useMemo(() => [...new Set(data.rows.map(r => r.target_week))].sort(), [data.rows]);
  const series = useMemo(() => stateSeries(data.rows), [data.rows]);
  const score = useMemo(() => scorecard(data.rows), [data.rows]);
  const names = useMemo(() => new Map(data.regions.map(r => [r.id, r.name])), [data.regions]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [selected, setSelected] = useState<string | null>(null);
  const week = weeks[Math.min(index, weeks.length - 1)] ?? '';
  const lastAnnounced = useRef<string | null>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setIndex(i => { if (i >= weeks.length - 1) { setPlaying(false); return i; } return i + 1; }), speed * 1000);
    return () => clearInterval(id);
  }, [playing, speed, weeks.length]);
  useEffect(() => {
    if (!playing || !week || lastAnnounced.current === week) return;
    lastAnnounced.current = week;
    const lines = firstAlertsAt(regions, week).map(a => `Replay · week of ${fmt(week)}: ${names.get(a.id) ?? a.id} forecast at ${formatProbability(a.prob)} outbreak risk 4 weeks ahead`);
    if (!lines.length) return;
    addReplayEvents(lines);
    if (lines.length <= 3) lines.forEach(line => toast(line));
    else toast(lines[0]!, { description: `+${lines.length - 1} more municipalities reached ${ALERT_CUTOFF * 100}% this week` });
  }, [week, playing, regions, names]);

  const { rows, outlined } = useMemo(() => {
    const at = new Map(data.rows.filter(r => r.target_week === week).map(r => [r.region_id, r]));
    const outlined = new Set([...at.values()].filter(r => r.outbreak_actual).map(r => r.region_id));
    const rows: Municipality[] = data.regions.map(region => {
      const r = at.get(region.id);
      return { region, prediction: r && r.outbreak_prob != null ? ({ outbreak_prob: r.outbreak_prob, risk_level: riskFromProbability(r.outbreak_prob), target_week: r.target_week } as Prediction) : null };
    });
    return { rows, outlined };
  }, [data, week]);
  const tooltip = (row: Municipality) => {
    const r = regions.get(row.region.id)?.find(x => x.target_week === week);
    return r ? [`Forecast 4 weeks earlier: ${formatProbability(r.outbreak_prob)} · ${riskFromProbability(r.outbreak_prob) ?? 'No data'}`, `Reported cases: ${formatNumber(r.cases_actual)}`, `Outbreak happened: ${r.outbreak_actual == null ? '—' : r.outbreak_actual ? 'yes' : 'no'}`] : ['No replay data'];
  };

  if (!data.rows.length) return <div className="empty-content"><h3>No backtests loaded</h3><p>The 2024 season replay will appear once backtest rows for dengue at a 4-week horizon are loaded.</p></div>;
  const pct = (v: number | null) => v == null ? '—' : `${Math.round(v * 100)}%`;
  return <>
    <div className="season-picker"><label htmlFor="season" className="control-label">SEASON</label><select id="season" value={activeSeason ?? ''} onChange={e => { setSeason(Number(e.target.value)); setIndex(0); setPlaying(false); setSelected(null); lastAnnounced.current = null; }}>{seasons.map(y => <option key={y} value={y}>{y}</option>)}</select><span className="sub">{formatNumber(data.rows.length)} replay rows · weeks {weeks[0] ? fmt(weeks[0]) : '—'} to {weeks.length ? fmt(weeks[weeks.length - 1]) : '—'}</span></div>
    <div className="replay-banner" role="note">REPLAY MODE · {activeSeason} dengue season, Rio de Janeiro state · each week's risk was forecast 4 weeks earlier by epiradar-cases-v1, trained on data up to 2022 and calibrated on 2023</div>
    <div className="replay-layout">
      <div className="replay-stack">
        <section className="replay-card">
          <div className="scrubber">
            <Button size="icon" variant="outline" aria-label="Previous week" disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}><SkipBack /></Button>
            <Button size="icon" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => { if (!playing && index >= weeks.length - 1) setIndex(0); setPlaying(p => !p); }}>{playing ? <Pause /> : <Play />}</Button>
            <Button size="icon" variant="outline" aria-label="Next week" disabled={index >= weeks.length - 1} onClick={() => setIndex(i => Math.min(weeks.length - 1, i + 1))}><SkipForward /></Button>
            <span className="week-label">Week {index + 1}/{weeks.length} · {fmt(week)}</span>
            <Slider className="scrubber-slider" aria-label="Replay week" min={0} max={Math.max(0, weeks.length - 1)} step={1} value={[index]} onValueChange={v => setIndex(v[0] ?? 0)} />
            <div className="view-toggle" role="group" aria-label="Playback speed">{[1, 2, 4].map(s => <Button key={s} size="sm" variant={speed === s ? 'secondary' : 'ghost'} aria-pressed={speed === s} onClick={() => setSpeed(s)}>1 wk / {s}s</Button>)}</div>
          </div>
          <div className="replay-map"><Boundary><ClientOnly fallback={<Skeleton className="h-full" />}><Suspense fallback={<Skeleton className="h-full" />}>
            <MunicipalityMap rows={rows} outlined={outlined} selected={selected ?? undefined} onSelect={setSelected} tooltip={tooltip} label={`Replay map for the week of ${fmt(week)}`} />
          </Suspense></ClientOnly></Boundary></div>
          <div className="replay-legend"><strong>Fill = risk forecast 4 weeks earlier · Outline = outbreak actually happened</strong>{RISK_SCALE.map((r, i) => <span className="risk-item" key={r.label}><span className={`risk-swatch risk-${i}`} /><RiskName label={r.label} /></span>)}</div>
        </section>
        {selected && regions.get(selected) && <MunicipalityReplay name={names.get(selected) ?? selected} rows={regions.get(selected)!} week={week} onClose={() => setSelected(null)} />}
        <section className="replay-card"><h2>State-wide season</h2><p className="sub">Reported cases (bars) and municipalities with forecast ≥ 40% (line)</p>
          <div className="h-60"><ResponsiveContainer><ComposedChart data={series} margin={{ left: -8, right: -8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="week" tickFormatter={short} {...axis} minTickGap={20} />
            <YAxis yAxisId="c" {...axis} tickFormatter={v => formatNumber(v)} />
            <YAxis yAxisId="m" orientation="right" {...axis} allowDecimals={false} />
            <Tooltip {...tooltipStyle} labelFormatter={w => `Week of ${fmt(String(w))}`} formatter={(v: number, n: string) => [formatNumber(v), n]} />
            <Bar yAxisId="c" name="Reported cases" dataKey="cases" fill="var(--muted-foreground)" fillOpacity={0.55} isAnimationActive={false} />
            <Line yAxisId="m" name="Municipalities ≥ 40%" dataKey="alerted" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceLine yAxisId="c" x={week} stroke="var(--risk-moderate)" strokeWidth={2} label={{ value: 'Now', fill: 'var(--risk-moderate)', fontSize: 10, position: 'top' }} />
          </ComposedChart></ResponsiveContainer></div>
          {series.some(s => s.missing) && <p className="drawer-caption">Some municipality-weeks have no reported count and are excluded from the totals.</p>}
        </section>
      </div>
      <div className="replay-stack">
        <section className="replay-card"><h2>Scorecard</h2><p className="sub">Alert cut-off {ALERT_CUTOFF * 100}% · computed from the {formatNumber(data.rows.length)} replay rows</p>
          <div className="score-grid">
            <div><span>Municipalities with an outbreak</span><strong>{formatNumber(score.withOutbreak)}</strong></div>
            <div><span>Alerted before onset</span><strong>{formatNumber(score.alertedBeforeOnset)}</strong></div>
            <div><span>Median lead to onset</span><strong>{score.medianLeadToOnset == null ? '—' : `${score.medianLeadToOnset} wk`}</strong></div>
            <div><span>Median lead to peak</span><strong>{score.medianLeadToPeak == null ? '—' : `${score.medianLeadToPeak} wk`}</strong></div>
            <div><span>Alerted, never had an outbreak</span><strong>{formatNumber(score.falseAlarmMunicipalities)}</strong></div>
            <div><span>Precision · recall (weeks)</span><strong>{pct(score.precision)} · {pct(score.recall)}</strong></div>
            <div><span>Hits</span><strong>{formatNumber(score.hits)}</strong></div>
            <div><span>Misses · false alarms</span><strong>{formatNumber(score.misses)} · {formatNumber(score.falseAlarms)}</strong></div>
          </div>
          <p className="drawer-caption">Backtests use final case counts; live data has reporting delays, so live accuracy will be lower.</p>
        </section>
        <AccuracyCard card={data.card} />
      </div>
    </div>
  </>;
}
