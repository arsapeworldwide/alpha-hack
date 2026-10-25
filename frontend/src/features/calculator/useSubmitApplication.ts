import { useEffect, useRef, useState } from 'react';
import { newIdempotencyKey } from '../../api/client';
import { validateApplication, type FieldError } from '../../api/validation';
import { useStore } from '../../state/context';

/** Отправка заявки из любого места (кнопка живёт в карточке «Ваша заявка»). */
export function useSubmitApplication(): { submit: () => Promise<void>; sending: boolean; error: string | null; invalid: FieldError | null } {
  const { api, state, dispatch } = useStore();
  const { company, form } = state;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Один ключ на одну попытку отправки: двойной клик или повтор запроса не создадут дубль заявки
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    keyRef.current = null; // условия изменились — это уже новая заявка
    setError(null);
  }, [form, company]);

  const codes = { working_capital: 'WORKING_CAPITAL', equipment: 'INVEST', cash_gap: 'OVERDRAFT' };
  const body = company ? { company, requested_amount: form.requestedAmount, term_months: form.termMonths, goal: form.goal, consent: state.bkiConsent, product_code: codes[form.goal] } : null;
  const invalid = body ? validateApplication(body) : { field: 'company', message: 'Сначала выберите компанию.' };

  async function submit() {
    if (!body || invalid) return;
    keyRef.current ??= newIdempotencyKey();
    setSending(true);
    setError(null);
    try {
      const application = await api.createApplication(body, keyRef.current);
      // Заявка создана — следующая отправка (например, после «Изменить условия») будет новой заявкой.
      // Ключ живёт только пока идёт одна попытка: двойной клик и повтор после сбоя сети не создадут дубль.
      keyRef.current = null;
      dispatch({ type: 'APPLICATION_RECEIVED', application });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  }

  return { submit, sending, error, invalid };
}
