import type { Decision } from '../../api/types';

/** «Что повлияло на решение»: пять факторов скоринга полосками с пояснением простым языком. */
export function FactorList({ decision }: { decision: Pick<Decision, 'score' | 'factors'> }) {
  const score = decision.score;
  const rating = score === null ? '—' : score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';
  return (
    <section aria-labelledby="factors-title">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id="factors-title" className="text-xl font-bold tracking-[-0.01em]">Что повлияло на решение</h2>
        <p className="text-[15px] tabular-nums"><span className="font-bold">{score ?? 'Не рассчитано'}</span> <span className="text-muted">{score === null ? '' : 'из 100 баллов'} · Рейтинг {rating}</span></p>
      </div>
      <ul className="space-y-5">
        {decision.factors.map((f) => {
          const ratio = f.max_points ? f.points / f.max_points : 0;
          return (
            <li key={f.code}>
              <div className="flex items-baseline justify-between gap-4 text-[15px]">
                <span className="font-semibold">{f.name}</span>
                <span className="tabular-nums text-muted">{Number.isInteger(f.points) ? f.points : f.points.toFixed(1).replace('.', ',')} из {f.max_points}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <div className={`h-full rounded-full ${ratio >= 0.6 ? 'bg-ink' : ratio >= 0.3 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${Math.max(ratio * 100, 2)}%` }} />
              </div>
              <p className="mt-1.5 text-sm text-muted">{f.explanation}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
