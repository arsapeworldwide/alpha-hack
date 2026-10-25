// Мок-сервер: та же логика и те же ошибки, что у бэкенда по docs/openapi.yaml, но данные в localStorage.
// Нужен, чтобы фронтенд работал и демонстрировался без бэкенда (VITE_USE_MOCK=true).

import type { CreditApi } from './client';
import { AFTER_REJECTION, FEED_BY_SEGMENT } from './feedSeed';
import { GOALS, SEGMENT_LABELS, SEGMENT_NAMES, STAGE_TITLES, STATUS_META } from './labels';
import { createDbStore, type KeyValueStorage, type MockRecord } from './mock/mockDb';
import { advance, setStatus } from './mock/mockPipeline';
import { DEMO_PROFILES, MAX_SIGN_ATTEMPTS, REGISTRY, SIGN_CODE } from './seed';
import { canTransition } from './stateMachine';
import { ApiError, type Application, type ApplicationStatus, type ErrorCode, type FeedResponse } from './types';
import { validateApplication, validateInn } from './validation';

export interface MockApiOptions {
  storage: KeyValueStorage;
  /** Источник времени (в тестах подменяется) */
  now?: () => number;
  /** Имитация задержки сети, мс */
  latencyMs?: number;
  /** Длительность одного этапа конвейера, мс */
  stepMs?: number;
  /** Имитировать сбой БКИ в первом прогоне каждой заявки */
  failBki?: boolean;
}

function fail(status: number, code: ErrorCode, message: string, details: Record<string, unknown> = {}): never {
  throw new ApiError(status, { code, message, details });
}

const TRANSITION_MESSAGES: Partial<Record<ApplicationStatus, string>> = {
  COUNTER_OFFER: 'Сначала примите встречное предложение.',
  REJECTED: 'По заявке отказ — подписать её нельзя. Можно подать новую заявку.',
  DISBURSED: 'Кредит уже выдан.',
  SIGNED: 'Договор уже подписан.',
};

