import { useState, type FormEvent } from 'react';
import { validateInn } from '../../api/validation';
import { ApiError } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { digitsOnly } from '../../lib/format';
import { useStore } from '../../state/context';

type Result = { kind: 'not-found' } | { kind: 'error'; message: string } | null;

/** Поиск по ИНН в «ЕГРЮЛ» (симулятор). Не нашли — открываем пустую карточку для ручного заполнения. */
export function InnLookup() {
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
      dispatch({ type: 'SET_COMPANY', company: await api.lookupCompany(inn) });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COMPANY_NOT_FOUND') {
        dispatch({
          type: 'SET_COMPANY',
          company: { inn, name: '', annual_revenue: 0, monthly_payments: 0, credit_history: 'fair', business_age_years: 0, segment: 'services' },
        });
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
          hint={result?.kind === 'not-found' ? 'В реестре не нашли — заполните данные ниже' : 'Например, 7734567890'}
        />
      </div>
      <Button type="submit" variant="secondary" loading={loading} className="h-16 rounded-2xl px-6">Найти</Button>
    </form>
  );
}
