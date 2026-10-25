import type { ReactNode } from 'react';
import type { Decision } from '../../api/types';
import { Term } from '../../components/ui/Term';
import { formatMonths, formatPercent, formatRub } from '../../lib/format';

function Row({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Условия одобренного кредита строками. */
export function OfferSummary({ decision }: { decision: Decision }) {
  if (decision.approved_amount === null || decision.rate === null || decision.monthly_payment === null) return null;
  return (
    <dl className="divide-y divide-line border-y border-line text-[15px]">
      <Row label="Срок" value={formatMonths(decision.term_months)} />
      <Row label={<Term explain="Процент за год от суммы кредита. Зависит от цели и результата скоринга.">Ставка</Term>} value={formatPercent(decision.rate)} />
      <Row label={<Term explain="Аннуитетный платёж: одинаковая сумма каждый месяц на весь срок.">Платёж в месяц</Term>} value={formatRub(decision.monthly_payment)} />
      <Row label={<Term explain="Сколько вы заплатите сверх суммы кредита за весь срок.">Переплата</Term>} value={formatRub(decision.overpayment ?? 0)} />
      <Row label="Всего выплатите" value={formatRub(decision.total_payment ?? 0)} />
    </dl>
  );
}
