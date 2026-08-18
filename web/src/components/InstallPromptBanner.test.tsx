import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { InstallPromptBanner } from './InstallPromptBanner';

function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt');
  Object.assign(event, {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
}

describe('InstallPromptBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', undefined);
  });

  it('no se muestra hasta que el navegador emita beforeinstallprompt', () => {
    render(<InstallPromptBanner />);
    expect(screen.queryByText(/Instala la app/i)).toBeNull();
  });

  it('se muestra al emitirse beforeinstallprompt', () => {
    render(<InstallPromptBanner />);
    dispatchInstallPrompt('dismissed');
    expect(screen.getByText(/Instala la app de Prestamitos/i)).toBeTruthy();
  });

  it('desaparece al instalar', async () => {
    render(<InstallPromptBanner />);
    dispatchInstallPrompt('accepted');
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    await act(async () => {});
    expect(screen.queryByText(/Instala la app de Prestamitos/i)).toBeNull();
  });

  it('desaparece al rechazar y no vuelve a aparecer', () => {
    const { unmount } = render(<InstallPromptBanner />);
    dispatchInstallPrompt('dismissed');
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByText(/Instala la app/i)).toBeNull();
    unmount();
    render(<InstallPromptBanner />);
    dispatchInstallPrompt('dismissed');
    expect(screen.queryByText(/Instala la app/i)).toBeNull();
  });
});