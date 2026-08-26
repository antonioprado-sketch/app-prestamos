import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isInstalled(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export const INSTALL_STORAGE_KEY = 'install-prompt-dismissed';

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isInstalled());

  useEffect(() => {
    const checkInstalled = () => setInstalled(isInstalled());
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALL_STORAGE_KEY, '1');
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', checkInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const canPrompt = !!prompt;
  const shouldShow = !installed;

  const triggerInstall = async (): Promise<'installed' | 'dismissed' | 'manual'> => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(INSTALL_STORAGE_KEY, '1');
        setInstalled(true);
        return 'installed';
      }
      return 'dismissed';
    }
    return 'manual';
  };

  return { prompt, canPrompt, installed, shouldShow, triggerInstall };
}
