import type { CSSProperties } from 'react';

interface Props {
  name: string;
  filled?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, filled, size = 24, className = '', style }: Props) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, fontVariationSettings: filled ? "'FILL' 1" : undefined, ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
