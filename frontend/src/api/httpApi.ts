// Реализация CreditApi через fetch к настоящему FastAPI (контракт — docs/openapi.yaml).

import type { CreditApi } from './client';
import { ApiError, type ErrorBody } from './types';

const TIMEOUT_MS = 10_000;

export function createHttpApi(baseUrl: string): CreditApi {
  const base = baseUrl.replace(/\/$/, '');

  async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Сервер не отвечает. Проверьте, что бэкенд запущен, и попробуйте ещё раз.', details: {} });
    } finally {
      clearTimeout(timer);
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, toErrorBody(data, response.status));
    return data as T;
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    getDemoProfiles: () => request('GET', '/demo-profiles'),
    lookupCompany: (inn) => request('GET', `/companies/lookup?inn=${encodeURIComponent(inn)}`),
    createApplication: (body, key) => request('POST', '/applications', body, { 'Idempotency-Key': key }),
    listApplications: () => request('GET', '/applications'),
    getApplication: (appId) => request('GET', `/applications/${id(appId)}`),
    acceptOffer: (appId) => request('POST', `/applications/${id(appId)}/accept-offer`),
    sign: (appId, code) => request('POST', `/applications/${id(appId)}/sign`, { code }),
    retry: (appId) => request('POST', `/applications/${id(appId)}/retry`),
    getFeed: (segment, context = 'default') => request('GET', `/feed?segment=${segment}&context=${context}`),
    resetDemo: () => request('POST', '/demo/reset'),
  };
}

/** Приводит любой ответ с ошибкой к {code, message, details} — даже если сервер вернул не по контракту. */
function toErrorBody(data: unknown, status: number): ErrorBody {
  if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
    const d = data as Partial<ErrorBody>;
    return { code: d.code ?? 'INTERNAL_ERROR', message: String(d.message), details: d.details ?? {} };
  }
  if (status >= 502 && status <= 504) {
    // Ответ не от бэкенда, а от nginx: бэкенд не запущен или не отвечает
    return { code: 'NETWORK_ERROR', message: 'Сервер банка недоступен. Проверьте, что бэкенд запущен, и обновите страницу.', details: { status } };
  }
  return {
    code: status === 404 ? 'NOT_FOUND' : status === 422 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
    message: 'Что-то пошло не так на сервере. Попробуйте ещё раз.',
    details: { status },
  };
}
