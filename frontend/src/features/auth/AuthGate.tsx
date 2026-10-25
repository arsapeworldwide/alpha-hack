import { useEffect, useState, type ReactNode } from 'react';
import { USE_MOCK } from '../../api/client';
import { saveToken, sessionRequest, sessionToken, type DemoAccount, type SessionUser } from '../../api/sessionApi';
import { clearState } from '../../state/persist';
import { Button } from '../../components/ui/Button';
import { BankPanel } from '../bank/BankPanel';

import { AuthContext, mockUser } from './context';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(USE_MOCK ? mockUser : null);
  const [loading, setLoading] = useState(!USE_MOCK && Boolean(sessionToken()));
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (USE_MOCK) return;
    if (sessionToken()) {
      sessionRequest<SessionUser>('/auth/me').then(setUser).catch(() => saveToken(null)).finally(() => setLoading(false));
    }
    sessionRequest<DemoAccount[]>('/auth/demo-accounts').then(setAccounts).catch(() => {});
    const expire = () => { saveToken(null); clearState(window.localStorage); setUser(null); };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);

  async function enter(name: string, secret: string) {
    setSending(true); setError(null);
    try {
      const result = await sessionRequest<{ access_token: string; user: SessionUser }>('/auth/login', 'POST', { login: name, password: secret });
      saveToken(result.access_token);
      clearState(window.localStorage, result.user.login);
      setUser(result.user);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось войти'); }
    finally { setSending(false); }
  }

  async function logout() {
    try { if (!USE_MOCK) await sessionRequest('/auth/logout', 'POST'); }
    finally { saveToken(null); clearState(window.localStorage, user?.login); setUser(USE_MOCK ? mockUser : null); }
  }

  if (loading) return <p className="p-12" role="status">Проверяем сессию…</p>;
  if (!user) return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold">Вход в кредитный кабинет</h1>
      {accounts.length > 0 && <>
        <p className="mt-4 text-muted">Все компании и учётки синтетические. Демо-пароль: demo-credit-2026.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {accounts.map(account => <button key={account.login} disabled={sending} onClick={() => void enter(account.login, 'demo-credit-2026')} className="rounded-2xl border border-line p-5 text-left hover:bg-surface disabled:opacity-50">
            <span className="block font-semibold">Войти как {account.full_name}</span>
            <span className="mt-1 block text-sm text-muted">{account.scenario}</span>
          </button>)}
        </div>
      </>}
      <form className="mt-8 grid max-w-sm gap-4" onSubmit={e => { e.preventDefault(); void enter(login, password); }}>
        <label>Логин<input className="mt-1 block w-full rounded-xl border border-line p-3" autoComplete="username" required value={login} onChange={e => setLogin(e.target.value)} /></label>
        <label>Пароль<input className="mt-1 block w-full rounded-xl border border-line p-3" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <Button type="submit" loading={sending}>Войти</Button>
      </form>
      {error && <p role="alert" className="mt-4 text-accent-dark">{error}</p>}
    </main>
  );
  return <AuthContext.Provider value={{ user, logout }}>{user.role === 'underwriter' ? <BankPanel /> : children}</AuthContext.Provider>;
}
