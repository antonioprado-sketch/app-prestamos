import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-secondary">
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        className={`min-h-11 rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          error ? 'border-danger' : ''
        } ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
});
