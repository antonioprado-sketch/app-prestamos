import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renderiza el texto', () => {
    render(<Button>Entrar</Button>);
    expect(screen.getByText('Entrar')).toBeTruthy();
  });
  it('se deshabilita cuando loading', () => {
    render(<Button loading>Entrar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
