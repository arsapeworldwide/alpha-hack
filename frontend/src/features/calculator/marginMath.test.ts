import { describe, expect, it } from 'vitest';
import { DEMO_PROFILES } from '../../api/seed';
import { safetyMargin } from './marginMath';

const company = (id: string) => DEMO_PROFILES.find((p) => p.id === id)!.company;
const TODAY = '2026-10-25';

describe('запас прочности', () => {
  it('Альфа Ритейл: платежи далеко от предела, прогноз — одобрят под 19%', () => {
    const m = safetyMargin(company('alfa-retail'), 10_000_000, 36, 'working_capital', TODAY);
    expect(m.forecast.outcome).toBe('APPROVED');
    expect(m.rate).toBe(19);
    expect(m.currentShare + m.newShare).toBeLessThan(0.25);
    expect(m.freeToLimit).toBeGreaterThan(0);
  });

  it('ИП Иванов: 10 млн выходят за предел, прогноз — встречное 2,5 млн; на 2,5 млн — одобрят', () => {
    const m = safetyMargin(company('ivanov'), 10_000_000, 36, 'working_capital', TODAY);
    expect(m.forecast.outcome).toBe('COUNTER_OFFER');
    expect(m.forecast.approved_amount).toBe(2_500_000);
    expect(m.freeToLimit).toBeLessThan(0);
    const accepted = safetyMargin(company('ivanov'), 2_500_000, 36, 'working_capital', TODAY);
    expect(accepted.forecast.outcome).toBe('APPROVED');
    expect(accepted.freeToLimit).toBeGreaterThanOrEqual(0);
  });

  it('Вектор: текущие долги уже выше предела, прогноз — отказ', () => {
    const m = safetyMargin(company('vector'), 10_000_000, 36, 'working_capital', TODAY);
    expect(m.currentShare).toBeGreaterThan(0.25);
    expect(m.forecast.outcome).toBe('REJECTED');
    expect(m.forecast.rejection_reason).toBe('Высокая долговая нагрузка');
  });
});
