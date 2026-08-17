import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeTour } from './WelcomeTour';

describe('WelcomeTour', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('se muestra la primera vez y avanza entre slides', () => {
    render(<WelcomeTour />);
    expect(screen.getByText(/Bienvenido a Prestamitos/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Siguiente'));
    expect(screen.getByText(/Completa tus datos/i)).toBeTruthy();
  });

  it('Omitir cierra el tour y lo marca como visto', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText('Omitir'));
    expect(screen.queryByText(/Bienvenido a Prestamitos/i)).toBeNull();
    expect(localStorage.getItem('onboardingTourSeen')).toBe('true');
  });

  it('no se muestra si ya fue visto', () => {
    localStorage.setItem('onboardingTourSeen', 'true');
    render(<WelcomeTour />);
    expect(screen.queryByText(/Bienvenido a Prestamitos/i)).toBeNull();
  });

  it('llega hasta el final y "Empezar" lo marca como visto', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));
    expect(screen.getByText(/Firma tu pagaré/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Empezar'));
    expect(localStorage.getItem('onboardingTourSeen')).toBe('true');
  });
});
