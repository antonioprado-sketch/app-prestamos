import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { getTourSeen, setTourSeen } from '../lib/tour';

const SLIDES = [
  {
    title: 'Bienvenido a Prestamitos',
    body: 'Cotiza tu préstamo en segundos: elige el monto y si prefieres pagar semanal o quincenal.',
  },
  {
    title: 'Completa tus datos',
    body: 'Termina tu registro con tus datos, aval y sube tu INE y comprobante de domicilio.',
  },
  {
    title: 'Graba tu video de identidad',
    body: 'Un video corto para confirmar que eres tú — se valida en el momento, no sale de tu teléfono.',
  },
  {
    title: 'Firma tu pagaré',
    body: 'Firma en pantalla y tu solicitud queda enviada. Te avisamos cuando el administrador la revise.',
  },
];

export function WelcomeTour() {
  const [dismissed, setDismissed] = useState(getTourSeen());
  const [step, setStep] = useState(0);

  if (dismissed) return null;

  const finish = () => {
    setTourSeen();
    setDismissed(true);
  };

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-4 flex justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 w-1.5 rounded-full ${i === step ? 'bg-primary' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <h2 className="mb-2 text-center text-lg font-bold text-secondary">{slide.title}</h2>
        <p className="mb-6 text-center text-sm text-secondary">{slide.body}</p>
        <div className="flex gap-2">
          {!isLast && (
            <Button type="button" variant="ghost" className="flex-1" onClick={finish}>
              Omitir
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            onClick={() => (isLast ? finish() : setStep(step + 1))}
          >
            {isLast ? 'Empezar' : 'Siguiente'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
