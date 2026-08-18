import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="2" y1="2" x2="22" y2="22" />}
    </svg>
  );
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, id, className = '', type, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const isPassword = type === 'password';
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          ref={ref}
          type={isPassword && visible ? 'text' : type}
          className={`min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isPassword ? 'pr-11' : ''
          } ${error ? 'border-danger' : ''} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-secondary"
          >
            <EyeIcon off={visible} />
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className="text-sm text-danger">
          {error}
        </span>
      )}
    </div>
  );
});
