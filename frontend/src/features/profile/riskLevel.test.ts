import { describe, expect, it } from 'vitest';
import { DEMO_PROFILES } from '../../api/seed';
import { riskLevel, sameCompany } from './riskLevel';

describe('уровень риска в списке компаний', () => {
  it('совпадает с подписями демо-профилей', () => {
    for (const p of DEMO_PROFILES) expect(riskLevel(p.company)).toBe(p.risk_level);
  });

  it('пересчитывается, если данные изменили', () => {
    const alfa = DEMO_PROFILES[0].company;
    expect(riskLevel({ ...alfa, annual_revenue: 900 })).toBe('risky');
    expect(sameCompany(alfa, { ...alfa })).toBe(true);
    expect(sameCompany(alfa, { ...alfa, annual_revenue: 900 })).toBe(false);
  });
});
