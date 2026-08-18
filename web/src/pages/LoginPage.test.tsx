import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../store/auth';
import { LoginPage } from './LoginPage';

function mockFetch(userRole: string) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/v1/auth/login')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            accessToken: 'token',
            user: { phone: '5511112222', role: userRole, mustChangePassword: false },
          }),
      });
    }
    if (url.endsWith('/api/v1/auth/logout')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: '5511112222' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Cliente123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('muestra el título y los campos', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Prestamitos/i)).toBeTruthy();
    expect(screen.getByLabelText(/Teléfono/i)).toBeTruthy();
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();
  });

  it('muestra la etiqueta del acceso por rol', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage role="COLLECTOR" />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Acceso cobrador/i)).toBeTruthy();
    expect(screen.queryByText(/Regístrate/i)).toBeNull();
  });

  it('rechaza una cuenta que no pertenece al rol del acceso', async () => {
    vi.stubGlobal('fetch', mockFetch('COLLECTOR'));
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage role="CLIENT" />
        </AuthProvider>
      </MemoryRouter>,
    );
    fillAndSubmit();
    expect(await screen.findByText(/no corresponde al acceso/i)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('entra con una cuenta del rol correcto', async () => {
    vi.stubGlobal('fetch', mockFetch('COLLECTOR'));
    render(
      <MemoryRouter initialEntries={['/cobrador']}>
        <AuthProvider>
          <Routes>
            <Route path="/cobrador" element={<LoginPage role="COLLECTOR" />} />
            <Route path="/app/cobrador" element={<div>Home cobrador</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    fillAndSubmit();
    expect(await screen.findByText(/Home cobrador/i)).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
