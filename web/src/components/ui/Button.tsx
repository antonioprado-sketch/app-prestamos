import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  const base =
    'min-h-11 rounded-xl px-4 py-2.5 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50';
  const variants: Record<Variant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-secondary text-white hover:bg-secondary-dark',
    ghost: 'bg-transparent text-primary hover:bg-primary-light',
    danger: 'bg-danger text-white hover:bg-danger/90',
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span aria-hidden>…</span> : children}
    </button>
  );
}
