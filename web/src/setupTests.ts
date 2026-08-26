import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('./components/RequireGps', () => ({
  RequireGps: ({ children }: { children: unknown }) => children,
}));
