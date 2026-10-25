import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from './mockApi';
import { DB_KEY } from './mock/mockDb';
import { DEMO_PROFILES } from './seed';
import { ApiError, type ApplicationCreate } from './types';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const STEP = 1000;
let clock = 0;
let storage: MemoryStorage;
const make = (failBki = false) => createMockApi({ storage, now: () => clock, latencyMs: 0, stepMs: STEP, failBki });

function body(profileId: string, overrides: Partial<ApplicationCreate> = {}): ApplicationCreate {
  const company = DEMO_PROFILES.find((p) => p.id === profileId)!.company;
  return { company, requested_amount: 10_000_000, term_months: 36, goal: 'working_capital', ...overrides };
}

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(status);
  expect((error as ApiError).code).toBe(code);
  return error as ApiError;
}

beforeEach(() => {
  clock = Date.UTC(2026, 9, 24, 9, 0, 0);
  storage = new MemoryStorage();
});

describe('конвейер мока', () => {
  it('ведёт заявку по этапам по 1 секунде и выносит решение', async () => {
    const api = make();
    const created = await api.createApplication(body('alfa-retail'), 'k1');
    expect(created.status).toBe('SUBMITTED');

    const seen: string[] = [];
    for (let t = 0; t <= 3 * STEP; t += STEP / 2) {
      clock += STEP / 2;
      seen.push((await api.getApplication(created.id)).status);
    }
    expect(seen).toContain('CHECKING_EGRUL');
    expect(seen).toContain('CHECKING_BKI');
    expect(seen).toContain('SCORING');
    const final = await api.getApplication(created.id);
    expect(final.status).toBe('APPROVED');
    expect(final.pipeline.every((s) => s.state === 'done')).toBe(true);
    expect(final.decision?.score).toBe(97);
  });

  it('заявка «догоняет» время после перезагрузки (новый экземпляр мока)', async () => {
    const created = await make().createApplication(body('vector'), 'k1');
    clock += 10 * STEP;
    const reloaded = await make().getApplication(created.id);
    expect(reloaded.status).toBe('REJECTED');
    expect(reloaded.decision?.rejection_reason).toBe('Высокая долговая нагрузка');
  });

  it('повтор с тем же Idempotency-Key не создаёт дубль', async () => {
    const api = make();
    const a = await api.createApplication(body('alfa-retail'), 'same');
    const b = await api.createApplication(body('alfa-retail'), 'same');
    expect(b.id).toBe(a.id);
    expect(await api.listApplications()).toHaveLength(1);
  });

  it('проверяет входные данные (кассовый разрыв > 12 мес → 422)', async () => {
    const e = await expectApiError(make().createApplication(body('alfa-retail', { goal: 'cash_gap', term_months: 13 }), 'k'), 422, 'VALIDATION_ERROR');
    expect(e.details.field).toBe('term_months');
  });
});

describe('исходы и подписание', () => {
  it('одобрено → подписание кодом 1234 → выдача через шаг', async () => {
    const api = make();
    const { id } = await api.createApplication(body('alfa-retail'), 'k');
    clock += 3 * STEP;
    const signed = await api.sign(id, '1234');
    expect(signed.status).toBe('SIGNED');
    clock += STEP;
    expect((await api.getApplication(id)).status).toBe('DISBURSED');
  });

  it('встречное предложение: без принятия подписать нельзя (409), после — можно', async () => {
    const api = make();
    const { id } = await api.createApplication(body('ivanov'), 'k');
    clock += 3 * STEP;
    const app = await api.getApplication(id);
    expect(app.status).toBe('COUNTER_OFFER');
    expect(app.decision?.approved_amount).toBe(2_500_000);
    await expectApiError(api.sign(id, '1234'), 409, 'INVALID_TRANSITION');
    expect((await api.acceptOffer(id)).status).toBe('OFFER_ACCEPTED');
    expect((await api.sign(id, '1234')).status).toBe('SIGNED');
  });

  it('неверный код: 400 с остатком попыток, на пятой ошибке — 429', async () => {
    const api = make();
    const { id } = await api.createApplication(body('alfa-retail'), 'k');
    clock += 3 * STEP;
    for (let left = 4; left >= 1; left--) {
      const e = await expectApiError(api.sign(id, '0000'), 400, 'INVALID_SIGN_CODE');
      expect(e.details.attempts_left).toBe(left);
    }
    await expectApiError(api.sign(id, '0000'), 429, 'TOO_MANY_ATTEMPTS');
    await expectApiError(api.sign(id, '1234'), 429, 'TOO_MANY_ATTEMPTS');
  });

  it('по отказу подписание недоступно', async () => {
    const api = make();
    const { id } = await api.createApplication(body('vector'), 'k');
    clock += 3 * STEP;
    await expectApiError(api.sign(id, '1234'), 409, 'INVALID_TRANSITION');
  });
});

describe('сбой БКИ и повторная проверка', () => {
  it('NEEDS_RECHECK → retry → решение', async () => {
    const api = make(true);
    const { id } = await api.createApplication(body('alfa-retail'), 'k');
    clock += 3 * STEP;
    const failed = await api.getApplication(id);
    expect(failed.status).toBe('NEEDS_RECHECK');
    expect(failed.pipeline[1].state).toBe('failed');
    expect(failed.error_message).toBeTruthy();

    expect((await api.retry(id)).status).toBe('CHECKING_BKI');
    clock += 2 * STEP;
    expect((await api.getApplication(id)).status).toBe('APPROVED');
  });

  it('retry из другого статуса → 409', async () => {
    const api = make();
    const { id } = await api.createApplication(body('alfa-retail'), 'k');
    clock += 3 * STEP;
    await expectApiError(api.retry(id), 409, 'INVALID_TRANSITION');
  });
});

describe('справочники, лента, сброс', () => {
  it('поиск по ИНН: найдено / 404 / 422', async () => {
    const api = make();
    expect((await api.lookupCompany('7712345678')).name).toBe('ООО «Альфа Ритейл»');
    await expectApiError(api.lookupCompany('7700000000'), 404, 'COMPANY_NOT_FOUND');
    await expectApiError(api.lookupCompany('123'), 422, 'VALIDATION_ERROR');
  });

  it('лента: после отказа первыми идут советы', async () => {
    const api = make();
    const normal = await api.getFeed('production');
    const rejected = await api.getFeed('production', 'rejected');
    expect(normal.segment_label).toBe('Для производства');
    expect(rejected.items[0].id).not.toBe(normal.items[0].id);
    expect(rejected.items.every((i) => i.synthetic)).toBe(true);
  });

  it('сброс удаляет заявки', async () => {
    const api = make();
    await api.createApplication(body('alfa-retail'), 'k');
    expect((await api.resetDemo()).removed_applications).toBe(1);
    expect(storage.getItem(DB_KEY)).toBeNull();
    expect(await api.listApplications()).toHaveLength(0);
  });

  it('несуществующая заявка → 404', async () => {
    await expectApiError(make().getApplication('nope'), 404, 'NOT_FOUND');
  });
});
