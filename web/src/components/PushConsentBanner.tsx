import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { getPushConsent, setPushConsent, subscribeToPush } from '../lib/push';

export function PushConsentBanner() {
  const [dismissed, setDismissed] = useState(getPushConsent() !== null);

  if (dismissed) return null;

  const accept = () => {
    setPushConsent('granted');
    setDismissed(true);
    subscribeToPush();
  };

  const decline = () => {
    setPushConsent('declined');
    setDismissed(true);
  };

  return (
    <Card className="mb-4 w-full max-w-3xl">
      <p className="mb-1 text-sm font-semibold text-secondary">Activar notificaciones</p>
      <p className="mb-4 text-sm text-secondary">
        Te avisamos de novedades importantes aunque no tengas la app abierta. Podés decir
        que no sin afectar el resto de la app.
      </p>
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={accept}>
          Activar
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={decline}>
          No, gracias
        </Button>
      </div>
    </Card>
  );
}
