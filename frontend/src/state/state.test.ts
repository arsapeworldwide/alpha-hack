import { describe, expect, it } from 'vitest';
import { DEMO_PROFILES } from '../api/seed';
import type { Application, ApplicationStatus } from '../api/types';
import { loadState, saveState, UI_KEY } from './persist';
import { feedQuery, initialState, reducer, type AppState } from './reducer';

const alfa = DEMO_PROFILES[0];
const app = (status: ApplicationStatus, id = 'app_1') => ({ id, status }) as Application;

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('reducer', () => {
  it('выбор профиля подставляет компанию; ручная правка меняет данные, профиль остаётся выбранным', () => {
    let s = reducer(initialState, { type: 'SELECT_PROFILE', profile: alfa });
    expect(s.company?.inn).toBe('7712345678');
    expect(s.profileId).toBe('alfa-retail');
    s = reducer(s, { type: 'UPDATE_COMPANY', patch: { annual_revenue: 1 } });
    expect(s.profileId).toBe('alfa-retail');
    expect(s.company?.annual_revenue).toBe(1);
  });

  it('кассовый разрыв подрезает срок до 12 месяцев', () => {
    const s = reducer(initialState, { type: 'SET_FORM', patch: { goal: 'cash_gap' } });
    expect(s.form.termMonths).toBe(12);
  });

  it('на шаг 2 нельзя без компании, на шаг 3 — без заявки', () => {
    expect(reducer(initialState, { type: 'GO_TO_STEP', step: 2 }).step).toBe(1);
    const withCompany = reducer(initialState, { type: 'SELECT_PROFILE', profile: alfa });
    expect(reducer(withCompany, { type: 'GO_TO_STEP', step: 2 }).step).toBe(2);
    expect(reducer(withCompany, { type: 'GO_TO_STEP', step: 3 }).step).toBe(1);
  });

  it('статус заявки определяет шаг: конвейер → результат', () => {
    let s: AppState = reducer(initialState, { type: 'APPLICATION_RECEIVED', application: app('SUBMITTED') });
    expect(s.step).toBe(3);
    s = reducer(s, { type: 'APPLICATION_RECEIVED', application: app('CHECKING_BKI') });
    expect(s.step).toBe(3);
    s = reducer(s, { type: 'APPLICATION_RECEIVED', application: app('APPROVED') });
    expect(s.step).toBe(4);
  });

  it('ответ по чужой (старой) заявке игнорируется', () => {
    const s = reducer(initialState, { type: 'APPLICATION_RECEIVED', application: app('SCORING', 'new') });
    expect(reducer(s, { type: 'APPLICATION_RECEIVED', application: app('APPROVED', 'old') })).toBe(s);
  });

  it('пока заявка есть, назад к анкете нельзя; «Начать заново» снимает заявку', () => {
    let s = reducer(initialState, { type: 'APPLICATION_RECEIVED', application: app('REJECTED') });
    expect(reducer(s, { type: 'GO_TO_STEP', step: 2 }).step).toBe(4);
    s = reducer(s, { type: 'START_OVER' });
    expect(s.step).toBe(1);
    expect(s.applicationId).toBeNull();
  });

  it('открытие заявки из истории подставляет её компанию, условия и шаг', () => {
    const full = {
      id: 'app_old', status: 'COUNTER_OFFER', company: DEMO_PROFILES[1].company,
      requested_amount: 10_000_000, term_months: 24, goal: 'equipment',
    } as Application;
    const s = reducer(initialState, { type: 'OPEN_APPLICATION', application: full });
    expect(s.step).toBe(4);
    expect(s.applicationId).toBe('app_old');
    expect(s.company?.name).toBe('ИП Иванов');
    expect(s.form).toEqual({ requestedAmount: 10_000_000, termMonths: 24, goal: 'equipment' });
  });

  it('лента: сегмент компании, после отказа — режим rejected', () => {
    expect(feedQuery(initialState)).toEqual({ segment: 'general', context: 'default' });
    let s = reducer(initialState, { type: 'SELECT_PROFILE', profile: DEMO_PROFILES[2] });
    expect(feedQuery(s).segment).toBe('production');
    s = reducer(s, { type: 'APPLICATION_RECEIVED', application: app('REJECTED') });
    expect(feedQuery(s).context).toBe('rejected');
  });
});

describe('сохранение состояния', () => {
  it('шаг и id заявки переживают перезагрузку', () => {
    const storage = new MemoryStorage();
    let s = reducer(initialState, { type: 'SELECT_PROFILE', profile: alfa });
    s = reducer(s, { type: 'APPLICATION_RECEIVED', application: app('SCORING') });
    saveState(storage, s);
    const loaded = loadState(storage);
    expect(loaded.step).toBe(3);
    expect(loaded.applicationId).toBe('app_1');
    expect(loaded.company?.name).toBe(alfa.company.name);
    expect(loaded.application).toBeNull();
  });

  it('битые данные → чистый лист', () => {
    const storage = new MemoryStorage();
    storage.setItem(UI_KEY, '{oops');
    expect(loadState(storage)).toEqual(initialState);
  });

  it('шаг 3 без заявки откатывается к калькулятору', () => {
    const storage = new MemoryStorage();
    storage.setItem(UI_KEY, JSON.stringify({ step: 3, company: alfa.company, form: initialState.form, applicationId: null }));
    expect(loadState(storage).step).toBe(2);
  });
});
