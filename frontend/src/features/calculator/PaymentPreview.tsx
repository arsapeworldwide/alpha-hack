import { Term } from '../../components/ui/Term';
import { loanTotals } from '../../lib/annuity';
import { formatPercent, formatRub } from '../../lib/format';

interface PaymentPreviewProps {
  amount: number;
  termMonths: number;
  rate: number;
  /** false — по прогнозу банк ставку не назначит (отказ), считаем по базовой ставке цели */
  rateIsForecast: boolean;
}

/** Предварительный платёж по ставке из прогноза (те же правила, что у банка). Точные условия — после проверки. */
export function PaymentPreview({ amount, termMonths, rate, rateIsForecast }: PaymentPreviewProps) {
  const totals = loanTotals(amount, rate, termMonths);
  return (
    <div aria-live="polite">
      <p className="text-sm text-muted">
        <Term explain="Аннуитетный платёж: одинаковая сумма каждый месяц на весь срок кредита.">Платёж в месяц</Term>
      </p>
      <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] tabular-nums">{formatRub(totals.monthlyPayment)}</p>
      <dl className="mt-4 space-y-1.5 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted"><Term explain="Процент за год. Рассчитан по вашим данным; окончательно банк подтвердит после проверки.">Ставка</Term></dt>
          <dd className="font-medium tabular-nums">{rateIsForecast ? `около ${formatPercent(rate)}` : `базовая ${formatPercent(rate)}`}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted"><Term explain="Сколько вы заплатите сверх суммы кредита за весь срок.">Переплата</Term></dt>
          <dd className="font-medium tabular-nums">{formatRub(totals.overpayment)}</dd>
        </div>
      </dl>
    </div>
  );
}
