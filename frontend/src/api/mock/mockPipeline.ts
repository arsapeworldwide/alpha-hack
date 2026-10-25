// Конвейер проверок мока. Не таймеры, а расчёт по времени: при каждом чтении заявки смотрим,
// сколько прошло с начала прогона, и выставляем нужный этап. Поэтому заявка «догоняет»
// себя даже после перезагрузки страницы — так же бэкенд дозапускает застрявшие заявки при старте.

import { toIsoDate } from '../../lib/dates';
import { STATUS_META } from '../labels';
import { evaluate } from '../scoring';
import type { ApplicationStatus } from '../types';
import type { MockRecord } from './mockDb';

const STAGE_STATUS: ApplicationStatus[] = ['CHECKING_EGRUL', 'CHECKING_BKI', 'SCORING'];
const BKI_INDEX = 1;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function setStatus(record: MockRecord, status: ApplicationStatus, atMs: number): void {
  record.app.status = status;
  record.app.status_label = STATUS_META[status].label;
  record.app.updated_at = iso(atMs);
}

/** Продвигает заявку до состояния на момент now. Возвращает true, если что-то изменилось. */
export function advance(record: MockRecord, now: number, stepMs: number): boolean {
  const before = record.app.status;
  const { run } = record;

  if (run) {
    const { app } = record;
    const elapsedSteps = Math.floor(Math.max(0, now - run.startedAt) / stepMs);
    const current = run.fromIndex + elapsedSteps; // индекс этапа, который идёт сейчас

    for (let i = run.fromIndex; i < app.pipeline.length; i++) {
      const stage = app.pipeline[i];
      const startMs = run.startedAt + (i - run.fromIndex) * stepMs;
      if (i < current) {
        stage.state = 'done';
        stage.started_at = iso(startMs);
        stage.finished_at = iso(startMs + stepMs);
      } else if (i === current) {
        stage.state = 'in_progress';
        stage.started_at = iso(startMs);
        stage.finished_at = null;
      }
    }

    const bkiFinishedMs = run.startedAt + (BKI_INDEX + 1 - run.fromIndex) * stepMs;
    if (run.failBki && current > BKI_INDEX) {
      const bki = app.pipeline[BKI_INDEX];
      bki.state = 'failed';
      bki.finished_at = iso(bkiFinishedMs);
      app.pipeline[BKI_INDEX + 1].state = 'pending';
      app.pipeline[BKI_INDEX + 1].started_at = null;
      app.error_message = 'Бюро кредитных историй временно не отвечает. Это не связано с вашей компанией — повторите проверку.';
      record.run = null;
      setStatus(record, 'NEEDS_RECHECK', bkiFinishedMs);
    } else if (current >= app.pipeline.length) {
      const decidedMs = run.startedAt + (app.pipeline.length - run.fromIndex) * stepMs;
      app.decision = evaluate(
        { company: app.company, requestedAmount: app.requested_amount, termMonths: app.term_months, goal: app.goal },
        toIsoDate(new Date(decidedMs)),
      );
      record.run = null;
      setStatus(record, app.decision.outcome, decidedMs);
    } else if (app.status !== STAGE_STATUS[current]) {
      setStatus(record, STAGE_STATUS[current], run.startedAt + (current - run.fromIndex) * stepMs);
    }
  }

  // Выдача денег — через один шаг после подписания.
  if (record.app.status === 'SIGNED' && record.signedAtMs !== null && now - record.signedAtMs >= stepMs) {
    const at = record.signedAtMs + stepMs;
    record.app.disbursed_at = iso(at);
    setStatus(record, 'DISBURSED', at);
  }

  return record.app.status !== before;
}
