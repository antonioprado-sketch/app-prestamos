import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { captureLocation, getLocationConsent, setLocationConsent } from '../lib/location';

export function LocationConsentBanner() {
  const [dismissed, setDismissed] = useState(getLocationConsent() !== null);

  if (dismissed) return null;

  const accept = () => {
    setLocationConsent('granted');
    setDismissed(true);
    captureLocation('LOGIN');
  };

  const decline = () => {
    setLocationConsent('declined');
    setDismissed(true);
  };

  return (
    <Card className="mb-4 w-full max-w-3xl">
      <p className="mb-1 text-sm font-semibold text-secondary">Compartir ubicación</p>
      <p className="mb-4 text-sm text-secondary">
        Podemos usar tu ubicación para que el cobrador te encuentre más fácil durante una
        visita. Solo se captura cuando inicias sesión o envías una solicitud, nunca en
        segundo plano. Podés decir que no sin afectar el resto de la app.
      </p>
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={accept}>
          Activar ubicación
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={decline}>
          No, gracias
        </Button>
      </div>
    </Card>
  );
}
