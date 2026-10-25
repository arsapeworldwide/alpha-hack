import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpApi } from './httpApi';
import { ApiError } from './types';

function mockFetch(status: number, body: unknown, isJson = true) {
  const fn = vi.fn(async () => new Response(isJson ? JSON.stringify(body) : String(body), { status, headers: { 'Content-Type': isJson ? 'application/json' : 'text/html' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('HTTP-клиент (режим VITE_USE_MOCK=false)', () => {
  it('передаёт сессию в Authorization, не меняя тело заявки', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'test-session' });
    const fetch = mockFetch(200, []);
    await createHttpApi('/api').listApplications();
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-session');
  });

  it('401 сообщает оболочке, что нужно вернуться на вход', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    mockFetch(401, { code: 'UNAUTHORIZED', message: 'Войдите', details: {} });
    await expect(createHttpApi('/api').listApplications()).rejects.toBeInstanceOf(ApiError);
    expect(dispatchEvent.mock.calls[0][0].type).toBe('session-expired');
  });
  it('ходит на /api с нужным методом, телом и Idempotency-Key', async () => {
    const fetch = mockFetch(201, { id: 'app_1' });
    const api = createHttpApi('/api');
    await api.createApplication({ company: {} as never, requested_amount: 1, term_months: 3, goal: 'equipment' }, 'key-1');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/applications');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
    expect(JSON.parse(String(init.body)).goal).toBe('equipment');
  });

  it('ошибку по контракту превращает в ApiError с кодом и деталями', async () => {
    mockFetch(400, { code: 'INVALID_SIGN_CODE', message: 'Неверный код. Осталось попыток: 4.', details: { attempts_left: 4 } });
    const error = await createHttpApi('/api').sign('app_1', '0000').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('INVALID_SIGN_CODE');
    expect((error as ApiError).details.attempts_left).toBe(4);
  });

  it('502 от nginx (бэкенд не запущен) — понятное сообщение', async () => {
    mockFetch(502, '<html>Bad Gateway</html>', false);
    const error = (await createHttpApi('/api').getDemoProfiles().catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toMatch(/недоступен/);
  });
});
