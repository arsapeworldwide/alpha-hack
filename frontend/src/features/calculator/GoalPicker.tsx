import { GOALS } from '../../api/labels';
import { useEffect, useState } from 'react';
import { USE_MOCK } from '../../api/client';
import { sessionRequest } from '../../api/sessionApi';
import { BASE_RATE } from '../../api/scoring';
import type { Goal } from '../../api/types';
import { formatPercent } from '../../lib/format';

const SHORT: Record<Goal, string> = { working_capital: 'Оборотные средства', equipment: 'Оборудование', cash_gap: 'Кассовый разрыв' };

/** Цель кредита — переключатель. Пояснение показываем только у выбранной цели, чтобы не перегружать экран. */
export function GoalPicker({ value, onChange }: { value: Goal; onChange: (goal: Goal) => void }) {
  const [products, setProducts] = useState<{ code: string; goal: Goal; name: string; description: string; base_rate: number }[]>(USE_MOCK ? (Object.keys(GOALS) as Goal[]).map(goal => ({ code: goal, goal, name: GOALS[goal].product, description: GOALS[goal].description, base_rate: BASE_RATE[goal] })) : []);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!USE_MOCK) sessionRequest<typeof products>('/products').then(setProducts).catch(() => setError('Каталог временно недоступен. Обновите страницу.'));
  }, []);
  return (
    <fieldset>
      <legend className="mb-3 text-[15px] font-semibold">Выберите кредитный продукт</legend>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {products.map(product => {
          const goal = product.goal;
          const selected = goal === value;
          return (
            <label
              key={goal}
              className={`cursor-pointer rounded-2xl border border-line px-5 py-4 text-[15px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                selected ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-surface-hover'
              }`}
            >
              <input type="radio" name="goal" value={goal} checked={selected} onChange={() => onChange(goal)} className="sr-only" />
              <span className="block">{product.name}</span><span className="mt-2 block text-sm font-normal">{SHORT[goal]} · от {formatPercent(product.base_rate)}</span>
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
