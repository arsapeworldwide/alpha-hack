// Расчёт «Запаса прочности»: какую долю месячной выручки займут платежи по кредитам и что решит банк.
// Используются те же правила, что и в скоринге (docs/SCORING_SPEC.md), поэтому прогноз совпадает с решением.

import { BASE_RATE, evaluate, paymentCapacity } from '../../api/scoring';
import type { Company, Decision, Goal } from '../../api/types';
import { annuityPayment } from '../../lib/annuity';

/** Безопасный предел: платежи по всем кредитам — не больше 25% месячной выручки. */
export const SAFE_SHARE = 0.25;

export interface SafetyMargin {
  monthlyRevenue: number;
  currentPayments: number;
  newPayment: number;
  /** Доли от месячной выручки (0.2 = 20%) */
  currentShare: number;
  newShare: number;
  /** Сколько рублей в месяц остаётся до безопасного предела (отрицательно — превышение) */
  freeToLimit: number;
  rate: number;
  forecast: Decision;
}

export function safetyMargin(company: Company, requestedAmount: number, termMonths: number, goal: Goal, today: string): SafetyMargin {
  if (company.monthly_payments === null) throw new Error('Дождитесь проверки БКИ.');
  const forecast = evaluate({ company, requestedAmount, termMonths, goal }, today);
  // Если банк ставку не назначит (score < 45), показываем платёж по базовой ставке цели
  const rate = forecast.rate ?? BASE_RATE[goal];
  const monthlyRevenue = company.annual_revenue / 12;
  const newPayment = annuityPayment(requestedAmount, rate, termMonths);
  return {
    monthlyRevenue,
    currentPayments: company.monthly_payments,
    newPayment,
    currentShare: company.monthly_payments / monthlyRevenue,
    newShare: newPayment / monthlyRevenue,
    freeToLimit: paymentCapacity(company) - newPayment,
    rate,
    forecast,
  };
}
