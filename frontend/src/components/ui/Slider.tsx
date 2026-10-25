import { useId, useState, type ReactNode } from 'react';
import { digitsOnly, formatNumber } from '../../lib/format';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Единица справа от числа: «₽», «мес.» */
  unit: string;
  /** Подписи под полем: минимум и максимум */
  minLabel: string;
  maxLabel: string;
  /** Текст для экранных дикторов, например «10 000 000 рублей» */
  valueText: string;
  hint?: ReactNode;
}

/**
 * Поле со слайдером: число можно ввести с клавиатуры или подвинуть слайдер у нижнего края.
 * При вводе вручную значение подравнивается к границам и шагу, когда поле теряет фокус.
 */
export function SliderField({ label, value, min, max, step = 1, onChange, unit, minLabel, maxLabel, valueText, hint }: SliderFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const fill = max === min ? 100 : ((value - min) / (max - min)) * 100;

  function commit() {
    if (draft === null) return;
    const raw = Number(draft || 0);
    const clamped = Math.min(max, Math.max(min, Math.round(raw / step) * step));
    onChange(clamped);
    setDraft(null);
  }

  return (
    <div>
      <div className="relative rounded-2xl bg-surface transition-colors hover:bg-surface-hover focus-within:bg-white focus-within:ring-2 focus-within:ring-ink">
        <label htmlFor={id} className="pointer-events-none absolute left-4 top-2.5 text-[13px] text-muted">{label}</label>
        <div className="flex items-baseline gap-2 px-4 pb-3 pt-7">
          <input
            id={id}
            inputMode="numeric"
            value={draft ?? formatNumber(value)}
            onChange={(e) => setDraft(digitsOnly(e.target.value))}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="w-full min-w-0 bg-transparent text-2xl font-bold tracking-[-0.01em] tabular-nums outline-none"
          />
          <span className="shrink-0 text-xl font-bold text-muted">{unit}</span>
        </div>
        <input
          type="range"
          aria-label={label}
          aria-valuetext={valueText}
          className="range absolute -bottom-[9px] left-3 right-3 w-[calc(100%-24px)]"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ ['--fill' as string]: `${fill}%` }}
          onChange={(e) => {
            setDraft(null);
            onChange(Number(e.target.value));
          }}
        />
      </div>
      <div className="mt-3 flex justify-between px-1 text-[13px] text-muted tabular-nums">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {hint && <div className="mt-2 px-1 text-[13px]">{hint}</div>}
    </div>
  );
}
