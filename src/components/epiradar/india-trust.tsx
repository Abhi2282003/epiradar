import { useQuery } from '@tanstack/react-query';
import { indiaOverviewQuery } from '@/lib/india-query';
import { INDIA_DISEASES, SUITABILITY_FORMULAS, indiaToday, yearsInfo } from '@/lib/india';
import { DISEASE_KEY, useT } from '@/lib/i18n';
import { When } from './india-page';

const IDS = ['ncvbdc', 'datameet_boundaries', 'open_meteo_india', 'icts_karnataka', 'who_gho'];

export function IndiaTrust() {
  const t = useT();
  const q = useQuery(indiaOverviewQuery);
  if (q.isPending) return <p className="sub">{t('common.loading')}</p>;
  if (q.isError) return <p className="sub">{t('common.error')}</p>;
  const { burden, sources, states } = q.data;
  const ids = new Set(states.map(s => s.id));
  const year = Number(indiaToday().slice(0, 4));
  const src = sources.filter(s => IDS.includes(s.id));
  return <div className="flex flex-col gap-4">
    <section className="replay-card"><h2>{t('trust.india.sources')}</h2>
      {src.length ? <ul className="mt-2 flex flex-col gap-2 text-sm">{src.map(s => <li key={s.id}><strong>{s.name ?? s.id}</strong> · {s.status ?? '—'} · {s.cadence ?? '—'} · <When ts={s.last_success_at} lang={t.lang} />{s.note ? <div className="sub">{s.note}</div> : null}</li>)}</ul> : <p className="sub mt-2">—</p>}
    </section>
    <section className="replay-card"><h2>{t('trust.india.coverage')}</h2>
      {burden.length ? <ul className="mt-2 flex flex-col gap-1 text-sm">{INDIA_DISEASES.map(d => { const rows = burden.filter(r => r.disease_id === d && ids.has(r.admin1)); const info = yearsInfo(rows, year);
        return <li key={d}><strong>{t(DISEASE_KEY[d]!)}</strong>: {info.years.length ? `${info.years[0]}–${info.years[info.years.length - 1]}` : '—'}{info.partial.size ? ` · ${t('common.partial')}: ${[...info.partial].join(', ')}` : ''}</li>; })}</ul> : <p className="sub mt-2">{t('trust.india.noCoverage')}</p>}
    </section>
    <section className="replay-card"><h2>{t('trust.india.formulas')}</h2><ul className="mt-2 flex flex-col gap-1 text-sm font-mono">{SUITABILITY_FORMULAS.map(f => <li key={f}>{f}</li>)}</ul></section>
    <section className="replay-card"><h2>{t('trust.india.limits')}</h2><p className="sub mt-2">{t('fc.body1')}</p><p className="sub mt-2">{t('fc.body2')}</p></section>
  </div>;
}
