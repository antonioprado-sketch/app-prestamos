import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/auth';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('muestra la landing del cotizador con Iniciar sesión y Registrarse', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Prestamitos/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Iniciar sesión/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Registrarse/i })).toBeTruthy();
    expect(screen.getByText(/Calcula tu préstamo/i)).toBeTruthy();
  });

  it('expone los accesos discretos de cobrador y administrador, sin URL de cliente', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    const cobrador = screen.getByRole('link', { name: /Acceso cobrador/i });
    const admin = screen.getByRole('link', { name: /Acceso administrador/i });
    expect(cobrador.getAttribute('href')).toBe('/cobrador');
    expect(admin.getAttribute('href')).toBe('/admin');
    expect(screen.queryByRole('link', { name: /Acceso cliente/i })).toBeNull();
  });
});