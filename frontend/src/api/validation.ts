// Проверка заявки. Одни и те же правила использует и мок (как сервер), и калькулятор (подсказки в форме).

import { CASH_GAP_MAX_TERM } from './scoring';
import { AMOUNT_LIMITS, TERM_LIMITS } from './seed';
import type { ApplicationCreate, Company } from './types';

export interface FieldError {
  field: string;
  message: string;
}

export const INN_PATTERN = /^(\d{10}|\d{12})$/;

export function validateInn(inn: string): FieldError | null {
  return INN_PATTERN.test(inn) ? null : { field: 'inn', message: 'ИНН — это 10 цифр для компании или 12 цифр для ИП.' };
}

export function validateCompany(c: Company): FieldError | null {
  const innError = validateInn(c.inn);
  if (innError) return innError;
  if (!c.name.trim()) return { field: 'name', message: 'Укажите название компании.' };
  if (!Number.isInteger(c.annual_revenue) || c.annual_revenue < 1) return { field: 'annual_revenue', message: 'Укажите годовую выручку в рублях.' };
  if (c.monthly_payments !== null && (!Number.isInteger(c.monthly_payments) || c.monthly_payments < 0)) return { field: 'monthly_payments', message: 'Платежи по кредитам не могут быть отрицательными.' };
  if (!Number.isInteger(c.business_age_years) || c.business_age_years < 0 || c.business_age_years > 100) return { field: 'business_age_years', message: 'Возраст бизнеса — от 0 до 100 лет.' };
  return null;
}

export function validateApplication(body: ApplicationCreate): FieldError | null {
  if (body.consent === false) return { field: 'consent', message: 'Подтвердите согласие на запрос в БКИ.' };
  const companyError = validateCompany(body.company);
  if (companyError) return companyError;
  const { requested_amount: amount, term_months: term, goal } = body;
  if (!Number.isInteger(amount) || amount < AMOUNT_LIMITS.min || amount > AMOUNT_LIMITS.max) {
    return { field: 'requested_amount', message: 'Сумма кредита — от 300 000 до 15 000 000 ₽.' };
  }
  if (!Number.isInteger(term) || term < TERM_LIMITS.min || term > TERM_LIMITS.max) {
    return { field: 'term_months', message: 'Срок кредита — от 3 до 36 месяцев.' };
  }
  if (goal === 'cash_gap' && term > CASH_GAP_MAX_TERM) {
    return { field: 'term_months', message: 'Для кассового разрыва срок не больше 12 месяцев.' };
  }
  return null;
}
