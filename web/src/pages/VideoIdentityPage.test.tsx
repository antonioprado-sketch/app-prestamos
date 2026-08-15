import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VideoIdentityPage } from './VideoIdentityPage';

describe('VideoIdentityPage', () => {
  it('muestra el título y la frase declarada', () => {
    render(
      <MemoryRouter>
        <VideoIdentityPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Video de identidad/i)).toBeTruthy();
    expect(screen.getByText(/Declaro que solicito voluntariamente/i)).toBeTruthy();
  });
});
