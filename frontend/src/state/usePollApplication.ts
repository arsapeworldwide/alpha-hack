import { useEffect, useRef } from 'react';
import { useStore } from './context';

export const POLL_INTERVAL_MS = 700;

/**
 * Пока заявка в работе у банка (проверки, скоринг, перечисление денег), раз в 700 мс
 * спрашиваем её статус. Таймеров этапов в интерфейсе нет: этапы двигает сервер (или мок).
 */
export function usePollApplication(): void {
  const { api, state, dispatch } = useStore();
  const id = state.applicationId;
  const status = state.application?.status;
  const active = Boolean(id && status && status !== 'DISBURSED');
  const inFlight = useRef(false);

  useEffect(() => {
    if (!active || !id) return;
    const timer = setInterval(() => {
      if (inFlight.current) return; // не накапливаем запросы, если сервер отвечает медленно
      inFlight.current = true;
      api
        .getApplication(id)
        .then((application) => dispatch({ type: 'APPLICATION_RECEIVED', application }))
        .catch(() => undefined) // временная ошибка сети — попробуем на следующем тике
        .finally(() => {
          inFlight.current = false;
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, id, api, dispatch]);
}
