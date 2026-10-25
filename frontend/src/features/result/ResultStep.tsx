import { Check, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StepHeading } from '../../components/ui/Panel';
import { addMonths } from '../../lib/dates';
import { formatDate, formatRub } from '../../lib/format';
import { useStore } from '../../state/context';
import { OfferSummary } from './OfferSummary';
import { Approved, CounterOffer, Rejected } from './Outcomes';
import { DocumentsStep } from '../documents/DocumentsStep';

/** Шаг 4. Решение и всё, что после него: подписание и выдача. Экран выбирается по статусу заявки. */
export function ResultStep() {
  const { state, dispatch } = useStore();
  const app = state.application;
  const decision = app?.decision;
  if (app?.status === 'INFO_REQUESTED') return <DocumentsStep app={app} />;
  if (app?.status === 'MANUAL_REVIEW') return <StepHeading title="Заявку рассматривает специалист" lead="Сейчас ход за сотрудником банка. Решение появится здесь автоматически; страницу можно не обновлять." />;
  if (!app || !decision) return <StepHeading title="Загружаем решение…" />;

  switch (app.status) {
    case 'APPROVED':
    case 'OFFER_ACCEPTED':
      return <Approved app={app} decision={decision} />;
    case 'COUNTER_OFFER':
      return <CounterOffer app={app} decision={decision} />;
    case 'REJECTED':
      return <Rejected app={app} decision={decision} />;
    case 'SIGNED':
      return (
        <div>
          <StepHeading title="Договор подписан" />
          <p className="flex items-center gap-3 text-lg text-muted" aria-live="polite">
            <Loader2 size={20} className="animate-spin" aria-hidden /> Перечисляем деньги на расчётный счёт…
          </p>
        </div>
      );
    case 'DISBURSED': {
      const firstPayment = addMonths((app.disbursed_at ?? app.updated_at).slice(0, 10), 1);
      return (
        <div className="max-w-[640px]">
          <span className="success-mark flex h-20 w-20 items-center justify-center rounded-full bg-success text-white" aria-hidden>
            <Check size={40} strokeWidth={3} />
          </span>
          <h1 className="mt-8 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[44px]" aria-live="polite">
            Кредит успешно выдан, средства на расчётном счёте!
          </h1>
          <p className="mt-6 text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums">{formatRub(decision.approved_amount ?? 0)}</p>
          <p className="mt-2 text-[15px] text-muted">
            Первый платёж — {formatDate(firstPayment)}, {formatRub(decision.monthly_payment ?? 0)}.
          </p>
          <div className="mt-8"><OfferSummary decision={decision} /></div>
          <Button size="lg" variant="secondary" className="mt-8" onClick={() => dispatch({ type: 'START_OVER' })}>Новая заявка</Button>
        </div>
      );
    }
    default:
      return <StepHeading title="Заявка обрабатывается" />;
  }
}
