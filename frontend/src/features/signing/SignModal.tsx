import { useState, type FormEvent } from 'react';
import { SIGN_CODE } from '../../api/seed';
import { ApiError } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { digitsOnly } from '../../lib/format';
import { useStore } from '../../state/context';

/** Текст ошибки: если сервер не написал остаток попыток, добавляем его из details.attempts_left. */
function signErrorText(err: unknown): string {
  if (!(err instanceof Error)) return 'Не удалось подписать. Попробуйте ещё раз.';
  const left = err instanceof ApiError ? err.details.attempts_left : undefined;
  if (err instanceof ApiError && err.code === 'INVALID_SIGN_CODE' && typeof left === 'number' && !/попыт/i.test(err.message)) {
    return `${err.message.replace(/\.?$/, '.')} Осталось попыток: ${left}.`;
  }
  return err.message;
}

/**
 * Подписание договора кодом. SMS условия кейса запрещают, поэтому демо-код показан прямо в окне.
 * После 5 неверных попыток сервер блокирует подписание (429).
 */
export function SignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { api, state, dispatch } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const app = state.application;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!app || code.length !== 4) return;
    setSending(true);
    setError(null);
    try {
      const signed = await api.sign(app.id, code);
      dispatch({ type: 'APPLICATION_RECEIVED', application: signed });
      setCode('');
      onClose();
    } catch (err) {
      setError(signErrorText(err));
      if (err instanceof ApiError && err.code === 'TOO_MANY_ATTEMPTS') setBlocked(true);
      setCode('');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Подписание договора" locked={sending}>
      <p className="text-[15px] text-muted">Введите код, чтобы подписать кредитный договор простой электронной подписью.</p>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
        <span className="text-sm text-muted">Код для подписания<br />в демо показан здесь — SMS не используются</span>
        <span className="text-[28px] font-bold tracking-[0.3em] tabular-nums">{SIGN_CODE}</span>
      </div>

      <form onSubmit={onSubmit} className="mt-6">
        <label htmlFor="sign-code" className="mb-2 block text-[15px] font-semibold">Код</label>
        <input
          id="sign-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          autoFocus
          disabled={blocked}
          value={code}
          onChange={(e) => setCode(digitsOnly(e.target.value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'sign-error' : undefined}
          className={`h-16 w-full rounded-2xl bg-surface px-5 text-center text-[28px] font-bold tracking-[0.5em] tabular-nums outline-none focus:bg-white focus:ring-2 ${error ? 'ring-2 ring-accent' : 'focus:ring-ink'}`}
        />
        {error && <p id="sign-error" className="mt-2 text-sm text-accent-dark" role="alert">{error}</p>}
        <Button type="submit" size="lg" block className="mt-6" loading={sending} disabled={code.length !== 4 || blocked}>
          Подписать договор
        </Button>
      </form>
    </Modal>
  );
}
