// Скоринг и решение строго по docs/SCORING_SPEC.md. Своих чисел здесь нет — только правила из SPEC.
// Порядок проверки решения важен: см. decide().

import { floorTo100k, loanTotals, presentValue, roundHalfUp } from '../lib/annuity';
import { addMonths } from '../lib/dates';
import type { Company, CreditHistory, Decision, DecisionOutcome, Factor, Goal } from './types';

export interface ScoringInput {
  company: Company;
  requestedAmount: number;
  termMonths: number;
  goal: Goal;
}

export const BASE_RATE: Record<Goal, number> = { working_capital: 19, equipment: 17, cash_gap: 21 };
export const CASH_GAP_MAX_TERM = 12;
export const MIN_SCORE = 45;
export const MIN_COUNTER_OFFER = 300_000;
const DEBT_LIMIT = 0.25;

const HISTORY_POINTS: Record<CreditHistory, number> = { excellent: 35, fair: 20, poor: 0 };

/** d = текущие платежи / месячная выручка. */
export function debtRatio(company: Company): number {
  return company.monthly_payments / (company.annual_revenue / 12);
}

/** Платёжная способность: 25% месячной выручки минус текущие платежи. */
export function paymentCapacity(company: Company): number {
  return DEBT_LIMIT * (company.annual_revenue / 12) - company.monthly_payments;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function revenuePoints(revenue: number): number {
  if (revenue >= 100_000_000) return 20;
  if (revenue >= 50_000_000) return 16;
  if (revenue >= 20_000_000) return 12;
  if (revenue >= 10_000_000) return 8;
  return 4;
}

function agePoints(years: number): number {
  if (years >= 5) return 10;
  if (years >= 3) return 7;
  if (years >= 1) return 4;
  return 0;
}

function amountToRevenuePoints(q: number): number {
  if (q <= 0.1) return 5;
  if (q <= 0.3) return 3;
  if (q <= 0.6) return 1;
  return 0;
}

const HISTORY_TEXT: Record<CreditHistory, string> = {
  excellent: 'Прошлые кредиты гасились без просрочек — это главный плюс для банка.',
  fair: 'В кредитной истории были небольшие просрочки — банк учитывает это осторожно.',
  poor: 'В кредитной истории есть серьёзные просрочки — это сильно снижает оценку.',
};

/** Пять факторов скоринга с баллами и пояснением простым языком. */
export function scoreFactors(input: ScoringInput): Factor[] {
  const { company, requestedAmount } = input;
  const d = debtRatio(company);
  const q = requestedAmount / company.annual_revenue;
  const debt = 30 * clamp(1 - d / DEBT_LIMIT, 0, 1);
  const debtPercent = Math.round(d * 100);

  return [
    { code: 'credit_history', name: 'Кредитная история', points: HISTORY_POINTS[company.credit_history], max_points: 35, explanation: HISTORY_TEXT[company.credit_history] },
    {
      code: 'debt_load',
      name: 'Долговая нагрузка',
      points: debt,
      max_points: 30,
      explanation: d >= DEBT_LIMIT
        ? `Текущие платежи по кредитам — ${debtPercent}% месячной выручки. Это выше безопасного уровня в 25%.`
        : `Текущие платежи по кредитам — ${debtPercent}% месячной выручки. Чем меньше, тем лучше; предел — 25%.`,
    },
    { code: 'revenue', name: 'Выручка', points: revenuePoints(company.annual_revenue), max_points: 20, explanation: 'Чем больше годовая выручка, тем увереннее банк в возврате кредита.' },
    { code: 'business_age', name: 'Возраст бизнеса', points: agePoints(company.business_age_years), max_points: 10, explanation: 'Компании, работающие 5 лет и дольше, получают максимум баллов.' },
    {
      code: 'amount_to_revenue',
      name: 'Сумма к выручке',
      points: amountToRevenuePoints(q),
      max_points: 5,
      explanation: `Кредит составляет ${Math.round(q * 100)}% годовой выручки. Чем меньше доля, тем ниже риск.`,
    },
  ];
}

/** Итоговый балл 0–100: сумма факторов, округлённая half-up. */
export function totalScore(factors: Factor[]): number {
  return roundHalfUp(factors.reduce((sum, f) => sum + f.points, 0));
}

/** Ставка: база по цели + надбавка за риск. null, если score < 45 (кредит не выдаётся). */
export function annualRate(score: number, goal: Goal): number | null {
  if (score >= 80) return BASE_RATE[goal];
  if (score >= 60) return BASE_RATE[goal] + 2.5;
  if (score >= MIN_SCORE) return BASE_RATE[goal] + 5;
  return null;
}

export interface DecideInput {
  score: number;
  capacity: number;
  maxAmount: number | null;
  requestedAmount: number;
}

export interface DecideResult {
  outcome: DecisionOutcome;
  approvedAmount: number | null;
}

/** Решение строго по порядку из SPEC (пункты 1–5). */
export function decide({ score, capacity, maxAmount, requestedAmount }: DecideInput): DecideResult {
  if (score < MIN_SCORE) return { outcome: 'REJECTED', approvedAmount: null };
  if (capacity <= 0 || maxAmount === null) return { outcome: 'REJECTED', approvedAmount: null };
  if (maxAmount >= requestedAmount) return { outcome: 'APPROVED', approvedAmount: requestedAmount };
  const counter = floorTo100k(maxAmount);
  if (counter >= MIN_COUNTER_OFFER) return { outcome: 'COUNTER_OFFER', approvedAmount: counter };
  return { outcome: 'REJECTED', approvedAmount: null };
}

export const REJECTION_REASONS = {
  debt: 'Высокая долговая нагрузка',
  history: 'Слабая кредитная история',
  score: 'Недостаточный уровень надёжности по итогам скоринга',
  amount: 'Запрашиваемая сумма превышает платёжные возможности компании',
} as const;

/** Причина отказа человеческим языком — порядок проверки из SPEC. */
export function rejectionReason(company: Company, score: number): string {
  if (debtRatio(company) > DEBT_LIMIT || paymentCapacity(company) <= 0) return REJECTION_REASONS.debt;
  if (company.credit_history === 'poor') return REJECTION_REASONS.history;
  if (score < MIN_SCORE) return REJECTION_REASONS.score;
  return REJECTION_REASONS.amount;
}

const RECOMMENDATIONS: Record<string, string[]> = {
  [REJECTION_REASONS.debt]: [
    'Погасите или рефинансируйте часть текущих кредитов, чтобы платежи были меньше 25% месячной выручки.',
    'Запросите меньшую сумму или более длинный срок — так ежемесячный платёж станет ниже.',
    'Подайте заявку повторно, когда выручка вырастет или долговая нагрузка снизится.',
  ],
  [REJECTION_REASONS.history]: [
    'Закройте текущие просрочки и платите по действующим кредитам вовремя хотя бы 3 месяца.',
    'Проверьте свою кредитную историю в бюро и исправьте ошибочные записи, если они есть.',
    'Начните с небольшой суммы: аккуратное погашение улучшит историю.',
  ],
  [REJECTION_REASONS.score]: [
    'Уменьшите запрашиваемую сумму относительно выручки.',
    'Снизьте текущую долговую нагрузку перед повторной подачей.',
  ],
  [REJECTION_REASONS.amount]: [
    'Уменьшите сумму кредита или увеличьте срок.',
    'Снизьте текущие платежи по другим кредитам, чтобы освободить платёжную способность.',
  ],
};

/** Полный расчёт решения по заявке. today — дата решения (YYYY-MM-DD) для даты повторной подачи. */
export function evaluate(input: ScoringInput, today: string): Decision {
  const factors = scoreFactors(input).map((f) => ({ ...f, points: Math.round(f.points * 10) / 10 }));
  const score = totalScore(scoreFactors(input));
  const rate = annualRate(score, input.goal);
  const capacity = paymentCapacity(input.company);
  const maxAmount = rate !== null && capacity > 0 ? presentValue(capacity, rate, input.termMonths) : null;
  const { outcome, approvedAmount } = decide({ score, capacity, maxAmount, requestedAmount: input.requestedAmount });

  const base: Decision = {
    outcome,
    score,
    factors,
    rate,
    approved_amount: null,
    term_months: input.termMonths,
    monthly_payment: null,
    total_payment: null,
    overpayment: null,
    max_amount: maxAmount === null ? null : roundHalfUp(maxAmount),
    capacity: roundHalfUp(capacity),
    debt_ratio: Math.round(debtRatio(input.company) * 10_000) / 10_000,
    rejection_reason: null,
    recommendations: [],
    reapply_date: null,
    decided_by: 'system',
    bank_comment: null,
  };

  if (outcome === 'REJECTED' || approvedAmount === null || rate === null) {
    const reason = rejectionReason(input.company, score);
    return { ...base, rejection_reason: reason, recommendations: RECOMMENDATIONS[reason], reapply_date: addMonths(today, 3) };
  }

  const totals = loanTotals(approvedAmount, rate, input.termMonths);
  return {
    ...base,
    approved_amount: approvedAmount,
    monthly_payment: totals.monthlyPayment,
    total_payment: totals.totalPayment,
    overpayment: totals.overpayment,
  };
}
