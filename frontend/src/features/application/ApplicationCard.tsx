// Карточка «Ваша заявка» справа: показывает путь заявки, уже введённые данные и главное действие шага.
// Заменяет абстрактный счётчик «Шаг N из 4».

import { STATUS_META } from '../../api/labels';
import { validateCompany } from '../../api/validation';
import { Button } from '../../components/ui/Button';
import { Stepper, type JourneyItem } from '../../components/ui/Stepper';
import { formatMonths, formatRubShort } from '../../lib/format';
import { useStore } from '../../state/context';
import { BASE_RATE } from '../../api/scoring';
import { safetyMargin } from '../calculator/marginMath';
import { PaymentPreview } from '../calculator/PaymentPreview';
import { useSubmitApplication } from '../calculator/useSubmitApplication';
import { useAuth } from '../auth/context';

function stateFor(step: number, own: number): JourneyItem['state'] {
  return step > own ? 'done' : step === own ? 'current' : 'todo';
}

export function ApplicationCard() {
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const { step, company, form, application } = state;
  const { submit, sending, error, invalid } = useSubmitApplication();
  const companyError = company ? validateCompany(company) : null;
  // Ставка по прогнозу (те же правила, что у банка); null — при таких данных банк откажет и ставку не назначит
  const forecastRate =
    step === 2 && state.bkiConsent && company && company.monthly_payments !== null && company.credit_history !== null && !companyError
      ? safetyMargin(company, form.requestedAmount, form.termMonths, form.goal, new Date().toISOString().slice(0, 10)).forecast.rate
      : null;

  const status = application?.status;
  const decision = application?.decision;
  // Решение «закрыто», когда банк одобрил и клиенту осталось только подписать (встречное ждёт принятия)
  const decided = status === 'APPROVED' || status === 'OFFER_ACCEPTED' || status === 'SIGNED' || status === 'DISBURSED';

  const decisionText =
    !decision || step < 4
      ? 'Онлайн, за несколько секунд'
      : decision.outcome === 'REJECTED'
        ? `Отказ: ${decision.rejection_reason?.toLowerCase()}`
        : `${decision.outcome === 'APPROVED' ? 'Одобрено' : 'Одобрено меньше'}: ${formatRubShort(decision.approved_amount ?? 0)} под ${decision.rate}%`;

  const items: JourneyItem[] = [
    { title: 'Компания', value: company?.name || 'Выберите или найдите по ИНН', state: stateFor(step, 1) },
    { title: 'Сумма и срок', value: step >= 2 ? `${formatRubShort(form.requestedAmount)} на ${formatMonths(form.termMonths)}` : 'Подберёте на следующем шаге', state: stateFor(step, 2) },
    { title: 'Проверка банка', value: status && step === 3 ? STATUS_META[status].label : step > 3 ? 'Пройдена' : 'Реестр, кредитная история, скоринг', state: stateFor(step, 3) },
    { title: 'Решение', value: decisionText, state: decided ? 'done' : stateFor(step, 4) },
  ];
  // После одобрения появляется последний пункт — подписание и деньги
  if (step === 4 && decision && decision.outcome !== 'REJECTED') {
    items.push({
      title: 'Договор и деньги',
      value: status === 'DISBURSED' ? 'Деньги на расчётном счёте' : status === 'SIGNED' ? 'Перечисляем деньги…' : status === 'COUNTER_OFFER' ? 'После принятия условий' : 'Подписание онлайн кодом',
      state: status === 'DISBURSED' ? 'done' : decided ? 'current' : 'todo',
    });
  }

  return (
    <aside aria-labelledby="application-title" className="rounded-3xl border border-line p-6">
      <h2 id="application-title" className="mb-5 text-lg font-bold">Ваша заявка</h2>
      <Stepper items={items} />

      {step === 1 && (
        <div className="mt-6 border-t border-line pt-6">
          <Button size="lg" block disabled={!company || Boolean(companyError)} onClick={() => dispatch({ type: 'GO_TO_STEP', step: 2 })}>
            Продолжить
          </Button>
          {(!company || companyError) && <p className="mt-3 text-center text-sm text-muted">{company ? 'Заполните данные компании' : 'Сначала выберите компанию'}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 border-t border-line pt-6">
          <PaymentPreview amount={form.requestedAmount} termMonths={form.termMonths} rate={forecastRate ?? BASE_RATE[form.goal]} rateIsForecast={forecastRate !== null} />
          <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={state.bkiConsent} onChange={e => dispatch({ type: 'SET_BKI_CONSENT', consent: e.target.checked })} />Даю согласие на запрос кредитной истории в БКИ для этой заявки</label>
          {(invalid || error) && company && <p className="mt-4 rounded-xl bg-[#fde6e4] px-4 py-3 text-sm text-accent-dark" role="alert">{invalid?.message ?? error}</p>}
          <Button size="lg" block className="mt-6" loading={sending} disabled={Boolean(invalid) || user.role !== 'client_owner'} onClick={() => void submit()}>
            Отправить заявку
          </Button>
          {user.role === 'client_accountant' && <p className="mt-3 text-sm">Подать и подписать заявку может руководитель. Откройте существующую заявку из истории.</p>}
          <p className="mt-3 text-center text-[13px] text-muted">Расчёт предварительный, банк подтвердит после проверки</p>
        </div>
      )}
    </aside>
  );
}
