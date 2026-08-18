import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/auth';
import { CollectorLoansPage } from './CollectorLoansPage';

const loan = {
  id: '1',
  folio: 'ppni-0001',
  status: 'ACTIVE',
  customerPhone: '5511112222',
  customerName: 'Juan Pérez',
  amount: 1000,
  total: 1000,
  model: 'WEEKLY',
  schedule: [
    { seq: 1, dueDate: '2026-08-21', amount: 500, status: 'PENDING', paidAmount: 0 },
    { seq: 2, dueDate: '2026-08-28', amount: 500, status: 'PENDING', paidAmount: 0 },
  ],
};

function mockFetch() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/v1/collector/loans')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([loan]) });
    }
    if (url.endsWith('/api/v1/loans/1/payments')) {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: 'p1', amount: 1000, receivedAt: new Date().toISOString() }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.endsWith('/api/v1/collector/loans/1/documents')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.endsWith('/api/v1/collector/loans/1/location')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ location: null }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('CollectorLoansPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('precarga el monto de la cuota y permite sumar cuotas con +/- sin editar a mano', async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <AuthProvider>
          <CollectorLoansPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText(/ppni-0001/));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Monto a cobrar/i)).toBeTruthy();
    expect(within(dialog).getByTestId('payment-total').textContent).toBe('$500.00');

    fireEvent.click(screen.getByRole('button', { name: 'Sumar cuota' }));
    expect(within(dialog).getByTestId('payment-total').textContent).toBe('$1,000.00');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([u, init]) =>
          String(u).endsWith('/api/v1/loans/1/payments') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(post).toBeTruthy();
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body.amount).toBe(1000);
    });
    vi.unstubAllGlobals();
  });
});
