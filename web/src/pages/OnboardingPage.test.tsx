import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingPage } from './OnboardingPage';

describe('OnboardingPage', () => {
  it('muestra el título y los campos principales', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Completa tus datos/i)).toBeTruthy();
    expect(screen.getByLabelText(/Nombres/i)).toBeTruthy();
    expect(screen.getByLabelText(/Nombre del aval/i)).toBeTruthy();
    expect(screen.getByLabelText(/Código postal/i)).toBeTruthy();
  });
});
