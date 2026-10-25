import type { BankApplication } from './bankTypes';
import { Badge } from '../../components/ui/Badge';
import { STATUS_META } from '../../api/labels';
import { formatRub } from '../../lib/format';

const RECOMMENDATIONS: Record<string, string> = { APPROVED: 'Одобрить', COUNTER_OFFER: 'Меньшая сумма', REJECTED: 'Отказать' };

export function BankQueue({ items, selected, onSelect }: { items: BankApplication[]; selected: string | null; onSelect: (id: string) => void }) {
  return <section aria-label="Очередь заявок" className="space-y-3">
    {!items.length && <p className="rounded-2xl bg-surface p-5">Нет заявок в этом разделе.</p>}
    {items.map(item => <button key={item.id} onClick={() => onSelect(item.id)} className={`block w-full rounded-2xl border p-5 text-left transition-colors hover:bg-surface ${selected === item.id ? 'border-ink bg-surface' : 'border-line'}`}>
      <span className="mb-2 block font-semibold">{item.company.name}</span>
      <Badge tone={STATUS_META[item.status].tone}>{item.status_label}</Badge>
      <span className="mt-2 block text-sm">{formatRub(item.requested_amount)} · {item.term_months} мес.</span>
      <span className="mt-2 block text-sm text-muted">Ждёт {item.waiting_minutes} мин</span>
      <span className="block text-sm">Система: {item.system_recommendation ? `${RECOMMENDATIONS[item.system_recommendation.outcome]} · ${item.system_recommendation.score} баллов` : 'проверка не завершена'}</span>
      <span className="mt-3 block truncate text-[11px] text-muted">ID {item.id}</span>
    </button>)}
  </section>;
}
