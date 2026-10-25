// Состояние wizard. Reducer — чистая функция: (старое состояние, действие) → новое состояние.
// Так все изменения в одном месте и легко тестируются.

import { CASH_GAP_MAX_TERM } from '../api/scoring';
import { DEFAULT_REQUEST } from '../api/seed';
import { stepForStatus } from '../api/stateMachine';
import type { Application, Company, DemoProfile, FeedSegment, Goal } from '../api/types';

export type Step = 1 | 2 | 3 | 4;

export interface FormState {
  requestedAmount: number;
  termMonths: number;
  goal: Goal;
}

export interface AppState {
  step: Step;
  /** Выбранный демо-профиль (null — ручной ввод) */
  profileId: string | null;
  company: Company | null;
  form: FormState;
  applicationId: string | null;
  /** Последняя версия заявки с сервера (не сохраняется — при загрузке запрашиваем заново) */
  application: Application | null;
}

export type Action =
  | { type: 'SELECT_PROFILE'; profile: DemoProfile }
  | { type: 'SET_COMPANY'; company: Company | null }
  | { type: 'UPDATE_COMPANY'; patch: Partial<Company> }
  | { type: 'SET_FORM'; patch: Partial<FormState> }
  | { type: 'GO_TO_STEP'; step: Step }
  | { type: 'APPLICATION_RECEIVED'; application: Application }
  | { type: 'OPEN_APPLICATION'; application: Application }
  | { type: 'START_OVER' }
  | { type: 'RESET_ALL' };

export const initialState: AppState = {
  step: 1,
  profileId: null,
  company: null,
  form: { ...DEFAULT_REQUEST },
  applicationId: null,
  application: null,
};

/** Для кассового разрыва срок не больше 12 месяцев — подрезаем автоматически. */
function normalizeForm(form: FormState): FormState {
  if (form.goal === 'cash_gap' && form.termMonths > CASH_GAP_MAX_TERM) {
    return { ...form, termMonths: CASH_GAP_MAX_TERM };
  }
  return form;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SELECT_PROFILE':
      return { ...state, profileId: action.profile.id, company: { ...action.profile.company } };

    case 'SET_COMPANY':
      return { ...state, profileId: null, company: action.company };

    case 'UPDATE_COMPANY':
      if (!state.company) return state;
      // Правка карточки вручную — это уже не «чистый» демо-профиль
      return { ...state, profileId: null, company: { ...state.company, ...action.patch } };

    case 'SET_FORM':
      return { ...state, form: normalizeForm({ ...state.form, ...action.patch }) };

    case 'GO_TO_STEP': {
      const { step } = action;
      if (step === 2 && !state.company) return state;
      if (step >= 3 && !state.applicationId) return state;
      // Пока заявка в работе, назад к анкете не уходим — сначала «Начать заново»
      if (step <= 2 && state.applicationId) return state;
      return { ...state, step };
    }

    case 'APPLICATION_RECEIVED': {
      const { application } = action;
      // Игнорируем ответ по старой заявке, если пользователь уже начал новую
      if (state.applicationId && state.applicationId !== application.id) return state;
      const step = stepForStatus(application.status) ?? state.step;
      return { ...state, applicationId: application.id, application, step };
    }

    case 'OPEN_APPLICATION': {
      // Открыть заявку из «Моих заявок»: подставляем её компанию и условия, шаг — по статусу
      const { application } = action;
      return {
        ...state,
        profileId: null,
        company: application.company,
        form: { requestedAmount: application.requested_amount, termMonths: application.term_months, goal: application.goal },
        applicationId: application.id,
        application,
        step: stepForStatus(application.status) ?? 4,
      };
    }

    case 'START_OVER':
      return { ...state, step: 1, applicationId: null, application: null };

    case 'RESET_ALL':
      return initialState;

    default:
      return state;
  }
}

/** Какой сегмент ленты показывать и в каком режиме. */
export function feedQuery(state: AppState): { segment: FeedSegment; context: 'default' | 'rejected' } {
  return {
    segment: state.company?.segment ?? 'general',
    context: state.application?.status === 'REJECTED' ? 'rejected' : 'default',
  };
}
