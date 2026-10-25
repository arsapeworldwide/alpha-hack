import type { ReactNode } from 'react';

/** Серая плашка без тени — основной способ сгруппировать содержимое. */
export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface p-6 md:p-8 ${className}`}>{children}</div>;
}

/** Крупный заголовок шага и одна строка пояснения под ним. */
export function StepHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-8 md:mb-10">
      <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[44px]">{title}</h1>
      {lead && <p className="mt-3 max-w-[56ch] text-lg text-muted">{lead}</p>}
    </div>
  );
}

/** Подзаголовок раздела внутри шага. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-xl font-bold tracking-[-0.01em]">{children}</h2>;
}
