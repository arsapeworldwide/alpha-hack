import { useEffect, useState } from 'react';
import type { DemoProfile, Segment } from '../../api/types';
import { formatRubShort, initials } from '../../lib/format';
import { useStore } from '../../state/context';
import { riskLevel, sameCompany, type RiskLevel } from './riskLevel';

const RISK: Record<RiskLevel, { text: string; color: string }> = {
  ideal: { text: 'Надёжный', color: 'text-success' },
  medium: { text: 'Средний риск', color: 'text-[#b87700]' },
  risky: { text: 'Высокий риск', color: 'text-accent' },
};

const SEGMENT_SHORT: Record<Segment, string> = { retail: 'Ритейл', services: 'Услуги', production: 'Производство' };


/** Демо-компании одним списком: один клик — и данные заполнены. */
export function DemoProfiles() {
  const { api, state, dispatch } = useStore();
  const [profiles, setProfiles] = useState<DemoProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDemoProfiles().then(setProfiles).catch((e: Error) => setError(e.message));
  }, [api]);

  if (error) return <p className="text-accent-dark">Не удалось загрузить демо-компании: {error}</p>;

  const editedProfile = profiles?.find((p) => p.id === state.profileId && state.company && !sameCompany(state.company, p.company));

  return (
    <div>
    <div role="radiogroup" aria-label="Демо-компании" className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {(profiles ?? [null, null, null]).map((p, i) => {
        if (!p) return <div key={i} className="h-[76px] animate-pulse bg-surface/60" />;
        const selected = state.profileId === p.id;
        // У выбранной компании показываем текущие (возможно, изменённые) данные
        const company = selected && state.company ? state.company : p.company;
        const edited = selected && state.company !== null && !sameCompany(state.company, p.company);
        const risk = RISK[riskLevel(company)];
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => dispatch({ type: 'SELECT_PROFILE', profile: p })}
            className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
              selected ? 'bg-surface' : 'hover:bg-surface/60'
            }`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${selected ? 'bg-ink text-white' : 'bg-surface text-ink'}`} aria-hidden>
              {initials(company.name || p.company.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {company.name || p.company.name}
                {edited && <span className="ml-2 text-sm font-normal text-muted">изменено</span>}
              </span>
              <span className="block text-sm text-muted">{SEGMENT_SHORT[company.segment]}, выручка {formatRubShort(company.annual_revenue)} в год</span>
            </span>
            <span className={`hidden text-sm font-medium sm:block ${risk.color}`}>{risk.text}</span>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-ink' : 'border-line'}`} aria-hidden>
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
          </button>
        );
      })}
    </div>
    {editedProfile && (
      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-sm text-muted">
        Данные изменены вручную — прогноз и решение считаются по ним.
        <button type="button" onClick={() => dispatch({ type: 'SELECT_PROFILE', profile: editedProfile })} className="font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ink">
          Вернуть исходные данные
        </button>
      </p>
    )}
    </div>
  );
}
