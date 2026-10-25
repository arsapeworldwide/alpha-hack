// Синтетические данные для мока. Профили и числа — из docs/SCORING_SPEC.md (раздел «Демо-профили»).
// ИНН синтетические; возможны случайные совпадения с реальными.

import type { Company, DemoProfile } from './types';

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: 'alfa-retail',
    label: 'ООО Альфа Ритейл (Идеальный)',
    risk_level: 'ideal',
    company: {
      inn: '7712345678',
      name: 'ООО «Альфа Ритейл»',
      annual_revenue: 180_000_000,
      monthly_payments: 400_000,
      credit_history: 'excellent',
      business_age_years: 7,
      segment: 'retail',
    },
  },
  {
    id: 'ivanov',
    label: 'ИП Иванов (Средний)',
    risk_level: 'medium',
    company: {
      inn: '500100732259',
      name: 'ИП Иванов',
      annual_revenue: 24_000_000,
      monthly_payments: 400_000,
      credit_history: 'fair',
      business_age_years: 3,
      segment: 'services',
    },
  },
  {
    id: 'vector',
    label: 'ООО Вектор (Рискованный)',
    risk_level: 'risky',
    company: {
      inn: '7723456789',
      name: 'ООО «Вектор»',
      annual_revenue: 9_000_000,
      monthly_payments: 300_000,
      credit_history: 'poor',
      business_age_years: 1,
      segment: 'production',
    },
  },
];

/** Синтетический «реестр ЕГРЮЛ» для ручного ввода ИНН: демо-профили + две компании для примера. */
export const REGISTRY: Company[] = [
  ...DEMO_PROFILES.map((p) => p.company),
  {
    inn: '7734567890',
    name: 'ООО «Северный Цех»',
    annual_revenue: 60_000_000,
    monthly_payments: 500_000,
    credit_history: 'excellent',
    business_age_years: 4,
    segment: 'production',
  },
  {
    inn: '500200111111',
    name: 'ИП Смирнова',
    annual_revenue: 12_000_000,
    monthly_payments: 50_000,
    credit_history: 'fair',
    business_age_years: 2,
    segment: 'services',
  },
];

/** Значения калькулятора по умолчанию (FRONTEND_BRIEF). */
export const DEFAULT_REQUEST = {
  requestedAmount: 10_000_000,
  termMonths: 36,
  goal: 'working_capital',
} as const;

export const AMOUNT_LIMITS = { min: 300_000, max: 15_000_000, step: 100_000 } as const;
export const TERM_LIMITS = { min: 3, max: 36 } as const;
export const SIGN_CODE = '1234';
export const MAX_SIGN_ATTEMPTS = 5;
