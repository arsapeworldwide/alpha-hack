import { useEffect, useState } from 'react';
import type { DemoProfile, Segment } from '../../api/types';
import { formatRubShort, initials } from '../../lib/format';
import { useStore } from '../../state/context';
import { useAuth } from '../auth/context';
import { USE_MOCK } from '../../api/client';
import { riskLevel, type RiskLevel } from './riskLevel';

const RISK: Record<RiskLevel, { text: string; color: string }> = {
  ideal: { text: 'Надёжный', color: 'text-success' },
  medium: { text: 'Средний риск', color: 'text-[#b87700]' },
  risky: { text: 'Высокий риск', color: 'text-accent' },
};

const SEGMENT_SHORT: Record<Segment, string> = { retail: 'Ритейл', services: 'Услуги', production: 'Производство' };


/** Демо-компании одним списком: один клик — и данные заполнены. */
export function DemoProfiles() {
  const { user } = useAuth();
  const { api, state, dispatch } = useStore();
  const [profiles, setProfiles] = useState<DemoProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDemoProfiles().then(setProfiles).catch((e: Error) => setError(e.message));
  }, [api]);

  if (error) return <p className="text-accent-dark">Не удалось загрузить демо-компании: {error}</p>;

  return (
    <div>
    <div role="radiogroup" aria-label="Демо-компании" className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {(profiles?.filter(p => USE_MOCK || user.company_inns.includes(p.company.inn)) ?? [null, null, null]).map((p, i) => {
        if (!p) return <div key={i} className="h-[76px] animate-pulse bg-surface/60" />;
        const selected = state.profileId === p.id;
        const company = p.company;
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
    </div>
  );
}
