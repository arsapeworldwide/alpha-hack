import { CREDIT_HISTORY_LABELS, SEGMENT_NAMES } from '../../api/labels';
import type { Company, CreditHistory, Segment } from '../../api/types';
import type { FieldError } from '../../api/validation';
import { SelectField, TextField } from '../../components/ui/Field';
import { digitsOnly, formatNumber } from '../../lib/format';
import { useStore } from '../../state/context';

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Редактирование данных компании. Ошибка показывается у того поля, к которому относится. */
export function CompanyForm({ company, error }: { company: Company; error: FieldError | null }) {
  const { dispatch } = useStore();
  const update = (patch: Partial<Company>) => dispatch({ type: 'UPDATE_COMPANY', patch });
  const errorFor = (field: keyof Company) => (error?.field === field ? error.message : null);
  const money = (value: number, allowZero: boolean) => (value === 0 && !allowZero ? '' : formatNumber(value));
  const toNumber = (raw: string) => Number(digitsOnly(raw) || 0);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField label="Название" value={company.name} onChange={(e) => update({ name: e.target.value })} error={errorFor('name')} />
      <TextField label="ИНН" value={company.inn} inputMode="numeric" maxLength={12} onChange={(e) => update({ inn: digitsOnly(e.target.value) })} error={errorFor('inn')} />
      <TextField label="Выручка за год" suffix="₽" inputMode="numeric" value={money(company.annual_revenue, false)} onChange={(e) => update({ annual_revenue: toNumber(e.target.value) })} error={errorFor('annual_revenue')} />
      <TextField label="Платежи по кредитам в месяц" suffix="₽" inputMode="numeric" value={money(company.monthly_payments, true)} onChange={(e) => update({ monthly_payments: toNumber(e.target.value) })} error={errorFor('monthly_payments')} />
      <TextField label="Лет в бизнесе" inputMode="numeric" maxLength={3} value={String(company.business_age_years)} onChange={(e) => update({ business_age_years: toNumber(e.target.value) })} error={errorFor('business_age_years')} />
      <SelectField
        label="Сфера"
        value={company.segment}
        onChange={(e) => update({ segment: e.target.value as Segment })}
        options={(Object.keys(SEGMENT_NAMES) as Segment[]).map((s) => ({ value: s, label: capitalize(SEGMENT_NAMES[s]) }))}
      />
      <div className="md:col-span-2">
        <SelectField
          label="Кредитная история"
          value={company.credit_history}
          onChange={(e) => update({ credit_history: e.target.value as CreditHistory })}
          options={(Object.keys(CREDIT_HISTORY_LABELS) as CreditHistory[]).map((h) => ({ value: h, label: CREDIT_HISTORY_LABELS[h] }))}
          hint="В демо задаётся вручную, в банке приходит из бюро кредитных историй"
        />
      </div>
    </div>
  );
}
