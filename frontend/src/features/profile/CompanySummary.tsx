import { CREDIT_HISTORY_LABELS, SEGMENT_NAMES } from '../../api/labels';
import type { Company } from '../../api/types';
import { formatRub } from '../../lib/format';

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Показатели приходят из реестра и доступны только для просмотра. */
export function CompanySummary({ company }: { company: Company }) {
  const facts = [
    ['Выручка за год', formatRub(company.annual_revenue)],
    ['Платежи по кредитам', `${formatRub(company.monthly_payments)} в мес.`],
    ['Кредитная история', CREDIT_HISTORY_LABELS[company.credit_history]],
    ['В бизнесе', `${company.business_age_years} ${company.business_age_years === 1 ? 'год' : company.business_age_years < 5 && company.business_age_years > 1 ? 'года' : 'лет'}`],
    ['Сфера', capitalize(SEGMENT_NAMES[company.segment])],
    ['ИНН', company.inn],
  ];

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold tracking-[-0.01em]">{company.name || 'Новая компания'}</h2>
      </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
              <dd className="mt-1 text-xs text-muted">Источник: {label === 'Кредитная история' || label === 'Платежи по кредитам' ? 'симулятор БКИ' : 'демо-реестр'}</dd>
            </div>
          ))}
        </dl>
      <p className="mt-4 text-sm text-muted">Источники: реквизиты, выручка и возраст — демо-реестр; кредитная история и платежи — симулятор БКИ. Все данные синтетические. Изменить показатели вручную нельзя.</p>
    </section>
  );
}
