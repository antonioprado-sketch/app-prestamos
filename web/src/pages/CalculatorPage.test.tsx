import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/auth';
import { CalculatorPage } from './CalculatorPage';

describe('CalculatorPage', () => {
  it('muestra el título y los campos principales', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <CalculatorPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Calculadora de préstamo/i)).toBeTruthy();
    expect(screen.getByLabelText(/Monto/i)).toBeTruthy();
    expect(screen.getByLabelText(/Frecuencia de pago/i)).toBeTruthy();
    expect(screen.getByLabelText(/Fecha de apertura/i)).toBeTruthy();
  });
});
