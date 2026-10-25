import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { api } from '../api/client';
import { StoreContext, type StoreValue } from './context';
import { clearState, loadState, saveState } from './persist';
import { reducer } from './reducer';
import { useAuth } from '../features/auth/context';

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState(window.localStorage, user.login));

  useEffect(() => {
    saveState(window.localStorage, state, user.login);
  }, [state, user.login]);

  // После перезагрузки на шаге 3–4 подтягиваем свежую версию заявки
  useEffect(() => {
    if (!state.applicationId || state.application) return;
    api
      .getApplication(state.applicationId)
      .then((application) => dispatch({ type: 'APPLICATION_RECEIVED', application, forApplicationId: state.applicationId! }))
      .catch(() => dispatch({ type: 'START_OVER' })); // заявки больше нет (например, после сброса)
  }, [state.applicationId, state.application]);

  const resetDemo = useCallback(async () => {
    try {
      await api.resetDemo();
    } finally {
      clearState(window.localStorage, user.login);
      dispatch({ type: 'RESET_ALL' });
    }
  }, [user.login]);

  const value = useMemo<StoreValue>(() => ({ state, dispatch, api, resetDemo }), [state, resetDemo]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
