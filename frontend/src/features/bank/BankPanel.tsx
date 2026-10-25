import { useEffect, useState } from 'react';
import { sessionRequest } from '../../api/sessionApi';
import { formatRub } from '../../lib/format';
import { FactorList } from '../result/FactorList';
import { useAuth } from '../auth/context';
import { DemoControls } from '../demo/DemoControls';
import { BankQueue } from './BankQueue';
import { BankDecisionForm, type BankAction } from './BankDecisionForm';
import type { BankApplication } from './bankTypes';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { STATUS_META } from '../../api/labels';
import { downloadDocument } from '../documents/documentApi';

export function BankPanel() {
  const { user, logout } = useAuth();
  const [queue, setQueue] = useState<BankApplication[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [app, setApp] = useState<BankApplication | null>(null);
  const [view, setView] = useState<'needs_decision' | 'all'>('needs_decision');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const items = await sessionRequest<BankApplication[]>(`/bank/applications?view=${view}`);
        const detail = selected ? await sessionRequest<BankApplication>(`/bank/applications/${encodeURIComponent(selected)}`) : null;
        if (!cancelled) { setQueue(items); setApp(detail); setError(null); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Очередь недоступна'); }
      finally { inFlight = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selected, view]);
  async function decide(data: BankAction) {
    if (!app) return;
    setSending(true); setActionError(null);
    try {
      setApp(await sessionRequest<BankApplication>(`/bank/applications/${app.id}/decision`, 'POST', data));
      setQueue(await sessionRequest<BankApplication[]>(`/bank/applications?view=${view}`));
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Решение не сохранено'); }
    finally { setSending(false); }
  }
  const scoring = app?.decision ?? app?.system_recommendation;
  return <div className="mx-auto max-w-6xl px-6 py-10">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6"><h1 className="text-3xl font-bold">Рабочее место банка</h1><span className="text-sm text-muted">{user.full_name}</span><Button variant="secondary" onClick={() => void logout()}>Выйти</Button></header>
    <DemoControls />
    <div role="tablist" aria-label="Раздел очереди" className="mt-8 flex gap-3">
      <button role="tab" aria-selected={view === 'needs_decision'} className={`rounded-xl px-5 py-3 ${view === 'needs_decision' ? 'bg-ink text-white' : 'bg-surface'}`} onClick={() => setView('needs_decision')}>Требуют решения</button>
      <button role="tab" aria-selected={view === 'all'} className={`rounded-xl px-5 py-3 ${view === 'all' ? 'bg-ink text-white' : 'bg-surface'}`} onClick={() => setView('all')}>Все заявки</button>
    </div>
    {error && <p role="alert" className="mt-4 text-accent-dark">{error}</p>}
    {actionError && <p role="alert" className="mt-4 text-accent-dark">{actionError}</p>}
    <div className="mt-6 grid gap-8 lg:grid-cols-[320px_1fr]">
      <BankQueue items={queue} selected={selected} onSelect={id => { if (!sending) { setSelected(id); setActionError(null); } }} />
      <section aria-label="Карточка заявки" className="rounded-3xl border border-line p-6 md:p-8">
        {!app && <p className="text-muted">Выберите заявку из очереди.</p>}
        {app && <>
          <Badge tone={STATUS_META[app.status].tone}>{app.status_label}</Badge>
          <h2 className="mt-4 text-2xl font-bold">{app.company.name}</h2>
          <p className="mt-2 text-muted">{app.goal_label} · {app.term_months} мес.</p>
          <p className="mt-3 text-lg">Запрошено {formatRub(app.requested_amount)}</p>
          <p className="mt-2">Система рекомендует {app.system_recommendation?.amount ? formatRub(app.system_recommendation.amount) : 'дождаться проверки или отказать'}.</p>
          {app.error_message && <p className="mt-3 text-accent-dark">{app.error_message}</p>}
          {scoring && <div className="mt-8"><FactorList decision={scoring} /></div>}
          <BankDecisionForm key={app.id} app={app} sending={sending} onDecision={data => void decide(data)} />
          {app.decision?.bank_comment && <p className="mt-4 rounded-xl bg-surface p-4">Сохранённый комментарий: {app.decision.bank_comment}</p>}
          {app.requested_documents?.map(document => <p key={document.kind} className="mt-3 text-sm">{document.kind}: {document.uploaded ? 'загружен' : 'ожидается'} {document.document_id !== null && <button className="underline" onClick={() => void downloadDocument(app.id, document.document_id!, true).catch(e => setActionError(e.message))}>Скачать документ</button>}</p>)}
          <h3 className="mt-8 text-xl font-bold">Журнал событий</h3>
          <ul className="mt-3 space-y-3 text-sm text-muted">{app.events?.map((event, i) => <li key={i}>{new Date(event.occurred_at).toLocaleString('ru-RU')} · {event.actor} · {event.from_status ?? 'Создание'} → {event.to_status}{event.details.comment ? ` · ${String(event.details.comment)}` : ''}{event.details.reviewer ? ` · ${String(event.details.reviewer)}` : ''}</li>)}</ul>
        </>}
      </section>
    </div>
  </div>;
}
