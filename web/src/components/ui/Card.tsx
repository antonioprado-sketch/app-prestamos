import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...rest }: Props) {
  return (
    <div className={`rounded-xl2 bg-white p-6 shadow ${className}`} {...rest}>
      {children}
    </div>
  );
}
