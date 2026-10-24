// Каркас приложения (Фаза 1): шапка, место под шаги и ленту, футер.
// Экраны шагов появятся в Фазах 2–3; сейчас показываем, что API-слой и скоринг работают.

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { USE_MOCK } from './api/client';
import { evaluate } from './api/scoring';
import type { DemoProfile } from './api/types';
import { formatPercent, formatRub } from './lib/format';
import { useStore } from './state/context';

export default function App() {
  const { api, state, resetDemo } = useStore();
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDemoProfiles().then(setProfiles).catch((e: Error) => setError(e.message));
  }, [api]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="inline-block h-6 w-1.5 rounded-full bg-accent" aria-hidden />
            Кредитный кабинет
          </div>
          <button
            type="button"
            onClick={() => void resetDemo()}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-page hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RotateCcw size={16} aria-hidden /> Сбросить демо
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Каркас готов</h1>
          <p className="mt-1 text-muted">
            Режим API: {USE_MOCK ? 'мок (данные в браузере)' : 'настоящий бэкенд'} · текущий шаг: {state.step}
          </p>
          {error && <p className="mt-4 text-accent">{error}</p>}
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {profiles.map((p) => {
              const d = evaluate({ company: p.company, requestedAmount: 10_000_000, termMonths: 36, goal: 'working_capital' }, today);
              return (
                <li key={p.id} className="rounded-xl border border-line p-4">
                  <div className="font-medium">{p.label}</div>
                  <div className="mt-2 text-sm text-muted tabular-nums">
                    Балл {d.score} · {d.rate !== null ? formatPercent(d.rate) : 'ставка не определена'}
                  </div>
                  <div className="mt-1 text-sm tabular-nums">
                    {d.outcome === 'REJECTED' ? `Отказ: ${d.rejection_reason}` : `${d.outcome === 'APPROVED' ? 'Одобрено' : 'Встречное'}: ${formatRub(d.approved_amount ?? 0)}`}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="py-6 text-center">
        <span className="inline-block rounded-full bg-white px-4 py-2 text-xs text-muted shadow-sm">
          Демо: данные синтетические, интеграции смоделированы
        </span>
      </footer>
    </div>
  );
}
