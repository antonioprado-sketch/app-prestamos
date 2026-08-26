import { useState } from 'react';
import { Button } from './ui/Button';
import { useInstallPrompt } from '../lib/useInstallPrompt';

export function InstallButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const { installed, shouldShow, triggerInstall } = useInstallPrompt();
  const [showManual, setShowManual] = useState(false);

  if (!shouldShow || installed) return null;

  const onClick = async () => {
    const result = await triggerInstall();
    if (result === 'manual') setShowManual(true);
  };

  return (
    <>
      <Button
        type="button"
        variant={variant === 'ghost' ? 'ghost' : variant === 'primary' ? undefined : 'ghost'}
        onClick={onClick}
        aria-label="Instalar app"
        className="w-full border border-primary text-primary hover:bg-primary-light"
      >
        📲 Instalar app
      </Button>

      {showManual && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Instalar app"
          onClick={() => setShowManual(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-secondary">Instala Prestamitos</h2>
            <p className="mt-1 text-xs text-secondary">
              {!window.isSecureContext
                ? 'Estás en http:// (WiFi). Chrome bloquea el botón automático en HTTP. Hazlo manual:'
                : 'Añádela a tu pantalla de inicio:'}
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-secondary">
              <li>Abre el menú ⋮ de Chrome (arriba a la derecha)</li>
              <li>Toca "Agregar a pantalla de inicio" / "Instalar app"</li>
              <li>Confirma "Instalar"</li>
            </ol>
            {!window.isSecureContext && (
              <p className="mt-2 text-[11px] text-secondary">
                En producción con HTTPS el botón funciona directo. Para probar por WiFi activa{' '}
                <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> con{' '}
                <code>http://192.168.68.51</code>.
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowManual(false)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
