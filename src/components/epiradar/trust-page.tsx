import { useEffect, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PAGE_DETAILS, validateContext } from '@/lib/epiradar';
import { trustQuery } from '@/lib/surveillance-query';
import { formatNumber } from '@/lib/surveillance';
import { accuracyReading, asCard, caveats, dec, driverBars, horizonMetrics, num, pct, sourceTone, text, type Card } from '@/lib/trust';

const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 11 }, stroke: 'var(--border)' };
const dash = (v: string | null) => v ?? '—';

function Relative({ ts }: { ts: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const d = ts ? new Date(ts) : null;
  if (!d || !Number.isFinite(d.getTime())) return <span>—</span>;
  return <time dateTime={ts!} title={d.toISOString()}>{now == null ? ts!.slice(0, 10) : formatDistanceToNow(d, { addSuffix: true })}</time>;
}

function LeadGroup({ title, data }: { title: string; data: Card }) {
  const n = (k: string) => num(data?.[k]);
  const items: [string, string][] = [
    ['Municipalities with an outbreak', formatNumber(n('with_outbreak'))],
    ['Warned before onset', `${formatNumber(n('warned_before_onset'))} (${pct(n('share_warned'))})`],
    ['Median lead to onset', n('median_lead_to_onset_weeks') == null ? '—' : `${formatNumber(n('median_lead_to_onset_weeks'))} weeks`],
    ['Median lead to peak', n('median_lead_to_peak_weeks') == null ? '—' : `${formatNumber(n('median_lead_to_peak_weeks'))} weeks`],
    ['False alarms', `${formatNumber(n('no_outbreak_but_alerted'))} of ${formatNumber(n('no_outbreak'))} without outbreak`],
  ];
  return <div className="stat-group"><h3>{title}</h3><dl>{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>;
}

export function TrustPage() {
  const context = validateContext(useSearch({ strict: false }));
  const { data } = useSuspenseQuery(trustQuery(context.disease));
  const page = PAGE_DETAILS.trust;
  const card = asCard(data.run?.card);
  const metrics = horizonMetrics(card);
  const reading = accuracyReading(metrics, context.horizon);
  const bars = driverBars(card);
  const maxBar = Math.max(0, ...bars.map(b => b.value));
  const limits = caveats(card);
  const fields: [string, string][] = [
    ['Model version', dash(text(card?.['model_version']) ?? data.run?.model_version ?? null)],
    ['Issued week', dash(text(card?.['issued_week']))],
    ['Data', dash(text(card?.['data']))],
    ['Outbreak definition', dash(text(card?.['outbreak_definition']))],
    ['Training', dash(text(card?.['training']))],
    ['Validation', dash(text(card?.['validation']))],
    ['Test', dash(text(card?.['test']))],
    ['Alert cut-off', pct(num(card?.['alert_cutoff']))],
    ['Excluded', dash(text(card?.['excluded']))],
  ];
  return <>
    <p className="eyebrow">{page.eyebrow}</p>
    <div className="page-heading"><div><h1>{page.title}</h1><p className="page-description">{page.description}</p></div></div>
    {limits.length > 0 && <section className="limitations" aria-label="Limitations"><AlertTriangle /><div><h2>Limitations</h2><ul>{limits.map(c => <li key={c}>{c}</li>)}</ul></div></section>}
    {!data.run && <div className="forecast-notice">No model card loaded for {context.disease}. Model details will appear when the pipeline publishes a model run.</div>}
    <div className="trust-grid">
      <section className="replay-card"><h2>Model card</h2><p className="sub">Latest model run · {context.disease}</p><dl className="def-list">{fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
      <section className="replay-card"><h2>What the model listens to</h2><p className="sub">Average influence on the 4-week forecast, Rio de Janeiro 2024</p>
        {bars.length ? <ul className="driver-bars">{bars.map(b => <li key={b.label}><span>{b.label}</span><span className="bar-track"><span className="bar-fill" style={{ width: `${maxBar ? (b.value / maxBar) * 100 : 0}%` }} /></span><span className="tabular-nums">{dec(b.value)}</span></li>)}</ul> : <p className="drawer-empty">Driver importance will appear when the model card includes it.</p>}
        <p className="sub mt-3">Associations, not proof of cause.</p></section>
    </div>
    <section className="replay-card mt-5"><h2>Accuracy on 2024, never seen in training</h2><p className="sub">PR-AUC by forecast horizon · model vs simple baselines</p>
      {metrics.length ? <>
        <div className="h-64"><ResponsiveContainer><LineChart data={metrics} margin={{ left: -16, right: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="h" {...axis} tickFormatter={h => `${h}w`} />
          <YAxis domain={[0, 1]} {...axis} />
          <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }} labelFormatter={h => `${h} weeks ahead`} formatter={v => typeof v === 'number' ? v.toFixed(3) : '—'} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line name="EpiRadar model" dataKey="model" stroke="var(--primary)" strokeWidth={2.5} isAnimationActive={false} />
          <Line name="Same as this week" dataKey="persistence" stroke="var(--risk-moderate)" strokeDasharray="5 4" isAnimationActive={false} />
          <Line name="Usual for the season" dataKey="seasonal" stroke="var(--risk-no-data)" strokeDasharray="2 3" isAnimationActive={false} />
        </LineChart></ResponsiveContainer></div>
        {reading && <p className="reading">{reading}</p>}
        <div className="municipality-table-wrap"><table className="municipality-table"><thead><tr><th>Horizon</th><th>ROC-AUC</th><th>PR-AUC</th><th>Recall at cut-off</th><th>Precision at cut-off</th><th>80% range held the true count</th></tr></thead>
          <tbody>{metrics.map(m => <tr key={m.h} data-selected={m.h === context.horizon}><td>{m.h} {m.h === 1 ? 'week' : 'weeks'}</td><td>{dec(m.roc)}</td><td>{dec(m.model)}</td><td>{pct(m.recall)}</td><td>{pct(m.precision)}</td><td>{pct(m.coverage)}</td></tr>)}</tbody></table></div>
      </> : <p className="drawer-empty">Accuracy by horizon will appear when the model card includes test metrics.</p>}
    </section>
    <section className="replay-card mt-5"><h2>Early warning, 4 weeks ahead</h2><p className="sub">How many outbreaks were flagged before they began · 2024 test season</p>
      <div className="stat-groups"><LeadGroup title="Rio de Janeiro state" data={asCard(card?.['lead_time_h4_focus_state'])} /><LeadGroup title="All Brazil, ≥10k people" data={asCard(card?.['lead_time_h4_brazil'])} /></div></section>
    <section className="replay-card mt-5"><h2>Data sources</h2><p className="sub">Updates live as the pipeline reports</p>
      {data.sources.length ? <div className="municipality-table-wrap"><table className="municipality-table"><thead><tr><th>Source</th><th>Status</th><th>Cadence</th><th>Last success</th><th>Rows last run</th><th>Note</th></tr></thead>
        <tbody>{data.sources.map(s => <tr key={s.id}><td>{dash(s.name ?? s.id)}</td><td><span className={`status-badge status-${sourceTone(s.status)}`}>{dash(s.status)}</span></td><td>{dash(s.cadence)}</td><td className="font-mono text-xs"><Relative ts={s.last_success_at} /></td><td>{formatNumber(s.rows_last_run)}</td><td className="source-note">{dash(s.note)}</td></tr>)}</tbody></table></div> : <p className="drawer-empty">Data sources will appear when the pipeline registers them.</p>}
    </section>
  </>;
}
