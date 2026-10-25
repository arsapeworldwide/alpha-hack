import { Check } from 'lucide-react';

export interface JourneyItem {
  title: string;
  value: string;
  state: 'done' | 'current' | 'todo';
}

/**
 * Вертикальный путь заявки: каждый пункт показывает не номер, а то, что уже известно
 * («ООО Альфа Ритейл», «10 млн ₽ на 36 месяцев»). Так прогресс и итог читаются одновременно.
 */
export function Stepper({ items }: { items: JourneyItem[] }) {
  return (
    <ol aria-label="Ход заявки">
      {items.map((item, index) => (
        <li key={item.title} className="relative flex gap-4 pb-6 last:pb-0" aria-current={item.state === 'current' ? 'step' : undefined}>
          {index < items.length - 1 && (
            <span className={`absolute left-[11px] top-7 bottom-1 w-px ${item.state === 'done' ? 'bg-ink' : 'bg-line'}`} aria-hidden />
          )}
          <span
            className={`relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              item.state === 'done' ? 'bg-ink text-white' : item.state === 'current' ? 'border-2 border-accent bg-white' : 'border-2 border-line bg-white'
            }`}
            aria-hidden
          >
            {item.state === 'done' && <Check size={14} strokeWidth={3} />}
            {item.state === 'current' && <span className="h-2 w-2 rounded-full bg-accent" />}
          </span>
          <span className="min-w-0">
            <span className={`block text-[15px] font-semibold ${item.state === 'todo' ? 'text-muted' : 'text-ink'}`}>{item.title}</span>
            <span className="mt-0.5 block text-sm text-muted">{item.value}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