export function createMockApi(options: MockApiOptions): CreditApi {
  const { storage, now = Date.now, latencyMs = 250, stepMs = 1000, failBki = false } = options;
  const db = createDbStore(storage);

  const delay = () => (latencyMs > 0 ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve());
  const copy = (app: Application): Application => structuredClone(app);

  /** Продвигает все заявки по времени и сохраняет базу. */
  function syncAll() {
    const data = db.load();
    const t = now();
    for (const record of data.records) advance(record, t, stepMs);
    db.save(data);
    return data;
  }

  function findRecord(id: string): MockRecord {
    const record = syncAll().records.find((r) => r.app.id === id);
    if (!record) fail(404, 'NOT_FOUND', 'Заявка не найдена.', { id });
    return record;
  }

  function transition(record: MockRecord, to: ApplicationStatus, action: string): void {
    const from = record.app.status;
    if (!canTransition(from, to)) {
      fail(409, 'INVALID_TRANSITION', TRANSITION_MESSAGES[from] ?? 'Это действие сейчас недоступно для заявки.', { status: from, action });
    }
    setStatus(record, to, now());
  }

  return {
    async getDemoProfiles() {
      await delay();
      return structuredClone(DEMO_PROFILES);
    },

    async lookupCompany(inn) {
      await delay();
      const error = validateInn(inn);
      if (error) fail(422, 'VALIDATION_ERROR', error.message, { field: error.field });
      const company = REGISTRY.find((c) => c.inn === inn);
      if (!company) fail(404, 'COMPANY_NOT_FOUND', 'Компания с таким ИНН не найдена в реестре. Заполните данные вручную.', { inn });
      return structuredClone(company);
    },

    async createApplication(body, idempotencyKey) {
      await delay();
      const data = syncAll();
      const existingId = data.idempotency[idempotencyKey];
      const existing = existingId && data.records.find((r) => r.app.id === existingId);
      if (existing) return copy(existing.app);

      const error = validateApplication(body);
      if (error) fail(422, 'VALIDATION_ERROR', error.message, { field: error.field });

      const t = now();
      const app: Application = {
        id: `app_${t.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        status: 'SUBMITTED',
        status_label: STATUS_META.SUBMITTED.label,
        created_at: new Date(t).toISOString(),
        updated_at: new Date(t).toISOString(),
        company: structuredClone(body.company),
        requested_amount: body.requested_amount,
        term_months: body.term_months,
        goal: body.goal,
        goal_label: GOALS[body.goal].label,
        pipeline: (['egrul', 'bki', 'scoring'] as const).map((code) => ({
          code, title: STAGE_TITLES[code], state: 'pending' as const, started_at: null, finished_at: null,
        })),
        decision: null,
        sign_attempts_left: MAX_SIGN_ATTEMPTS,
        signed_at: null,
        disbursed_at: null,
        error_message: null,
      };
      data.records.push({ app, run: { startedAt: t, fromIndex: 0, failBki }, signedAtMs: null });
      data.idempotency[idempotencyKey] = app.id;
      db.save(data);
      return copy(app);
    },

    async listApplications() {
      await delay();
      return syncAll()
        .records.map(({ app }) => ({
          id: app.id,
          status: app.status,
          status_label: app.status_label,
          created_at: app.created_at,
          company_name: app.company.name,
          requested_amount: app.requested_amount,
          approved_amount: app.decision?.approved_amount ?? null,
          goal: app.goal,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getApplication(id) {
      await delay();
      return copy(findRecord(id).app);
    },

    async acceptOffer(id) {
      await delay();
      const record = findRecord(id);
      transition(record, 'OFFER_ACCEPTED', 'accept-offer');
      db.save(db.load());
      return copy(record.app);
    },

    async sign(id, code) {
      await delay();
      if (!/^\d{4}$/.test(code)) fail(422, 'VALIDATION_ERROR', 'Код — это 4 цифры.', { field: 'code' });
      const record = findRecord(id);
      const { app } = record;
      if (!canTransition(app.status, 'SIGNED')) transition(record, 'SIGNED', 'sign'); // бросит 409 с понятным текстом
      if (app.sign_attempts_left <= 0) fail(429, 'TOO_MANY_ATTEMPTS', 'Попытки ввода кода закончились. Начните новую заявку.', { attempts_left: 0 });

      if (code !== SIGN_CODE) {
        app.sign_attempts_left -= 1;
        db.save(db.load());
        if (app.sign_attempts_left === 0) fail(429, 'TOO_MANY_ATTEMPTS', 'Попытки ввода кода закончились. Начните новую заявку.', { attempts_left: 0 });
        fail(400, 'INVALID_SIGN_CODE', `Неверный код. Осталось попыток: ${app.sign_attempts_left}.`, { attempts_left: app.sign_attempts_left });
      }

      transition(record, 'SIGNED', 'sign');
      record.signedAtMs = now();
      app.signed_at = new Date(record.signedAtMs).toISOString();
      db.save(db.load());
      return copy(app);
    },

    async retry(id) {
      await delay();
      const record = findRecord(id);
      transition(record, 'CHECKING_BKI', 'retry');
      const bki = record.app.pipeline[1];
      bki.state = 'pending';
      bki.started_at = null;
      bki.finished_at = null;
      record.app.error_message = null;
      record.run = { startedAt: now(), fromIndex: 1, failBki: false };
      advance(record, now(), stepMs);
      db.save(db.load());
      return copy(record.app);
    },

    async getFeed(segment, context = 'default') {
      await delay();
      const own = FEED_BY_SEGMENT[segment] ?? FEED_BY_SEGMENT.general;
      const items = context === 'rejected' ? [...AFTER_REJECTION, ...own] : own;
      const reason = segment === 'general'
        ? 'Почему вы это видите: общие материалы для малого бизнеса. Выберите компанию, и лента подстроится под ваш сегмент.'
        : `Почему вы это видите: ваш сегмент — ${SEGMENT_NAMES[segment]}${context === 'rejected' ? '. Первыми показаны советы, как повысить шансы на одобрение' : ''}.`;
      const response: FeedResponse = { segment, segment_label: SEGMENT_LABELS[segment], reason, items: structuredClone(items.slice(0, 5)) };
      return response;
    },

    async resetDemo() {
      await delay();
      const removed = db.load().records.length;
      db.clear();
      return { status: 'ok', removed_applications: removed };
    },
  };
}
