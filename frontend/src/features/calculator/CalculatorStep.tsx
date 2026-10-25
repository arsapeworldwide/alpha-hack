import { CASH_GAP_MAX_TERM } from '../../api/scoring';
import { AMOUNT_LIMITS, TERM_LIMITS } from '../../api/seed';
import { BackLink } from '../../components/ui/BackLink';
import { StepHeading } from '../../components/ui/Panel';
import { SliderField } from '../../components/ui/Slider';
import { formatMonths, formatRubShort } from '../../lib/format';
import { useStore } from '../../state/context';
import { GoalPicker } from './GoalPicker';
import { SafetyMarginPanel } from './SafetyMargin';

/** Шаг 2. Сумма, срок и цель. Платёж и кнопка отправки — в карточке «Ваша заявка». */
export function CalculatorStep() {
  const { state, dispatch } = useStore();
  const { company, form } = state;
  if (!company) return null;
  const maxTerm = form.goal === 'cash_gap' ? CASH_GAP_MAX_TERM : TERM_LIMITS.max;

  return (
    <div>
      <BackLink label="Назад к компании" onClick={() => dispatch({ type: 'GO_TO_STEP', step: 1 })} />
      <StepHeading title="Сумма и срок" lead="Двигайте сумму и срок — ниже видно, как банк оценит нагрузку." />

      <div className="space-y-6">
        <SliderField
          label="Сумма кредита"
          unit="₽"
          value={form.requestedAmount}
          min={AMOUNT_LIMITS.min}
          max={AMOUNT_LIMITS.max}
          step={AMOUNT_LIMITS.step}
          onChange={(requestedAmount) => dispatch({ type: 'SET_FORM', patch: { requestedAmount } })}
          valueText={`${form.requestedAmount} рублей`}
          minLabel={formatRubShort(AMOUNT_LIMITS.min)}
          maxLabel={formatRubShort(AMOUNT_LIMITS.max)}
        />
        <SliderField
          label="Срок"
          unit="мес."
          value={form.termMonths}
          min={TERM_LIMITS.min}
          max={maxTerm}
          onChange={(termMonths) => dispatch({ type: 'SET_FORM', patch: { termMonths } })}
          valueText={formatMonths(form.termMonths)}
          minLabel={formatMonths(TERM_LIMITS.min)}
          maxLabel={formatMonths(maxTerm)}
        />
      </div>

      <div className="mt-10">
        <GoalPicker value={form.goal} onChange={(goal) => dispatch({ type: 'SET_FORM', patch: { goal } })} />
      </div>

      <div className="mt-12">
        <SafetyMarginPanel />
      </div>

    </div>
  );
}
