// Уровень риска компании для подписи в списке. Берём прогноз решения банка по тем же правилам,
// что и настоящее решение (запрос по умолчанию: 10 млн ₽ на 36 мес, оборотные средства).
// Только баллов скоринга мало: при выручке 900 ₽ балл может быть «средним», но платить нечем — отказ.

import { evaluate } from '../../api/scoring';
import { DEFAULT_REQUEST } from '../../api/seed';
import type { Company } from '../../api/types';

export type RiskLevel = 'ideal' | 'medium' | 'risky';

export function riskLevel(company: Company): RiskLevel {
  if (company.annual_revenue <= 0) return 'risky';
  const { outcome } = evaluate({ company, ...DEFAULT_REQUEST }, '2000-01-01'); // дата не влияет на исход
  if (outcome === 'APPROVED') return 'ideal';
  if (outcome === 'COUNTER_OFFER') return 'medium';
  return 'risky';
}

/** Совпадают ли данные компании (чтобы показать «изменено», если пользователь их правил). */
export function sameCompany(a: Company, b: Company): boolean {
  return (Object.keys(a) as (keyof Company)[]).every((k) => a[k] === b[k]);
}
