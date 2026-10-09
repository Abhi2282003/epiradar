import { describe, expect, it } from 'vitest';
import { DISEASES, RISK_SCALE, validateContext } from '@/lib/epiradar';
describe('EpiRadar context and risk rules', () => {
  it('defaults to a four-week horizon', () => expect(validateContext({}).horizon).toBe(4));
  it('supports horizons from one to eight weeks', () => {
    expect(validateContext({ horizon: -1 }).horizon).toBe(1);
    expect(validateContext({ horizon: 9 }).horizon).toBe(8);
    for (let horizon = 1; horizon <= 8; horizon++) expect(validateContext({ horizon }).horizon).toBe(horizon);
  });
  it('supports exactly the specified diseases', () => {
    expect(DISEASES).toEqual(['Dengue', 'Chikungunya', 'Zika', 'Malaria', 'Leptospirosis', 'Diarrhoeal disease']);
    for (const disease of DISEASES) expect(validateContext({ disease }).disease).toBe(disease);
  });
  it('preserves shareable disease and horizon context', () => expect(validateContext({ disease: 'Zika', horizon: '7' })).toEqual({ disease: 'Zika', horizon: 7 }));
  it('handles invalid context safely', () => expect(validateContext({ disease: 'unknown', horizon: 'invalid' })).toEqual({ disease: 'Dengue', horizon: 4 }));
  it('retains all specified labelled risk colors', () => expect(RISK_SCALE).toEqual([
    { label: 'Low', color: '#FDE68A' }, { label: 'Moderate', color: '#F59E0B' }, { label: 'High', color: '#DC2626' }, { label: 'Very high', color: '#9D174D' }, { label: 'No data', color: '#64748B' },
  ]));
});
