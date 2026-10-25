import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

/** Поле с серой заливкой и подписью внутри, сверху — привычный вид банковских форм. */
function Shell({ id, label, hint, error, suffix, children }: { id: string; label: string; hint?: ReactNode; error?: string | null; suffix?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div
        className={`relative rounded-2xl bg-surface transition-colors focus-within:bg-white focus-within:ring-2 ${
          error ? 'ring-2 ring-accent focus-within:ring-accent' : 'hover:bg-surface-hover focus-within:ring-ink'
        }`}
      >
        <label htmlFor={id} className="pointer-events-none absolute left-4 top-2.5 text-[13px] text-muted">{label}</label>
        {children}
        {suffix && <span className="pointer-events-none absolute bottom-3 right-4 text-muted">{suffix}</span>}
      </div>
      {(error || hint) && <p id={`${id}-hint`} className={`mt-1.5 px-1 text-[13px] ${error ? 'text-accent-dark' : 'text-muted'}`}>{error || hint}</p>}
    </div>
  );
}

const CONTROL = 'block h-16 w-full appearance-none rounded-2xl bg-transparent px-4 pt-6 text-base text-ink tabular-nums outline-none placeholder:text-muted/60';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  suffix?: string;
}

export function TextField({ label, hint, error, suffix, className = '', ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} suffix={suffix}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-hint` : undefined}
        className={`${CONTROL} ${suffix ? 'pr-10' : ''} ${className}`}
        {...rest}
      />
    </Shell>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
}

export function SelectField({ label, hint, options, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} suffix={<ChevronDown size={18} className="-mb-0.5" />}>
      <select id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={`${CONTROL} cursor-pointer pr-10`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Shell>
  );
}
