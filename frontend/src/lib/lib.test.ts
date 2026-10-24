import { describe, expect, it } from 'vitest';
import { annuityPayment, floorTo100k, loanTotals, presentValue, roundHalfUp } from './annuity';
import { addMonths } from './dates';
import { formatMonths, formatNumber, formatPercent, formatRub, formatRubShort } from './format';

describe('annuity', () => {
  it('платёж и приведённая стоимость — обратные операции', () => {
    const p = annuityPayment(1_000_000, 19, 24);
    expect(presentValue(p, 19, 24)).toBeCloseTo(1_000_000, 4);
  });

  it('нулевая ставка делит сумму поровну', () => {
    expect(annuityPayment(1_200_000, 0, 12)).toBe(100_000);
  });

  it('округление half-up', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4999)).toBe(2);
    expect(roundHalfUp(-2.5)).toBe(-3);
  });

  it('округление вниз до 100 000', () => {
    expect(floorTo100k(2_548_884)).toBe(2_500_000);
    expect(floorTo100k(299_999)).toBe(200_000);
    expect(floorTo100k(300_000)).toBe(300_000);
  });

  it('переплата = платёж × срок − сумма', () => {
    const t = loanTotals(10_000_000, 19, 36);
    expect(t.totalPayment).toBe(t.monthlyPayment * 36);
    expect(t.overpayment).toBe(t.totalPayment - 10_000_000);
  });
});

describe('format', () => {
  it('разделяет тысячи пробелами', () => {
    expect(formatNumber(10_000_000)).toBe('10 000 000');
    expect(formatRub(300_000)).toBe('300 000 ₽');
    expect(formatNumber(-112_500)).toBe('−112 500');
  });

  it('коротко: млн и тыс.', () => {
    expect(formatRubShort(10_000_000)).toBe('10 млн ₽');
    expect(formatRubShort(2_500_000)).toBe('2,5 млн ₽');
    expect(formatRubShort(750_000)).toBe('750 тыс. ₽');
  });

  it('проценты и месяцы', () => {
    expect(formatPercent(21.5)).toBe('21,5%');
    expect(formatMonths(1)).toBe('1 месяц');
    expect(formatMonths(3)).toBe('3 месяца');
    expect(formatMonths(12)).toBe('12 месяцев');
    expect(formatMonths(36)).toBe('36 месяцев');
  });
});

describe('dates', () => {
  it('+3 календарных месяца', () => {
    expect(addMonths('2026-10-24', 3)).toBe('2027-01-24');
  });

  it('нет такого дня — берём последний день месяца', () => {
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2027-11-30', 3)).toBe('2028-02-29');
  });
});
