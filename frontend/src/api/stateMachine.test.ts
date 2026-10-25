import { describe, expect, it } from 'vitest';
import { canTransition, FINAL_STATUSES, stepForStatus, TRANSITIONS } from './stateMachine';
import { STATUS_META } from './labels';
import type { ApplicationStatus } from './types';

describe('переходы статусов', () => {
  it('основной путь одобрения разрешён', () => {
    const path: ApplicationStatus[] = ['DRAFT', 'SUBMITTED', 'CHECKING_EGRUL', 'CHECKING_BKI', 'SCORING', 'APPROVED', 'SIGNED', 'DISBURSED'];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it('встречное предложение нельзя подписать без принятия', () => {
    expect(canTransition('COUNTER_OFFER', 'SIGNED')).toBe(false);
    expect(canTransition('COUNTER_OFFER', 'OFFER_ACCEPTED')).toBe(true);
    expect(canTransition('OFFER_ACCEPTED', 'SIGNED')).toBe(true);
  });

  it('из финальных статусов переходов нет', () => {
    for (const s of FINAL_STATUSES) expect(TRANSITIONS[s]).toEqual([]);
  });

  it('этапы нельзя перескочить', () => {
    expect(canTransition('SUBMITTED', 'SCORING')).toBe(false);
    expect(canTransition('CHECKING_EGRUL', 'APPROVED')).toBe(false);
  });

  it('после сбоя БКИ можно вернуться в конвейер', () => {
    expect(canTransition('CHECKING_BKI', 'NEEDS_RECHECK')).toBe(true);
    expect(canTransition('NEEDS_RECHECK', 'CHECKING_BKI')).toBe(true);
  });

  it('у каждого статуса есть название и шаг wizard', () => {
    for (const s of Object.keys(TRANSITIONS) as ApplicationStatus[]) {
      expect(STATUS_META[s].label.length).toBeGreaterThan(0);
      if (s !== 'DRAFT') expect(stepForStatus(s)).not.toBeNull();
    }
  });
});
