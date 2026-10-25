// Каркас страницы: демо-полоса, шапка с выбранной компанией, шаг слева, карточка «Ваша заявка» справа,
// «Умная лента» ниже.

import { useState } from 'react';
import { CalculatorStep } from './features/calculator/CalculatorStep';
import { ApplicationCard } from './features/application/ApplicationCard';
import { FeedPanel } from './features/feed/FeedPanel';
import { PendingStep } from './features/pipeline/PendingStep';
import { ProfileStep } from './features/profile/ProfileStep';
import { initials } from './lib/format';
import { useStore } from './state/context';

/** Служебная полоса демо-режима: честно говорит, что данные синтетические, и даёт сброс. */
function DemoBar() {
  const { resetDemo } = useStore();
  const [resetting, setResetting] = useState(false);
  return (
    <div className="bg-ink text-white">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-4 px-4 text-[13px]">
        <span className="truncate text-white/80">Демо-режим: данные синтетические, интеграции смоделированы</span>
        <button
          type="button"
          disabled={resetting}
          onClick={() => {
            setResetting(true);
            void resetDemo().finally(() => setResetting(false));
          }}
          className="shrink-0 font-medium text-white underline-offset-4 hover:underline disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-white"
        >
          {resetting ? 'Сбрасываем…' : 'Сбросить демо'}
        </button>
      </div>
    </div>
  );
}

/** Выбранная компания в шапке — как переключатель аккаунта в интернет-банке. */
function CompanyChip() {
  const { state } = useStore();
  const { company } = state;
  if (!company?.name) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-right sm:block">
        <span className="block text-sm font-semibold leading-tight">{company.name}</span>
        <span className="block text-[13px] text-muted">ИНН {company.inn}</span>
      </span>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-sm font-bold" aria-hidden>{initials(company.name)}</span>
    </div>
  );
}

export default function App() {
  const { state } = useStore();
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBar />
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4">
          <span className="text-xl font-bold tracking-[-0.02em]">Кредитный кабинет</span>
          <CompanyChip />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:gap-16">
          <div className="min-w-0">
            {state.step === 1 && <ProfileStep />}
            {state.step === 2 && <CalculatorStep />}
            {state.step >= 3 && <PendingStep />}
          </div>
          <div className="lg:sticky lg:top-8">
            <ApplicationCard />
          </div>
        </div>

        <div className="mt-24">
          <FeedPanel key={state.company?.segment ?? 'general'} />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-[13px] text-muted">Прототип для хакатона. Не является офертой.</div>
      </footer>
    </div>
  );
}
