// Временный экран для шагов 3–4 (Фаза 2). В Фазе 3 его заменят конвейер проверок и экран решения.

import { Button } from '../../components/ui/Button';
import { StepHeading } from '../../components/ui/Panel';
import { useStore } from '../../state/context';

export function PendingStep() {
  const { dispatch } = useStore();
  return (
    <div>
      <StepHeading title="Заявка отправлена" lead="Экран проверки и решения появится в следующей фазе разработки." />
      <Button variant="secondary" onClick={() => dispatch({ type: 'START_OVER' })}>Начать заново</Button>
    </div>
  );
}
