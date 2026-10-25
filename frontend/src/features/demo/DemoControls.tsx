import { useEffect, useState } from 'react';
import { USE_MOCK } from '../../api/client';
import { sessionRequest } from '../../api/sessionApi';
import { useAuth } from '../auth/context';

export function DemoControls() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'ok' | 'down' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (USE_MOCK || !user.can_manage_demo) return;
    let cancelled = false;
    const refresh = () => sessionRequest<{ bki: 'ok' | 'down' }>('/demo/failures').then(result => { if (!cancelled) setMode(result.bki); }).catch(() => {});
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [user.can_manage_demo]);
  if (mode === null) return null;
  return <div className="mt-4 rounded-xl bg-surface p-3 text-sm">
    <span>Демо-пульт: БКИ {mode === 'down' ? 'недоступно' : 'работает'}. </span>
    <button disabled={sending} className="font-semibold underline disabled:opacity-50" onClick={() => {
      setSending(true); setError(null);
      void sessionRequest<{ bki: 'ok' | 'down' }>('/demo/failures', 'POST', { bki: mode === 'ok' ? 'down' : 'ok' })
        .then(result => setMode(result.bki)).catch(e => setError(e instanceof Error ? e.message : 'Не удалось переключить'))
        .finally(() => setSending(false));
    }}>{mode === 'ok' ? 'Отключить БКИ' : 'Восстановить БКИ'}</button>
    {error && <p role="alert" className="text-accent-dark">{error}</p>}
  </div>;
}
