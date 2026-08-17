import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PushConsentBanner } from './PushConsentBanner';
import * as push from '../lib/push';

vi.mock('../lib/push', async () => {
  const actual = await vi.importActual<typeof push>('../lib/push');
  return { ...actual, subscribeToPush: vi.fn() };
});

describe('PushConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(push.subscribeToPush).mockReset();
  });
  afterEach(() => localStorage.clear());

  it('se muestra la primera vez', () => {
    render(<PushConsentBanner />);
    expect(screen.getByText(/Activar notificaciones/i)).toBeTruthy();
  });

  it('Activar guarda el consentimiento y suscribe', () => {
    render(<PushConsentBanner />);
    fireEvent.click(screen.getByText('Activar'));
    expect(localStorage.getItem('pushConsent')).toBe('granted');
    expect(push.subscribeToPush).toHaveBeenCalled();
    expect(screen.queryByText(/Activar notificaciones/i)).toBeNull();
  });

  it('No, gracias guarda el rechazo sin suscribir', () => {
    render(<PushConsentBanner />);
    fireEvent.click(screen.getByText('No, gracias'));
    expect(localStorage.getItem('pushConsent')).toBe('declined');
    expect(push.subscribeToPush).not.toHaveBeenCalled();
  });

  it('no se muestra si ya hubo una decisión', () => {
    localStorage.setItem('pushConsent', 'declined');
    render(<PushConsentBanner />);
    expect(screen.queryByText(/Activar notificaciones/i)).toBeNull();
  });
});
