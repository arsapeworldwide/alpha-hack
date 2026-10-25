import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Нельзя закрыть кликом по фону/Esc (например, пока идёт подписание) */
  locked?: boolean;
}

/** Модальное окно на нативном <dialog>: браузер сам удерживает фокус внутри и закрывает по Esc. */
export function Modal({ open, onClose, title, children, locked = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className="modal m-auto w-[min(640px,calc(100vw-32px))] rounded-3xl bg-white p-0 text-ink backdrop:bg-ink/60"
    >
      <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold leading-tight tracking-[-0.01em]">{title}</h2>
          {!locked && (
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 shrink-0 rounded-full bg-surface p-2 text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ink" aria-label="Закрыть">
              <X size={20} aria-hidden />
            </button>
          )}
        </div>
        {children}
      </div>
    </dialog>
  );
}
