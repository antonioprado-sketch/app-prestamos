import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentsPage } from './DocumentsPage';

describe('DocumentsPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('abre la cámara forzada al tocar un slot de documento', async () => {
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Tomar foto con la cámara' }))[0],
    );

    const dialog = await screen.findByRole('dialog', { name: /INE Frente/i });
    expect(dialog).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/No se pudo acceder a la cámara/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});