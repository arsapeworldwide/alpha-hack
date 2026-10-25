// Контекст — способ отдать состояние и API любому компоненту без передачи через props.

import { createContext, useContext, type Dispatch } from 'react';
import type { CreditApi } from '../api/client';
import type { Action, AppState } from './reducer';

export interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  api: CreditApi;
  /** Полный сброс демо: очистить заявки на сервере/в моке и состояние экрана */
  resetDemo: () => Promise<void>;
}

export const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore() нужно вызывать внутри <StoreProvider>');
  return value;
}
