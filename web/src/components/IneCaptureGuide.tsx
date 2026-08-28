import { useEffect, useState } from 'react';
import { Icon } from './ui/Icon';
import { Button } from './ui/Button';

const STORAGE_KEY = 'ineGuideSeen';

export function shouldShowIneGuide(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function markIneGuideSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // ignore
  }
}

interface Props {
  onContinue: () => void;
  onDismiss: () => void;
}

export function IneCaptureGuide({ onContinue, onDismiss }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(m.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, []);

  const handleContinue = () => {
    markIneGuideSeen();
    onContinue();
  };

  const handleDismiss = () => {
    markIneGuideSeen();
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Cómo tomar tu INE"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-outline-variant p-4">
          <h2 className="font-label-md text-label-md text-primary">Cómo tomar tu INE — 15 segundos</h2>
          <button type="button" onClick={handleDismiss} aria-label="Cerrar" className="text-xl leading-none text-on-surface-variant">
            ×
          </button>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-center">
              <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">1</div>
              <p className="font-label-sm text-label-sm text-primary">Fondo claro</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Mesa blanca, sin sombras</p>
            </div>
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-center">
              <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">2</div>
              <p className="font-label-sm text-label-sm text-primary">Sin reflejo</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Aleja el flash</p>
            </div>
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-center">
              <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">3</div>
              <p className="font-label-sm text-label-sm text-primary">Encuadra</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">4 bordes dentro del marco</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-4">
            <div
              className="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-primary bg-white shadow-sm"
              style={!reducedMotion ? { animation: 'ineRotate 2.2s ease-in-out infinite', willChange: 'transform' } : undefined}
              aria-hidden="true"
            >
              <span className="rounded bg-primary px-1.5 py-0.5 text-xs font-bold tracking-widest text-white">INE</span>
            </div>
            {!reducedMotion && (
              <style>{`@keyframes ineRotate{0%,100%{transform:rotate(0deg)}35%{transform:rotate(90deg)}65%{transform:rotate(90deg)}100%{transform:rotate(0deg)}}`}</style>
            )}
            <p className="font-label-md text-label-md text-primary">
              <Icon name="screen_rotation" size={16} className="mr-1 inline align-text-bottom" />
              Gira la INE, no el celular
            </p>
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
              Teléfono vertical + INE horizontal en el marco apaisado
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" onClick={handleContinue}>
              Entendido, tomar foto
            </Button>
            <Button type="button" variant="ghost" onClick={handleDismiss}>
              Omitir
            </Button>
          </div>
          <p className="mt-2 text-center font-body-sm text-body-sm text-on-surface-variant">
            Solo la primera vez · “¿Cómo tomar?” queda disponible al tocar el slot
          </p>
        </div>
      </div>
    </div>
  );
}
