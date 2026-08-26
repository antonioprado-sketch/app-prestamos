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
  const [fallback, setFallback] = useState(false);

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
      setFallback(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // Fallback para HTTP (192.168.x.x) donde beforeinstallprompt nunca dispara
    // porque requiere contexto seguro. Mostrar instrucciones manuales tras 2s.
    const fallbackTimer = window.setTimeout(() => {
      if (!isInstalled() && !localStorage.getItem(STORAGE_KEY)) {
        // Si no llegó prompt en 2s, mostrar banner manual
        setFallback(true);
        setVisible(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  if (!visible) return null;

  // Con prompt nativo (HTTPS/localhost) -> instalación con un clic
  if (prompt && !fallback) {
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
            <Button type="button" variant="ghost" onClick={dismiss}>Ahora no</Button>
            <Button type="button" onClick={install}>Instalar</Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback manual para HTTP LAN (sin beforeinstallprompt)
  const dismissFallback = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    setFallback(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200">
        <p className="text-sm font-semibold text-secondary">Instala la app de Prestamitos</p>
        <p className="mt-1 text-xs text-secondary">
          {!window.isSecureContext
            ? 'Estás en http:// (WiFi). Chrome bloquea el botón automático en HTTP. Instala manualmente:'
            : 'Añádela a tu pantalla de inicio para abrirla como app:'}
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-secondary">
          <li>Abre el menú ⋮ de Chrome (arriba a la derecha)</li>
          <li>Toca "Agregar a pantalla de inicio" / "Instalar app"</li>
          <li>Confirma "Instalar"</li>
        </ol>
        {!window.isSecureContext && (
          <p className="mt-2 text-[11px] text-secondary">En producción con HTTPS el botón "Instalar" funciona directo. Para probar cámara/GPS por WiFi activa también <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> con <code>http://192.168.68.51</code>.</p>
        )}
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="ghost" onClick={dismissFallback}>Entendido</Button>
        </div>
      </div>
    </div>
  );
}
