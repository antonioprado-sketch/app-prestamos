import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentsPage } from './DocumentsPage';

describe('DocumentsPage', () => {
  it('muestra el título y las tres tarjetas de documento', async () => {
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Identidad y Domicilio/i)).toBeTruthy();
    expect(await screen.findByText(/INE Frente/i)).toBeTruthy();
    expect(screen.getByText(/INE Reverso/i)).toBeTruthy();
    expect(screen.getByText(/Comprobante de domicilio/i)).toBeTruthy();
  });
});
