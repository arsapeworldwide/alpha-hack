import { describe, expect, it } from 'vitest';
import { annualRate, decide, evaluate, REJECTION_REASONS, totalScore, scoreFactors } from './scoring';
import { DEMO_PROFILES } from './seed';
import type { Company } from './types';

const TODAY = '2026-10-24';
const request = { requestedAmount: 10_000_000, termMonths: 36, goal: 'working_capital' as const };
const profile = (id: string) => DEMO_PROFILES.find((p) => p.id === id)!.company;

describe('эталоны из SCORING_SPEC (10 млн ₽, 36 мес, оборотные средства)', () => {
  it('ООО «Альфа Ритейл» → score 97, 19%, одобрено', () => {
    const d = evaluate({ company: profile('alfa-retail'), ...request }, TODAY);
    expect(d.score).toBe(97);
    expect(d.rate).toBe(19);
    expect(d.outcome).toBe('APPROVED');
    expect(d.approved_amount).toBe(10_000_000);
    // Платёж посчитан независимо (Python Decimal, half-up)
    expect(d.monthly_payment).toBe(366_560);
    expect(d.overpayment).toBe(3_196_160);
    expect(d.rejection_reason).toBeNull();
  });

  it('ИП Иванов → score 46, 24%, встречное предложение 2 500 000 ₽', () => {
    const d = evaluate({ company: profile('ivanov'), ...request }, TODAY);
    expect(d.score).toBe(46);
    expect(d.rate).toBe(24);
    expect(d.outcome).toBe('COUNTER_OFFER');
    expect(d.approved_amount).toBe(2_500_000);
    expect(d.monthly_payment).toBe(98_082);
    expect(d.overpayment).toBe(1_030_952);
  });

  it('ООО «Вектор» → score 8, отказ «Высокая долговая нагрузка», повтор через 3 месяца', () => {
    const d = evaluate({ company: profile('vector'), ...request }, TODAY);
    expect(d.score).toBe(8);
    expect(d.outcome).toBe('REJECTED');
    expect(d.rate).toBeNull();
    expect(d.approved_amount).toBeNull();
    expect(d.rejection_reason).toBe(REJECTION_REASONS.debt);
    expect(d.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(d.recommendations.length).toBeLessThanOrEqual(3);
    expect(d.reapply_date).toBe('2027-01-24');
  });

  it('факторы не превышают максимум и в сумме дают итоговый балл', () => {
    for (const p of DEMO_PROFILES) {
      const factors = scoreFactors({ company: p.company, ...request });
      expect(factors).toHaveLength(5);
      for (const f of factors) {
        expect(f.points).toBeGreaterThanOrEqual(0);
        expect(f.points).toBeLessThanOrEqual(f.max_points);
      }
    }
  });
});

describe('границы', () => {
  // fair 20 + выручка 20 млн 12 + возраст 3 года 7 + доля 0,1 → 5 = 44 балла без учёта долговой нагрузки
  const base: Company = {
    inn: '7700000001', name: 'Тест', annual_revenue: 20_000_000, monthly_payments: 0,
    credit_history: 'fair', business_age_years: 3, segment: 'services',
  };
  const small = { requestedAmount: 2_000_000, termMonths: 36, goal: 'working_capital' as const };

  it('score 44 → отказ', () => {
    const company = { ...base, monthly_payments: 416_667 }; // d чуть больше 0,25 → 0 баллов за нагрузку
    const d = evaluate({ company, ...small }, TODAY);
    expect(d.score).toBe(44);
    expect(d.outcome).toBe('REJECTED');
  });

  it('score 44,99998 округляется до 45 → ставка 24% и встречное 300 000 ₽', () => {
    const company = { ...base, monthly_payments: 402_778 };
    expect(totalScore(scoreFactors({ company, ...small }))).toBe(45);
    const d = evaluate({ company, ...small }, TODAY);
    expect(d.rate).toBe(24);
    expect(d.outcome).toBe('COUNTER_OFFER');
    expect(d.approved_amount).toBe(300_000);
  });

  it('платёжная способность = 0 → отказ «Высокая долговая нагрузка»', () => {
    const company: Company = { ...base, annual_revenue: 12_000_000, monthly_payments: 250_000, credit_history: 'excellent', business_age_years: 5 };
    const d = evaluate({ company, requestedAmount: 300_000, termMonths: 36, goal: 'working_capital' }, TODAY);
    expect(d.score).toBeGreaterThanOrEqual(45);
    expect(d.capacity).toBe(0);
    expect(d.outcome).toBe('REJECTED');
    expect(d.rejection_reason).toBe(REJECTION_REASONS.debt);
  });

  it('максимум 299 999 → отказ, 300 000 → встречное 300 000', () => {
    const common = { score: 60, capacity: 10_000, requestedAmount: 1_000_000 };
    expect(decide({ ...common, maxAmount: 299_999 })).toEqual({ outcome: 'REJECTED', approvedAmount: null });
    expect(decide({ ...common, maxAmount: 300_000 })).toEqual({ outcome: 'COUNTER_OFFER', approvedAmount: 300_000 });
    expect(decide({ ...common, maxAmount: 1_000_000 })).toEqual({ outcome: 'APPROVED', approvedAmount: 1_000_000 });
  });

  it('ставка: надбавки за риск и базы по целям', () => {
    expect(annualRate(80, 'equipment')).toBe(17);
    expect(annualRate(79, 'working_capital')).toBe(21.5);
    expect(annualRate(60, 'cash_gap')).toBe(23.5);
    expect(annualRate(45, 'cash_gap')).toBe(26);
    expect(annualRate(44, 'cash_gap')).toBeNull();
  });

  it('кассовый разрыв на 12 месяцев считается по базе 21%', () => {
    const d = evaluate({ company: profile('alfa-retail'), requestedAmount: 1_000_000, termMonths: 12, goal: 'cash_gap' }, TODAY);
    expect(d.rate).toBe(21);
    expect(d.outcome).toBe('APPROVED');
  });
});
