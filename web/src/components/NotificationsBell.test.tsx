import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsBell } from './NotificationsBell';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetch = vi.mocked(api.apiFetch);

describe('NotificationsBell', () => {
  beforeEach(() => apiFetch.mockReset());

  it('muestra el badge con la cantidad de no leídas', async () => {
    apiFetch.mockResolvedValueOnce([
      { id: '1', type: 'a', title: 'Aprobada', body: 'msg', read: false, createdAt: '2026-01-01' },
      { id: '2', type: 'b', title: 'Otra', body: 'msg2', read: true, createdAt: '2026-01-01' },
    ]);
    render(<NotificationsBell />);
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
  });

  it('sin no leídas no muestra badge', async () => {
    apiFetch.mockResolvedValueOnce([
      { id: '1', type: 'a', title: 'Aprobada', body: 'msg', read: true, createdAt: '2026-01-01' },
    ]);
    render(<NotificationsBell />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByText('1')).toBeNull();
  });

  it('al abrir muestra la lista y marca como leída al hacer click', async () => {
    apiFetch.mockResolvedValueOnce([
      { id: '1', type: 'a', title: 'Aprobada', body: 'msg', read: false, createdAt: '2026-01-01' },
    ]);
    apiFetch.mockResolvedValueOnce(undefined);
    render(<NotificationsBell />);
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());

    expect(screen.queryByText('Aprobada')).toBeNull();
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    expect(screen.getByText('Aprobada')).toBeTruthy();

    fireEvent.click(screen.getByText('Aprobada'));
    expect(apiFetch).toHaveBeenCalledWith('/notifications/1/read', { method: 'PATCH' });
  });

  it('sin notificaciones muestra mensaje vacío', async () => {
    apiFetch.mockResolvedValueOnce([]);
    render(<NotificationsBell />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    expect(screen.getByText(/Sin notificaciones por ahora/i)).toBeTruthy();
  });
});
