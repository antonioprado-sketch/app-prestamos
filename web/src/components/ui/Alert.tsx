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
    // text-warning (#F5A623) da ~2:1 de contraste sobre fondos claros — muy
    // por debajo del 4.5:1 que pide WCAG AA. amber-700 sí pasa (~4.7:1) y
    // mantiene la misma familia de color.
    warning: 'bg-yellow-50 text-amber-700 border-warning',
  };
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${variants[variant]}`}>
      {children}
    </div>
  );
}
