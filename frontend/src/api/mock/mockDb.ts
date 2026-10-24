// «База данных» мока: одна запись в localStorage. Если хранилище недоступно (приватный режим),
// работаем в памяти — сценарий не ломается, просто не переживёт перезагрузку.

import type { Application } from '../types';

export interface PipelineRun {
  /** Время старта текущего прогона конвейера, мс */
  startedAt: number;
  /** С какого этапа начали (0 — ЕГРЮЛ, 1 — БКИ после повторной проверки) */
  fromIndex: number;
  /** Имитировать сбой БКИ в этом прогоне */
  failBki: boolean;
}

export interface MockRecord {
  app: Application;
  run: PipelineRun | null;
  signedAtMs: number | null;
}

export interface MockDb {
  version: 1;
  records: MockRecord[];
  /** Idempotency-Key → id заявки */
  idempotency: Record<string, string>;
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const DB_KEY = 'credit-cabinet:mock-db:v1';

function emptyDb(): MockDb {
  return { version: 1, records: [], idempotency: {} };
}

export function createDbStore(storage: KeyValueStorage) {
  let memory: MockDb | null = null;

  function load(): MockDb {
    if (memory) return memory;
    try {
      const raw = storage.getItem(DB_KEY);
      const parsed = raw ? (JSON.parse(raw) as MockDb) : null;
      memory = parsed && parsed.version === 1 && Array.isArray(parsed.records) ? parsed : emptyDb();
    } catch {
      memory = emptyDb();
    }
    return memory;
  }

  function save(db: MockDb): void {
    memory = db;
    try {
      storage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      // Хранилище недоступно или переполнено — остаёмся в памяти.
    }
  }

  function clear(): void {
    memory = emptyDb();
    try {
      storage.removeItem(DB_KEY);
    } catch {
      // см. save()
    }
  }

  return { load, save, clear };
}
