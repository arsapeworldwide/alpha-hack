import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'link';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-dark disabled:bg-surface disabled:text-muted',
  secondary: 'bg-surface text-ink hover:bg-surface-hover disabled:text-muted',
  link: 'text-ink underline-offset-4 hover:underline disabled:text-muted',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const SIZES = { sm: 'h-10 px-4 text-sm', md: 'h-12 px-6 text-[15px]', lg: 'h-14 px-8 text-base' };

export function Button({ variant = 'primary', size = 'md', loading = false, block = false, icon, className = '', children, disabled, ...rest }: ButtonProps) {
  const sizing = variant === 'link' ? 'h-auto px-0 text-[15px]' : SIZES[size];
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${sizing} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
