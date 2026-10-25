import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveToken, sessionRequest, sessionToken } from './sessionApi';

afterEach(() => vi.unstubAllGlobals());

describe('сессия кабинета', () => {
  it('хранит и удаляет токен только в sessionStorage', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    saveToken('token');
    expect(sessionToken()).toBe('token');
    saveToken(null);
    expect(sessionToken()).toBeNull();
  });

  it('ошибка входа сохраняет сообщение сервера и не создаёт событие истечения', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 'UNAUTHORIZED', message: 'Неверный логин или пароль.', details: {},
    }), { status: 401 })));
    await expect(sessionRequest('/auth/login', 'POST', { login: 'unknown', password: 'wrong' }))
      .rejects.toMatchObject({ message: 'Неверный логин или пароль.' });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
