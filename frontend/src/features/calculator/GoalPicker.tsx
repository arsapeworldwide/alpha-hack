import { GOALS } from '../../api/labels';
import { BASE_RATE } from '../../api/scoring';
import type { Goal } from '../../api/types';
import { formatPercent } from '../../lib/format';

const SHORT: Record<Goal, string> = { working_capital: 'Оборотные средства', equipment: 'Оборудование', cash_gap: 'Кассовый разрыв' };

/** Цель кредита — переключатель. Пояснение показываем только у выбранной цели, чтобы не перегружать экран. */
export function GoalPicker({ value, onChange }: { value: Goal; onChange: (goal: Goal) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 text-[15px] font-semibold">Цель кредита</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(GOALS) as Goal[]).map((goal) => {
          const selected = goal === value;
          return (
            <label
              key={goal}
              className={`cursor-pointer rounded-full px-5 py-2.5 text-[15px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                selected ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-surface-hover'
              }`}
            >
              <input type="radio" name="goal" value={goal} checked={selected} onChange={() => onChange(goal)} className="sr-only" />
              {SHORT[goal]}
            </label>
          );
        })}
      </div>
      <p className="mt-4 max-w-[60ch] text-[15px] text-muted">
        <span className="font-medium text-ink">Базовая ставка {formatPercent(BASE_RATE[value])}.</span> {GOALS[value].description}
      </p>
    </fieldset>
  );
}
