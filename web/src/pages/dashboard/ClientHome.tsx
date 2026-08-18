import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { Icon } from '../../components/ui/Icon';

type ScheduleEntry = {
  seq: number;
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  paidAmount: number;
};

interface LoanSummary {
  id: string;
  status: string;
  total: number;
  schedule: ScheduleEntry[];
}

type ScoreLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

interface CustomerScore {
  level: ScoreLevel;
  maxDaysLate: number;
}

const ACTIVE_STATUSES = ['APPROVED', 'ACTIVE'];

const SCORE_RING_COLOR: Record<ScoreLevel, string> = {
  GREEN: '#1A9E63',
  YELLOW: '#F5A623',
  ORANGE: '#F2802A',
  RED: '#BA1A1A',
};

const SCORE_LABEL: Record<ScoreLevel, string> = {
  GREEN: 'Al corriente',
  YELLOW: 'Atraso leve',
  ORANGE: 'Atraso importante',
  RED: 'Atraso grave',
};

// Progreso visual del anillo — no hay un "score numérico" real en el sistema
// (el score es categórico GREEN/YELLOW/ORANGE/RED), así que se representa
// como un anillo más o menos lleno según la categoría, no un número inventado.
const SCORE_RING_PERCENT: Record<ScoreLevel, number> = {
  GREEN: 100,
  YELLOW: 66,
  ORANGE: 33,
  RED: 10,
};

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const longDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' });

function formatLongDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return longDate.format(new Date(Date.UTC(y, m - 1, d)));
}

export function ClientHome() {
  const { user } = useAuth();
  const [loan, setLoan] = useState<LoanSummary | null>(null);
  const [score, setScore] = useState<CustomerScore | null>(null);

  useEffect(() => {
    apiFetch<LoanSummary[]>('/loans')
      .then((loans) => {
        const active = loans.find((l) => ACTIVE_STATUSES.includes(l.status));
        setLoan(active ?? null);
      })
      .catch(() => undefined);
    apiFetch<CustomerScore>('/customers/me/score')
      .then(setScore)
      .catch(() => undefined);
  }, []);

  const firstName = user?.phone ?? '';

  if (!loan) {
    return (
      <div className="flex flex-col gap-md">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">
            Hola
          </h1>
          <p className="mt-base font-body-sm text-body-sm text-on-surface-variant">
            Todavía no tienes un préstamo activo.
          </p>
        </div>
        <Link to="/calculadora">
          <button className="w-full rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-white transition-colors hover:bg-inverse-surface">
            Solicitar un préstamo
          </button>
        </Link>
      </div>
    );
  }

  const paidTotal = loan.schedule.reduce((acc, s) => acc + s.paidAmount, 0);
  const progressPercent = loan.total > 0 ? Math.min(100, Math.round((paidTotal / loan.total) * 100)) : 0;
  const balance = Math.max(0, loan.total - paidTotal);
  const nextInstallment = loan.schedule.find((s) => s.status !== 'PAID');

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">
          Hola{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-base font-body-sm text-body-sm text-on-surface-variant">
          Aquí tienes el resumen de tu cuenta.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-md md:grid-cols-12">
        {/* Tarjeta destacada: préstamo actual */}
        <div className="flex flex-col justify-between rounded-xl border-l-2 border-secondary-container bg-surface-container-lowest p-md shadow-level-2 md:col-span-8">
          <div className="mb-lg flex items-start justify-between">
            <div>
              <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
                Tu préstamo actual
              </h2>
              <div className="mt-base font-display-lg text-display-lg text-primary">
                {currency.format(balance)}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Saldo pendiente</p>
            </div>
            <div className="flex items-center justify-center rounded-lg bg-surface-container p-sm">
              <Icon name="account_balance_wallet" className="text-accent" size={32} />
            </div>
          </div>

          {nextInstallment && (
            <div className="flex flex-col items-center gap-md rounded-lg border border-outline-variant bg-surface-bright p-md sm:flex-row sm:justify-between sm:gap-0">
              <div className="w-full text-center sm:w-auto sm:text-left">
                <p className="font-body-sm text-body-sm text-on-surface-variant">Próximo pago</p>
                <p className="font-headline-md text-headline-md text-primary">
                  {formatLongDate(nextInstallment.dueDate)}
                </p>
              </div>
              <div className="hidden h-12 w-px bg-outline-variant sm:block" />
              <div className="w-full text-center sm:w-auto sm:text-left">
                <p className="font-body-sm text-body-sm text-on-surface-variant">Importe</p>
                <p className="font-headline-md text-headline-md text-primary">
                  {currency.format(nextInstallment.amount - nextInstallment.paidAmount)}
                </p>
              </div>
              <Link to="/calculadora" className="w-full sm:w-auto">
                <button className="w-full rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-white transition-colors hover:bg-inverse-surface">
                  Ver mi solicitud
                </button>
              </Link>
            </div>
          )}

          <div className="mt-lg">
            <div className="mb-base flex justify-between font-body-sm text-body-sm text-on-surface-variant">
              <span>Progreso de pago</span>
              <span>{progressPercent}% completado</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-secondary-container"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Score */}
        {score && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-lowest p-md text-center shadow-level-2 md:col-span-4">
            <h2 className="mb-sm w-full text-left font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
              Mi comportamiento
            </h2>
            <div className="relative my-base flex h-32 w-32 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container-high"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={SCORE_RING_COLOR[score.level]}
                  strokeDasharray={`${SCORE_RING_PERCENT[score.level]}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Icon name="shield" size={28} style={{ color: SCORE_RING_COLOR[score.level] }} />
              </div>
            </div>
            <div
              className="mt-sm flex items-center gap-base rounded-full px-sm py-base font-label-md text-label-md"
              style={{ backgroundColor: `${SCORE_RING_COLOR[score.level]}1A`, color: SCORE_RING_COLOR[score.level] }}
            >
              <Icon name="verified" size={16} />
              {SCORE_LABEL[score.level]}
              {score.maxDaysLate > 0 ? ` · ${score.maxDaysLate}d` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
