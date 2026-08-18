import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../store/auth';
import { CalculatorPage } from './CalculatorPage';
import { apiFetch } from '../lib/api';

vi.mock('../lib/api', () => {
  class ApiError extends Error {}
  return {
    apiFetch: vi.fn(),
    ApiError,
    setAccessToken: vi.fn(),
  };
});

describe('CalculatorPage - aumento de crédito y crédito vigente', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('redirige al home si el cliente ya tiene un préstamo aprobado', async () => {
    vi.mocked(apiFetch).mockImplementation((url: string) => {
      if (url === '/auth/me')
        return Promise.resolve({
          user: { phone: '5512345678', role: 'CLIENT', mustChangePassword: false },
        });
      if (url === '/loans') return Promise.resolve([{ status: 'APPROVED' }]);
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/calculadora']}>
        <AuthProvider>
          <Routes>
            <Route path="/calculadora" element={<CalculatorPage />} />
            <Route path="/app/cliente" element={<div>Home cliente</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Home cliente/i)).toBeTruthy();
  });

  it('cliente con tope puede solicitar un aumento de crédito', async () => {
    let latestRequest: { request: unknown } | null = null;
    vi.mocked(apiFetch).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url === '/auth/me')
          return Promise.resolve({
            user: { phone: '5512345678', role: 'CLIENT', mustChangePassword: false },
          });
        if (url === '/loans/quote-limit') return Promise.resolve({ maxAmount: 3000 });
        if (url === '/loans') return Promise.resolve([]);
        if (url === '/customers/me/score')
          return Promise.resolve({ level: 'GREEN', maxDaysLate: 0 });
        if (url === '/credit-increase/me') return Promise.resolve(latestRequest);
        if (url === '/credit-increase' && init?.method === 'POST') {
          const amount = JSON.parse(String(init.body)).amount as number;
          latestRequest = {
            request: { id: '1', amount, status: 'PENDING', note: null, createdAt: '2026-08-18' },
          };
          return Promise.resolve(latestRequest.request);
        }
        return Promise.reject(new Error(`unexpected ${url}`));
      },
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <CalculatorPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const button = await screen.findByRole('button', { name: /Aumentar mi crédito/i });
    expect(button).toBeTruthy();

    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: /Enviar solicitud/i }));

    await waitFor(() => {
      expect(screen.getByText(/está en revisión/i)).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /Enviar solicitud/i })).toBeNull();
  });
});