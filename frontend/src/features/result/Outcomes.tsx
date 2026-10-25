// Три исхода заявки: одобрено, встречное предложение, отказ.

import { useState } from 'react';
import type { Application, Decision } from '../../api/types';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { StepHeading } from '../../components/ui/Panel';
import { formatDate, formatRub, formatRubShort } from '../../lib/format';
import { useStore } from '../../state/context';
import { safetyMargin } from '../calculator/marginMath';
import { SignModal } from '../signing/SignModal';
import { FactorList } from './FactorList';
import { OfferSummary } from './OfferSummary';

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** Объяснение через «Запас прочности»: какую долю выручки заняли бы платежи по запрошенной сумме. */
function loadExplanation(app: Application): string {
  const m = safetyMargin(app.company, app.requested_amount, app.term_months, app.goal, app.created_at.slice(0, 10));
  return `С платежом по ${formatRubShort(app.requested_amount)} все кредиты занимали бы ${pct(m.currentShare + m.newShare)} месячной выручки, а безопасный предел — 25%.`;
}

function BigAmount({ value, caption }: { value: number; caption: string }) {
  return (
    <div>
      <p className="text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums md:text-[56px]">{formatRub(value)}</p>
      <p className="mt-2 text-[15px] text-muted">{caption}</p>
    </div>
  );
}

export function Approved({ app, decision }: { app: Application; decision: Decision }) {
  const [signing, setSigning] = useState(false);
  const { dispatch } = useStore();
  const accepted = app.status === 'OFFER_ACCEPTED';
  return (
    <div>
      <BackLink label="Изменить условия" onClick={() => dispatch({ type: 'EDIT_CONDITIONS' })} />
      <StepHeading title={accepted ? 'Новые условия приняты' : 'Кредит одобрен'} lead="Осталось подписать договор онлайн — это займёт минуту." />
      <div className="max-w-[640px]">
        <BigAmount value={decision.approved_amount ?? 0} caption={`${app.goal_label}, ставка ${decision.rate}%`} />
        <div className="mt-8"><OfferSummary decision={decision} /></div>
        <Button size="lg" className="mt-8" onClick={() => setSigning(true)}>Подписать договор онлайн</Button>
        <div className="mt-16"><FactorList decision={decision} /></div>
      </div>
      <SignModal open={signing} onClose={() => setSigning(false)} />
    </div>
  );
}

export function CounterOffer({ app, decision }: { app: Application; decision: Decision }) {
  const { api, dispatch } = useStore();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      dispatch({ type: 'APPLICATION_RECEIVED', application: await api.acceptOffer(app.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось. Попробуйте ещё раз.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div>
      <BackLink label="Изменить условия" onClick={() => dispatch({ type: 'EDIT_CONDITIONS' })} />
      <StepHeading
        title="Можем одобрить меньшую сумму"
        lead={`Мы не можем выдать ${formatRubShort(app.requested_amount)}, но одобрили вам ${formatRubShort(decision.approved_amount ?? 0)}.`}
      />
      <div className="max-w-[640px]">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted">Вы просили</p>
            <p className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-muted line-through decoration-2 tabular-nums">{formatRub(app.requested_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Одобрено</p>
            <p className="mt-1 text-[28px] font-bold tracking-[-0.02em] tabular-nums">{formatRub(decision.approved_amount ?? 0)}</p>
          </div>
        </div>
        <p className="mt-6 text-[15px]">{loadExplanation(app)} Сумма {formatRubShort(decision.approved_amount ?? 0)} в этот предел помещается.</p>
        <div className="mt-8"><OfferSummary decision={decision} /></div>
        {error && <p className="mt-4 text-sm text-accent-dark" role="alert">{error}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" loading={accepting} onClick={() => void accept()}>Принять новые условия</Button>
          <Button size="lg" variant="secondary" onClick={() => dispatch({ type: 'EDIT_CONDITIONS' })}>Изменить сумму или срок</Button>
        </div>
        <div className="mt-16"><FactorList decision={decision} /></div>
      </div>
    </div>
  );
}

export function Rejected({ app, decision }: { app: Application; decision: Decision }) {
  const { dispatch } = useStore();
  const isDebt = decision.rejection_reason === 'Высокая долговая нагрузка';
  return (
    <div>
      <BackLink label="Изменить условия" onClick={() => dispatch({ type: 'EDIT_CONDITIONS' })} />
      <StepHeading title="Сейчас не можем одобрить кредит" lead={`Причина: ${decision.rejection_reason?.toLowerCase()}.`} />
      <div className="max-w-[640px]">
        {isDebt && <p className="text-[15px]">{loadExplanation(app)}</p>}

        <h2 className="mt-8 text-xl font-bold tracking-[-0.01em]">Что поможет</h2>
        <ul className="mt-4 space-y-3">
          {decision.recommendations.map((r) => (
            <li key={r} className="flex gap-3 text-[15px]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
        {decision.reapply_date && (
          <p className="mt-6 rounded-2xl bg-surface px-5 py-4 text-[15px]">
            Подать заявку снова можно с <span className="font-semibold">{formatDate(decision.reapply_date)}</span>.
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => dispatch({ type: 'START_OVER' })}>Начать заново</Button>
          <Button size="lg" variant="secondary" onClick={() => document.getElementById('feed-title')?.scrollIntoView({ behavior: 'smooth' })}>
            Советы, как повысить шансы
          </Button>
        </div>
        <div className="mt-16"><FactorList decision={decision} /></div>
      </div>
    </div>
  );
}
