import { useEffect, useState } from 'react';
import { Button } from './ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'install-prompt-dismissed';

function isInstalled() {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function InstallPromptBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalled() || localStorage.getItem(STORAGE_KEY)) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      localStorage.setItem(STORAGE_KEY, '1');
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !prompt) return null;

  const install = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEY, '1');
      setVisible(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200">
        <div>
          <p className="text-sm font-semibold text-secondary">Instala la app de Prestamitos</p>
          <p className="text-xs text-secondary">Ábrela como una app de celular.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="ghost" onClick={dismiss}>
            Ahora no
          </Button>
          <Button type="button" onClick={install}>
            Instalar
          </Button>
        </div>
      </div>
    </div>
  );
}