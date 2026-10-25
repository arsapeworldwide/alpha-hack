import { ApiError, type ErrorBody } from './types';

export interface SessionUser {
  login: string;
  full_name: string;
  role: 'client_owner' | 'client_accountant' | 'underwriter';
  company_inns: string[];
  can_manage_demo: boolean;
}

export interface DemoAccount {
  login: string;
  full_name: string;
  role: string;
  scenario: string;
}

const TOKEN_KEY = 'credit-cabinet:session';
export const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export function sessionToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function saveToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function sessionRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = sessionToken();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(response.status, data as ErrorBody);
  }
  return data as T;
}
