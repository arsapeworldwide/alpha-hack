import { useState, type FormEvent } from 'react';
import { validateInn } from '../../api/validation';
import { ApiError } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { digitsOnly } from '../../lib/format';
import { useStore } from '../../state/context';
import { useAuth } from '../auth/context';
import { USE_MOCK } from '../../api/client';

type Result = { kind: 'not-found' } | { kind: 'error'; message: string } | null;

/** Принимаем только компании, найденные в демо-реестре. */
export function InnLookup() {
  const { user } = useAuth();
  const { api, dispatch } = useStore();
  const [inn, setInn] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateInn(inn);
    if (invalid) {
      setResult({ kind: 'error', message: invalid.message });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const company = await api.lookupCompany(inn);
      if (!USE_MOCK && !user.company_inns.includes(company.inn)) throw new Error('Эта компания недоступна вашей учётной записи.');
      dispatch({ type: 'SET_COMPANY', company });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COMPANY_NOT_FOUND') {
        dispatch({ type: 'SET_COMPANY', company: null });
        setResult({ kind: 'not-found' });
      } else {
        setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Поиск не удался. Попробуйте ещё раз.' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <TextField
          label="ИНН компании или ИП"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={inn}
          onChange={(e) => setInn(digitsOnly(e.target.value))}
          error={result?.kind === 'error' ? result.message : null}
          hint={result?.kind === 'not-found' ? 'В демо-реестре не нашли. Проверьте ИНН или выберите демо-компанию.' : 'Например, 7734567890'}
        />
      </div>
      <Button type="submit" variant="secondary" loading={loading} className="h-16 rounded-2xl px-6">Найти</Button>
    </form>
  );
}
