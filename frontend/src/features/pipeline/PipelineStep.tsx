import { useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { PipelineStage } from '../../api/types';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { StepHeading } from '../../components/ui/Panel';
import { useStore } from '../../state/context';

const TEXT: Record<PipelineStage['code'], { active: string; done: string }> = {
  egrul: { active: 'Проверяем реквизиты в ЕГРЮЛ…', done: 'Реквизиты совпадают с реестром' },
  bki: { active: 'Запрашиваем кредитную историю в БКИ…', done: 'Кредитная история получена' },
  scoring: { active: 'Считаем риск и условия…', done: 'Скоринг завершён' },
};

function StageRow({ stage }: { stage: PipelineStage }) {
  const { state: s } = stage;
  return (
    <li className="flex items-start gap-4 py-5">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          s === 'done' ? 'stage-done bg-ink text-white' : s === 'failed' ? 'bg-[#fff1d6] text-[#8a5800]' : s === 'in_progress' ? 'bg-surface text-ink' : 'border-2 border-line'
        }`}
        aria-hidden
      >
        {s === 'done' && <Check size={16} strokeWidth={3} />}
        {s === 'in_progress' && <Loader2 size={16} className="animate-spin" />}
        {s === 'failed' && <AlertTriangle size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[17px] font-semibold ${s === 'pending' ? 'text-muted' : ''}`}>{stage.title}</span>
        <span className={`mt-0.5 block text-[15px] ${s === 'failed' ? 'text-[#8a5800]' : 'text-muted'}`}>
          {s === 'done' ? `✅ Готово. ${TEXT[stage.code].done}` : s === 'in_progress' ? <span className="shimmer-text">{TEXT[stage.code].active}</span> : s === 'failed' ? 'Сервис не ответил' : 'В очереди'}
        </span>
      </span>
    </li>
  );
}

/** Шаг 3. Конвейер проверок: этапы двигает сервер, экран только показывает их состояние. */
export function PipelineStep() {
  const { api, state, dispatch } = useStore();
  const app = state.application;
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!app) {
    return <StepHeading title="Загружаем заявку…" />;
  }

  const done = app.pipeline.filter((st) => st.state === 'done').length;
  const progress = Math.round((done / app.pipeline.length) * 100);
  const needsRecheck = app.status === 'NEEDS_RECHECK';

  async function retry() {
    if (!app) return;
    setRetrying(true);
    setRetryError(null);
    try {
      dispatch({ type: 'APPLICATION_RECEIVED', application: await api.retry(app.id) });
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : 'Не получилось. Попробуйте ещё раз.');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div>
      <BackLink label="Отменить и изменить условия" onClick={() => dispatch({ type: 'EDIT_CONDITIONS' })} />
      <StepHeading
        title={needsRecheck ? 'Нужна повторная проверка' : 'Проверяем заявку'}
        lead={needsRecheck ? 'Один из сервисов временно не ответил. С вашей заявкой всё в порядке.' : 'Обычно это занимает несколько секунд. Страницу можно не обновлять.'}
      />

      <div className="max-w-[640px]">
        <div className="h-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Ход проверки">
          <div className={`h-full rounded-full transition-[width] duration-500 ${needsRecheck ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${Math.max(progress, 4)}%` }} />
        </div>

        <ol className="mt-2 divide-y divide-line" aria-live="polite">
          {app.pipeline.map((stage) => <StageRow key={stage.code} stage={stage} />)}
        </ol>

        {needsRecheck && (
          <div className="mt-6 rounded-2xl bg-[#fff1d6] p-5">
            <p className="text-[15px] text-[#6b4500]">{app.error_message}</p>
            {retryError && <p className="mt-2 text-sm text-accent-dark" role="alert">{retryError}</p>}
            <Button className="mt-4" loading={retrying} onClick={() => void retry()}>Повторить проверку</Button>
          </div>
        )}
      </div>
    </div>
  );
}
