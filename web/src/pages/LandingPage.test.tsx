import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/auth';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('muestra la calculadora y los tres accesos por rol', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Calculadora de préstamo/i)).toBeTruthy();
    expect(screen.getByText('Cliente')).toBeTruthy();
    expect(screen.getByText('Cobrador')).toBeTruthy();
    expect(screen.getByText('Administrador')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Iniciar sesión/i })).toBeTruthy();
  });
});
