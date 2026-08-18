import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/auth';
import { CalculatorPage } from './CalculatorPage';

describe('CalculatorPage', () => {
  it('muestra el cotizador con slider, modelo y fecha de inicio', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <CalculatorPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Calcula tu préstamo/i)).toBeTruthy();
    expect(screen.getByLabelText(/Monto solicitado/i)).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: /Modelo de préstamo/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Semanal' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Quincenal' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/Fecha de inicio/i)).toBeTruthy();
    expect(screen.getByText(/Solo Lun \/ Vie/i)).toBeTruthy();
  });

  it('cambia el modelo a quincenal y muestra las fechas del día 15', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <CalculatorPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Quincenal' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Quincenal' }).getAttribute('aria-checked')).toBe('true');
    });
    expect(screen.getByText(/15 \/ Fin de mes/i)).toBeTruthy();
    expect(screen.getAllByText('15').length).toBeGreaterThan(0);
  });
});