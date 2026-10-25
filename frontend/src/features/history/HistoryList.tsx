import { useEffect, useState } from 'react';
import { STATUS_META } from '../../api/labels';
import type { ApplicationSummary } from '../../api/types';
import { Badge } from '../../components/ui/Badge';
import { formatRubShort } from '../../lib/format';
import { useStore } from '../../state/context';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** «Мои заявки»: история со статусами. Клик открывает заявку на нужном шаге. */
export function HistoryList() {
  const { api, state, dispatch } = useStore();
  const [items, setItems] = useState<ApplicationSummary[]>([]);
  const status = state.application?.status;

  // Обновляем список, когда меняется текущая заявка или её статус
  useEffect(() => {
    let cancelled = false;
    api.listApplications().then((list) => !cancelled && setItems(list)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, state.applicationId, status]);

  if (items.length === 0) return null;

  async function open(id: string) {
    try {
      dispatch({ type: 'OPEN_APPLICATION', application: await api.getApplication(id) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // заявка могла быть удалена сбросом демо — список обновится сам
    }
  }

  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Мои заявки</h2>
      <ul className="mt-5 divide-y divide-line border-y border-line">
        {items.map((it) => {
          const meta = STATUS_META[it.status];
          const current = it.id === state.applicationId;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => void open(it.id)}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-4 text-left transition-colors hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-ink md:grid-cols-[1.4fr_1fr_1fr_auto] md:px-2 ${current ? 'bg-surface/60' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{it.company_name}</span>
                  <span className="block text-sm text-muted">{formatWhen(it.created_at)}</span>
                </span>
                <span className="hidden text-[15px] tabular-nums md:block">
                  {formatRubShort(it.requested_amount)}
                  {it.approved_amount !== null && it.approved_amount !== it.requested_amount && <span className="text-muted"> → {formatRubShort(it.approved_amount)}</span>}
                </span>
                <span className="hidden text-sm text-muted md:block">{current ? 'Открыта сейчас' : ''}</span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
