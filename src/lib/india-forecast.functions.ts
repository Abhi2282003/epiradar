import { createServerFn } from '@tanstack/react-start';
import { publicClient } from '@/lib/replay.functions';
import { isFcDisease, isFcHorizon } from '@/lib/india-forecast';

const ISSUE_COLS = 'issue_month,target_month,model_version';

async function latestIssue() {
  const r = await publicClient().from('india_forecasts').select(ISSUE_COLS).order('issue_month', { ascending: false }).limit(1).maybeSingle();
  if (r.error) throw new Error('India forecast could not be retrieved');
  return r.data;
}

/** Every district's forecast for one disease and one horizon, from the latest issue (about 640 rows). */
export const getIndiaForecast = createServerFn({ method: 'GET' })
  .inputValidator((input: { disease: string; horizon: number }) => {
    if (!isFcDisease(input.disease) || !isFcHorizon(input.horizon)) throw new Error('Invalid forecast request');
    return { disease: input.disease, horizon: Number(input.horizon) };
  })
  .handler(async ({ data }) => {
    const latest = await latestIssue();
    if (!latest) return { issue_month: null, target_month: null, model_version: null, rows: [] };
    const r = await publicClient().from('india_forecasts')
      .select('district_id,target_month,prob,prob_no_climate,typical_prob,risk_level,rank_india,drivers,inputs')
      .eq('issue_month', latest.issue_month).eq('disease_id', data.disease).eq('horizon', data.horizon)
      .order('prob', { ascending: false }).limit(1000);
    if (r.error) throw new Error('India forecast could not be retrieved');
    const rows = r.data ?? [];
    return { issue_month: latest.issue_month, target_month: rows[0]?.target_month ?? null, model_version: latest.model_version, rows };
  });

/** One district: all diseases and horizons from the latest issue, plus its IDSP outbreak history (EpiClim). */
export const getIndiaDistrict = createServerFn({ method: 'GET' })
  .inputValidator((input: { district: string }) => {
    if (typeof input.district !== 'string' || !/^IN-D\d{1,4}$/.test(input.district)) throw new Error('Invalid district');
    return input;
  })
  .handler(async ({ data }) => {
    const c = publicClient();
    const latest = await latestIssue();
    const [fc, hist] = await Promise.all([
      latest ? c.from('india_forecasts').select('disease_id,horizon,target_month,prob,prob_no_climate,typical_prob,risk_level,rank_india,drivers,inputs')
        .eq('issue_month', latest.issue_month).eq('district_id', data.district).order('horizon') : Promise.resolve({ data: [], error: null }),
      c.from('india_outbreaks').select('disease_id,month,outbreaks,cases,deaths').eq('district_id', data.district).order('month').limit(1000),
    ]);
    if (fc.error || hist.error) throw new Error('District forecast could not be retrieved');
    return { issue_month: latest?.issue_month ?? null, model_version: latest?.model_version ?? null, forecasts: fc.data ?? [], outbreaks: hist.data ?? [] };
  });

/** Latest India model card (validation, ablation, alert levels). */
export const getIndiaModelCard = createServerFn({ method: 'GET' }).handler(async () => {
  const r = await publicClient().from('model_runs').select('model_version,created_at,card').eq('scope', 'india-district').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (r.error) throw new Error('India model card could not be retrieved');
  return r.data ? { model_version: r.data.model_version, created_at: r.data.created_at, cardJson: JSON.stringify(r.data.card ?? null) } : null;
});
