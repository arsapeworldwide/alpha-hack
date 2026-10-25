// Сохранение шага wizard в localStorage, чтобы перезагрузка страницы не теряла заявку.

import type { KeyValueStorage } from '../api/mock/mockDb';
import { initialState, type AppState, type Step } from './reducer';

export const UI_KEY = 'credit-cabinet:ui:v1';

type Saved = Pick<AppState, 'step' | 'profileId' | 'company' | 'form' | 'applicationId'>;

export function saveState(storage: KeyValueStorage, state: AppState): void {
  const saved: Saved = {
    step: state.step,
    profileId: state.profileId,
    company: state.company,
    form: state.form,
    applicationId: state.applicationId,
  };
  try {
    storage.setItem(UI_KEY, JSON.stringify(saved));
  } catch {
    // Хранилище недоступно — просто не сохраняем.
  }
}

function isStep(value: unknown): value is Step {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Загружает сохранённое состояние. Битые или старые данные — начинаем с чистого листа. */
export function loadState(storage: KeyValueStorage): AppState {
  try {
    const raw = storage.getItem(UI_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (!isStep(saved.step) || !saved.form) return initialState;
    const applicationId = typeof saved.applicationId === 'string' ? saved.applicationId : null;
    // Шаги 3–4 без заявки бессмысленны — откатываемся к анкете
    const step: Step = saved.step >= 3 && !applicationId ? (saved.company ? 2 : 1) : saved.step;
    return {
      ...initialState,
      step,
      profileId: saved.profileId ?? null,
      company: saved.company ?? null,
      form: { ...initialState.form, ...saved.form },
      applicationId,
    };
  } catch {
    return initialState;
  }
}

export function clearState(storage: KeyValueStorage): void {
  try {
    storage.removeItem(UI_KEY);
  } catch {
    // см. saveState()
  }
}
