// Допустимые переходы статусов заявки. Такая же таблица у бэкенда (domain/state_machine.py).
// Схема: docs/APPLICATION_STATES.md.

import type { ApplicationStatus } from './types';

export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['CHECKING_EGRUL'],
  CHECKING_EGRUL: ['CHECKING_BKI', 'NEEDS_RECHECK'],
  CHECKING_BKI: ['SCORING', 'NEEDS_RECHECK'],
  SCORING: ['APPROVED', 'COUNTER_OFFER', 'REJECTED'],
  NEEDS_RECHECK: ['CHECKING_EGRUL', 'CHECKING_BKI'],
  APPROVED: ['SIGNED'],
  COUNTER_OFFER: ['OFFER_ACCEPTED'],
  OFFER_ACCEPTED: ['SIGNED'],
  SIGNED: ['DISBURSED'],
  REJECTED: [],
  DISBURSED: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Заявка ещё в работе у банка (UI опрашивает сервер). */
export const IN_PROGRESS_STATUSES: ApplicationStatus[] = ['SUBMITTED', 'CHECKING_EGRUL', 'CHECKING_BKI', 'SCORING', 'SIGNED'];

/** Финальные статусы — дальше заявка не меняется. */
export const FINAL_STATUSES: ApplicationStatus[] = ['REJECTED', 'DISBURSED'];

/** Какой шаг wizard показывать для статуса заявки (3 — конвейер, 4 — результат). */
export function stepForStatus(status: ApplicationStatus): 3 | 4 | null {
  switch (status) {
    case 'SUBMITTED':
    case 'CHECKING_EGRUL':
    case 'CHECKING_BKI':
    case 'SCORING':
    case 'NEEDS_RECHECK':
      return 3;
    case 'APPROVED':
    case 'COUNTER_OFFER':
    case 'REJECTED':
    case 'OFFER_ACCEPTED':
    case 'SIGNED':
    case 'DISBURSED':
      return 4;
    default:
      return null;
  }
}
