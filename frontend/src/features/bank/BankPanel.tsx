import { useEffect, useState } from 'react';
import type { Application } from '../../api/types';
import { sessionRequest } from '../../api/sessionApi';
import { formatRub } from '../../lib/format';
import { FactorList } from '../result/FactorList';
import { useAuth } from '../auth/context';
import { DemoControls } from '../demo/DemoControls';

export function BankPanel() {
  const { user, logout } = useAuth();
  const [queue, setQueue] = useState<Application[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const items = await sessionRequest<Application[]>('/bank/applications');
        const detail = selected ? await sessionRequest<Application>(`/bank/applications/${encodeURIComponent(selected)}`) : null;
        if (!cancelled) { setQueue(items); setApp(detail); setError(null); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Очередь недоступна'); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selected]);

  async function decide(action: 'approve' | 'reject') {
    if (!app) return;
    setSending(true); setActionError(null);
    try {
      const result = await sessionRequest<Application>(`/bank/applications/${app.id}/decision`, 'POST', { action, comment });
      setApp(result);
      setQueue(await sessionRequest<Application[]>('/bank/applications'));
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Решение не сохранено'); }
    finally { setSending(false); }
  }

  const reviewable = app && ['APPROVED', 'COUNTER_OFFER', 'REJECTED', 'NEEDS_RECHECK'].includes(app.status);
  const canApprove = reviewable && app.decision?.score != null && app.decision.score >= 45;
  return <div className="mx-auto max-w-6xl px-6 py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">Рабочее место банка</h1><span>{user.full_name}</span><button onClick={() => void logout()} className="underline">Выйти</button></div>
    <DemoControls />
    <p className="mt-5 text-muted">Автоматическое решение — рекомендация. Ручное решение сохраняется в журнале. Очередь обновляется каждые 2 секунды.</p>
    {error && <p role="alert" className="mt-4 text-accent-dark">{error}</p>}
    {actionError && <p role="alert" className="mt-4 text-accent-dark">{actionError}</p>}
    <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
      <section aria-label="Очередь заявок" className="space-y-3">
        {!queue.length && <p>Нет заявок для рассмотрения.</p>}
        {queue.map(item => <button key={item.id} onClick={() => { setSelected(item.id); setComment(''); setActionError(null); }} className={`block w-full rounded-2xl border p-4 text-left ${selected === item.id ? 'border-ink bg-surface' : 'border-line'}`}>
          <span className="block font-semibold">{item.company.name}</span><span className="block text-sm">{item.status_label} · {formatRub(item.requested_amount)}</span>
          <span className="block text-xs text-muted">{item.id}</span>
        </button>)}
      </section>
      <section aria-label="Карточка заявки">
        {!app && <p>Выберите заявку из очереди.</p>}
        {app && <>
          <h2 className="text-2xl font-bold">{app.company.name}</h2>
          <p className="mt-2">{app.status_label} · {app.goal_label} · {app.term_months} мес.</p>
          <p className="mt-2">Запрошено {formatRub(app.requested_amount)}. Предложено {app.decision?.approved_amount == null ? '—' : formatRub(app.decision.approved_amount)}.</p>
          {app.error_message && <p className="mt-3 text-accent-dark">{app.error_message}</p>}
          {app.decision && <div className="mt-8"><FactorList decision={app.decision} /></div>}
          <label className="mt-6 block">Комментарий клиенту<textarea maxLength={500} value={comment} onChange={e => setComment(e.target.value)} className="mt-2 block w-full rounded-xl border border-line p-3" /></label>
          <p className="mt-2 text-sm text-muted">Одобрение подтверждает исходную сумму по ставке SPEC. При оценке ниже 45 или до скоринга одобрение недоступно.</p>
          <div className="mt-4 flex gap-4"><button disabled={!canApprove || sending} onClick={() => void decide('approve')} className="rounded-xl bg-ink px-5 py-3 text-white disabled:opacity-40">Одобрить</button><button disabled={!reviewable || sending} onClick={() => void decide('reject')} className="rounded-xl border border-line px-5 py-3 disabled:opacity-40">Отказать</button></div>
          {app.decision?.bank_comment && <p className="mt-4">Сохранённый комментарий: {app.decision.bank_comment}</p>}
          <h3 className="mt-8 text-xl font-bold">Журнал событий</h3>
          <p className="mt-2 text-sm text-muted">Предыдущие условия автоматического решения сохранены в событии каждого ручного пересмотра.</p>
          <ul className="mt-3 space-y-2 text-sm">{app.events?.map((event, i) => <li key={i}>{new Date(event.occurred_at).toLocaleString('ru-RU')} · {event.actor} · {event.from_status ?? 'Создание'} → {event.to_status}{event.details.comment ? ` · ${String(event.details.comment)}` : ''}{event.details.reviewer ? ` · ${String(event.details.reviewer)}` : ''}</li>)}</ul>
        </>}
      </section>
    </div>
  </div>;
}
