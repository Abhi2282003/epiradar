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
      .select('district_id,target_month,prob,prob_no_climate,prob_climate_only,silent,typical_prob,risk_level,rank_india,drivers,inputs,scenarios')
      .eq('issue_month', latest.issue_month).eq('disease_id', data.disease).eq('horizon', data.horizon)
      .order('prob', { ascending: false }).limit(1000);
    if (r.error) throw new Error('India forecast could not be retrieved');
    const rows = r.data ?? [];
    return { issue_month: latest.issue_month, target_month: rows[0]?.target_month ?? null, model_version: latest.model_version, rows };
  });

/** One district: all diseases and horizons from the latest issue, what-if scenarios, its travel links (gravity
 *  model) with the linked districts' risk, and its IDSP outbreak history (EpiClim). */
export const getIndiaDistrict = createServerFn({ method: 'GET' })
  .inputValidator((input: { district: string }) => {
    if (typeof input.district !== 'string' || !/^IN-D\d{1,4}$/.test(input.district)) throw new Error('Invalid district');
    return input;
  })
  .handler(async ({ data }) => {
    const c = publicClient();
    const latest = await latestIssue();
    const [fc, hist, mob] = await Promise.all([
      latest ? c.from('india_forecasts').select('disease_id,horizon,target_month,prob,prob_no_climate,prob_climate_only,silent,typical_prob,risk_level,rank_india,drivers,inputs,scenarios')
        .eq('issue_month', latest.issue_month).eq('district_id', data.district).order('horizon') : Promise.resolve({ data: [], error: null }),
      c.from('india_outbreaks').select('disease_id,month,outbreaks,cases,deaths').eq('district_id', data.district).order('month').limit(1000),
      c.from('india_mobility').select('to_district_id,rank,share,distance_km').eq('district_id', data.district).order('rank').limit(10),
    ]);
    if (fc.error || hist.error || mob.error) throw new Error('District forecast could not be retrieved');
    const links = mob.data ?? [];
    let linkRisk: { district_id: string; disease_id: string; horizon: number; risk_level: string; prob: number }[] = [];
    if (latest && links.length) {
      const lr = await c.from('india_forecasts').select('district_id,disease_id,horizon,risk_level,prob')
        .eq('issue_month', latest.issue_month).in('district_id', links.map(l => l.to_district_id)).limit(500);
      if (lr.error) throw new Error('District forecast could not be retrieved');
      linkRisk = lr.data ?? [];
    }
    return { issue_month: latest?.issue_month ?? null, model_version: latest?.model_version ?? null, forecasts: fc.data ?? [], outbreaks: hist.data ?? [], links, linkRisk };
  });

/** Latest India model card (validation, ablation, alert levels). */
export const getIndiaModelCard = createServerFn({ method: 'GET' }).handler(async () => {
  const r = await publicClient().from('model_runs').select('model_version,created_at,card').eq('scope', 'india-district').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (r.error) throw new Error('India model card could not be retrieved');
  return r.data ? { model_version: r.data.model_version, created_at: r.data.created_at, cardJson: JSON.stringify(r.data.card ?? null) } : null;
});

/** Mobility links for the map: each district's 3 strongest travel links (about 1,900 rows, small). */
export const getIndiaMobility = createServerFn({ method: 'GET' }).handler(async () => {
  const c = publicClient();
  const rows: { district_id: string; to_district_id: string; rank: number; share: number }[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const r = await c.from('india_mobility').select('district_id,to_district_id,rank,share').lte('rank', 3).order('district_id').order('rank').range(from, from + 999);
    if (r.error) throw new Error('Mobility network could not be retrieved');
    rows.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) break;
  }
  return rows;
});

/** All diseases for one window: districts at high or very high risk, plus blind spots (for the situation brief). */
export const getIndiaSummary = createServerFn({ method: 'GET' })
  .inputValidator((input: { horizon: number }) => {
    if (!isFcHorizon(input.horizon)) throw new Error('Invalid forecast request');
    return { horizon: Number(input.horizon) };
  })
  .handler(async ({ data }) => {
    const latest = await latestIssue();
    if (!latest) return { issue_month: null, rows: [] };
    const r = await publicClient().from('india_forecasts').select('district_id,disease_id,prob,risk_level,silent')
      .eq('issue_month', latest.issue_month).eq('horizon', data.horizon).or('risk_level.in.(high,very_high),silent.eq.true').limit(3000);
    if (r.error) throw new Error('India forecast could not be retrieved');
    return { issue_month: latest.issue_month, rows: r.data ?? [] };
  });
