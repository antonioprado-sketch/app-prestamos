import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PagarePage } from './PagarePage';

describe('PagarePage', () => {
  it('muestra un aviso cuando no hay solicitud en curso', async () => {
    render(
      <MemoryRouter>
        <PagarePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/No tienes una solicitud en curso/i)).toBeTruthy();
  });
});
