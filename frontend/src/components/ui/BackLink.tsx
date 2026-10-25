import { ArrowLeft } from 'lucide-react';

/** Ссылка «назад» над заголовком шага: возвращает на предыдущий шаг, не сбрасывая введённые данные. */
export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 mb-5 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[15px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
    >
      <ArrowLeft size={18} aria-hidden /> {label}
    </button>
  );
}
