import type { ReactNode } from 'react';
import type { Tone } from '../../api/labels';

const TONES: Record<Tone, string> = {
  success: 'bg-[#e4f5e8] text-[#13792a]',
  warning: 'bg-[#fff1d6] text-[#8a5800]',
  danger: 'bg-[#fde6e4] text-accent-dark',
  neutral: 'bg-surface text-muted',
  info: 'bg-[#e5effd] text-[#1d5fc7]',
};

/** Плашка статуса: мягкий цветной фон и цветной текст. */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-medium ${TONES[tone]}`}>{children}</span>;
}
