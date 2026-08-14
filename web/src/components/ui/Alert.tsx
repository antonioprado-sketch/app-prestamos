import type { ReactNode } from 'react';

type Variant = 'success' | 'error' | 'warning';

interface Props {
  variant: Variant;
  children: ReactNode;
}

export function Alert({ variant, children }: Props) {
  const variants: Record<Variant, string> = {
    success: 'bg-primary-light text-primary-dark border-primary',
    error: 'bg-red-50 text-danger border-danger',
    warning: 'bg-yellow-50 text-warning border-warning',
  };
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${variants[variant]}`}>
      {children}
    </div>
  );
}
