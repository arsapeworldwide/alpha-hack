// Денежная математика по docs/SCORING_SPEC.md. Все функции чистые (без побочных эффектов).

/** Небольшой допуск, чтобы 44.4999999 из-за ошибок float округлялось как 44.5. */
const EPSILON = 1e-9;

/** Округление half-up (половина — от нуля), как Decimal ROUND_HALF_UP у бэкенда. */
export function roundHalfUp(value: number): number {
  const rounded = Math.floor(Math.abs(value) + 0.5 + EPSILON);
  return value < 0 ? -rounded : rounded;
}

/** Месячная ставка r = годовая% / 12 / 100. */
export function monthlyRate(annualRatePercent: number): number {
  return annualRatePercent / 12 / 100;
}

/** Аннуитетный платёж P = S*r / (1 − (1+r)^−n). Возвращает дробное значение (без округления). */
export function annuityPayment(amount: number, annualRatePercent: number, termMonths: number): number {
  const r = monthlyRate(annualRatePercent);
  if (r === 0) return amount / termMonths;
  return (amount * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** Приведённая стоимость ежемесячного платежа: сколько можно занять, платя `payment` в месяц. */
export function presentValue(payment: number, annualRatePercent: number, termMonths: number): number {
  const r = monthlyRate(annualRatePercent);
  if (r === 0) return payment * termMonths;
  return (payment * (1 - Math.pow(1 + r, -termMonths))) / r;
}

/** Округление вниз до 100 000 ₽ (для встречного предложения). */
export function floorTo100k(value: number): number {
  return Math.floor(value / 100_000 + EPSILON) * 100_000;
}

export interface LoanTotals {
  monthlyPayment: number;
  totalPayment: number;
  overpayment: number;
}

/** Платёж, сумма выплат и переплата в целых рублях (переплата = P*n − S). */
export function loanTotals(amount: number, annualRatePercent: number, termMonths: number): LoanTotals {
  const monthlyPayment = roundHalfUp(annuityPayment(amount, annualRatePercent, termMonths));
  const totalPayment = monthlyPayment * termMonths;
  return { monthlyPayment, totalPayment, overpayment: totalPayment - amount };
}
