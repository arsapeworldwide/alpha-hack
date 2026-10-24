// Единый интерфейс API. Экраны знают только его и не знают, мок за ним или настоящий бэкенд.
// Выбор реализации — переменная VITE_USE_MOCK (по умолчанию true).

import { createHttpApi } from './httpApi';
import { createMockApi } from './mockApi';
import type {
  Application,
  ApplicationCreate,
  ApplicationSummary,
  Company,
  DemoProfile,
  FeedResponse,
  FeedSegment,
  ResetResult,
} from './types';

export interface CreditApi {
  getDemoProfiles(): Promise<DemoProfile[]>;
  lookupCompany(inn: string): Promise<Company>;
  createApplication(body: ApplicationCreate, idempotencyKey: string): Promise<Application>;
  listApplications(): Promise<ApplicationSummary[]>;
  getApplication(id: string): Promise<Application>;
  acceptOffer(id: string): Promise<Application>;
  sign(id: string, code: string): Promise<Application>;
  retry(id: string): Promise<Application>;
  getFeed(segment: FeedSegment, context?: 'default' | 'rejected'): Promise<FeedResponse>;
  resetDemo(): Promise<ResetResult>;
}

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

function createApi(): CreditApi {
  if (!USE_MOCK) return createHttpApi(import.meta.env.VITE_API_BASE_URL || '/api');
  return createMockApi({
    storage: window.localStorage,
    failBki: import.meta.env.VITE_MOCK_BKI_FAILURE === 'true',
  });
}

export const api: CreditApi = createApi();

/** Уникальный ключ на одно нажатие «Отправить» — повтор запроса не создаст дубль заявки. */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
