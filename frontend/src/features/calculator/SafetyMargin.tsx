import { Button } from '../../components/ui/Button';
import { formatRub, formatRubShort } from '../../lib/format';
import { useStore } from '../../state/context';
import { SAFE_SHARE, safetyMargin } from './marginMath';

const pct = (share: number) => `${Math.round(share * 100)}%`;

/**
 * «Запас прочности» — изюминка калькулятора. Показывает, какую часть месячной выручки займут
 * платежи по кредитам, где проходит безопасный предел банка и что банк скорее всего решит.
 * Пользователь видит последствия выбора суммы ещё до отправки заявки.
 */
export function SafetyMarginPanel() {
  const { state, dispatch } = useStore();
  const { company, form } = state;
  if (!company || company.annual_revenue <= 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const m = safetyMargin(company, form.requestedAmount, form.termMonths, form.goal, today);
  const { forecast } = m;

  // Шкала от 0 до 50% выручки (или больше, если долгов уже много): так предел 25% стоит по центру
  const scale = Math.max(0.5, Math.min(1, m.currentShare + m.newShare + 0.05));
  const width = (share: number) => `${Math.min(100, (share / scale) * 100)}%`;
  const over = m.currentShare + m.newShare > SAFE_SHARE;
  // Новый платёж делим на часть до предела (зелёная) и часть сверх предела (красная)
  const newWithin = Math.min(m.newShare, Math.max(0, SAFE_SHARE - m.currentShare));
  const newOver = m.newShare - newWithin;

  const verdict =
    forecast.outcome === 'APPROVED'
      ? { tone: 'text-success', title: 'Скорее всего одобрят', text: `Ставка около ${forecast.rate}%. Платёж помещается в безопасный предел.` }
      : forecast.outcome === 'COUNTER_OFFER'
        ? { tone: 'text-[#b87700]', title: `Скорее всего одобрят меньше — до ${formatRubShort(forecast.approved_amount ?? 0)}`, text: 'Платёж по запрошенной сумме выходит за безопасный предел.' }
        : { tone: 'text-accent', title: `Скорее всего откажут: ${(forecast.rejection_reason ?? '').toLowerCase()}`, text: m.currentShare > SAFE_SHARE ? 'Текущие кредиты уже выше безопасного предела — сначала стоит снизить платежи по ним.' : 'Попробуйте уменьшить сумму или увеличить срок.' };

  return (
    <section aria-labelledby="margin-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="margin-title" className="text-xl font-bold tracking-[-0.01em]">Запас прочности</h2>
        <p className="text-sm text-muted tabular-nums">Выручка в месяц {formatRub(Math.round(m.monthlyRevenue))}</p>
      </div>

      {/* Шкала: текущие платежи + новый платёж относительно выручки, отметка 25% — безопасный предел */}
      <div className="relative mt-4 h-12" role="img" aria-label={`Текущие платежи ${pct(m.currentShare)} выручки, новый платёж ${pct(m.newShare)}, безопасный предел 25%`}>
        <div className="absolute inset-y-2 left-0 right-0 overflow-hidden rounded-lg bg-surface">
          <div className="flex h-full">
            <div className="h-full bg-ink/80 transition-[width] duration-300" style={{ width: width(m.currentShare) }} />
            <div className="h-full bg-success transition-[width] duration-300" style={{ width: width(newWithin) }} />
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: width(newOver) }} />
          </div>
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: width(SAFE_SHARE) }} aria-hidden>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold">25%</span>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink/80" aria-hidden />
          <dt className="text-muted">Текущие платежи</dt>
          <dd className="font-medium tabular-nums">{pct(m.currentShare)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${over ? 'bg-accent' : 'bg-success'}`} aria-hidden />
          <dt className="text-muted">Новый платёж</dt>
          <dd className="font-medium tabular-nums">{pct(m.newShare)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div aria-live="polite">
          <p className={`text-[17px] font-bold ${verdict.tone}`}>{verdict.title}</p>
          <p className="mt-1 text-sm text-muted">
            {verdict.text}{' '}
            {m.freeToLimit >= 0
              ? `До предела остаётся ${formatRub(Math.round(m.freeToLimit))} в месяц.`
              : `Превышение — ${formatRub(Math.round(-m.freeToLimit))} в месяц.`}
          </p>
        </div>
        {forecast.outcome === 'COUNTER_OFFER' && forecast.approved_amount && (
          <Button variant="secondary" className="shrink-0" onClick={() => dispatch({ type: 'SET_FORM', patch: { requestedAmount: forecast.approved_amount! } })}>
            Взять {formatRubShort(forecast.approved_amount)}
          </Button>
        )}
      </div>
    </section>
  );
}
