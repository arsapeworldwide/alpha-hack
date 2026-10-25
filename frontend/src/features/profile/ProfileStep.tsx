import { StepHeading } from '../../components/ui/Panel';
import { useStore } from '../../state/context';
import { CompanySummary } from './CompanySummary';
import { DemoProfiles } from './DemoProfiles';
import { InnLookup } from './InnLookup';

/** Шаг 1. Демо-компания или поиск по ИНН, затем краткая сводка. Кнопка «Продолжить» — в карточке заявки. */
export function ProfileStep() {
  const { state } = useStore();
  return (
    <div>
      <StepHeading title="Кредит для бизнеса" lead="Решение онлайн за несколько секунд. Начните с компании." />
      <DemoProfiles />
      <div className="mt-8">
        <p className="mb-3 text-[15px] font-semibold">Другая компания</p>
        <InnLookup />
      </div>
      {state.company && <CompanySummary company={state.company} />}
    </div>
  );
}
