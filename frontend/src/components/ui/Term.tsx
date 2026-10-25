import { useId, type ReactNode } from 'react';

/**
 * Термин с подсказкой: подчёркнутое слово, пояснение появляется при наведении и при фокусе с клавиатуры.
 * Нужен для «ставка», «аннуитет», «переплата» — пользователь не обязан знать банковские слова.
 */
export function Term({ children, explain }: { children: ReactNode; explain: string }) {
  const id = useId();
  return (
    <span className="group relative inline-block">
      <span tabIndex={0} aria-describedby={id} className="cursor-help underline decoration-dotted decoration-1 underline-offset-4 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-current/40">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl bg-ink px-3.5 py-2.5 text-left text-sm font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {explain}
      </span>
    </span>
  );
}
