import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { apiFetch, ApiError } from '../lib/api';
import { captureLocation } from '../lib/location';
import { nextValidDates } from '../lib/calculator-dates';
import { formatShortDate } from '../lib/dates';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Icon } from '../components/ui/Icon';

type Model = 'WEEKLY' | 'BIWEEKLY';

interface QuoteScheduleEntry {
  seq: number;
  dueDate: string;
  amount: number;
}

interface QuoteResult {
  amount: number;
  model: Model;
  openingDate: string;
  total: number;
  payment: number;
  lastPayment: number;
  schedule: QuoteScheduleEntry[];
}

interface LoanDraft extends QuoteResult {
  id: string;
  folio: string;
  status: string;
  adminNote: string | null;
}

interface PenaltyInstallment {
  seq: number;
  dueDate: string;
  daysLate: number;
  penalty: number;
}

interface PenaltyResult {
  totalPenalty: number;
  overdueInstallments: PenaltyInstallment[];
}

type ScoreLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

interface CustomerScore {
  level: ScoreLevel;
  maxDaysLate: number;
}

const SCORE_LABELS: Record<ScoreLevel, string> = {
  GREEN: 'Al corriente',
  YELLOW: 'Atraso leve',
  ORANGE: 'Atraso importante',
  RED: 'Atraso grave',
};

const SCORE_COLORS: Record<ScoreLevel, string> = {
  GREEN: 'bg-green-100 text-green-800',
  YELLOW: 'bg-yellow-100 text-yellow-800',
  ORANGE: 'bg-orange-100 text-orange-800',
  RED: 'bg-red-100 text-red-800',
};

function ScoreBadge({ score }: { score: CustomerScore }) {
  return (
    <div
      className={`mb-4 flex items-center justify-between rounded-xl px-3 py-2 text-sm ${SCORE_COLORS[score.level]}`}
    >
      <span className="font-semibold">{SCORE_LABELS[score.level]}</span>
      {score.maxDaysLate > 0 && <span>{score.maxDaysLate} días de atraso</span>}
    </div>
  );
}

const TERMINAL_STATUSES = ['LIQUIDATED', 'CANCELLED', 'REJECTED'];

interface CreditIncreaseRequestItem {
  id: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  createdAt: string;
}

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function ScheduleSummary({ quote }: { quote: QuoteResult }) {
  let saldo = quote.total;
  const plazo = quote.model === 'WEEKLY' ? '20 semanas' : '10 quincenas';
  const frecuencia = quote.model === 'WEEKLY' ? 'semanalmente' : 'quincenalmente';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between text-sm">
        <span className="text-secondary">Total a pagar</span>
        <span className="font-semibold text-secondary">{currency.format(quote.total)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-secondary">
          Pago {quote.model === 'WEEKLY' ? 'semanal' : 'quincenal'}
        </span>
        <span className="font-semibold text-secondary">{currency.format(quote.payment)}</span>
      </div>
      <p className="text-xs text-secondary">
        Este préstamo tiene un plazo de {plazo}. Los pagos se realizan {frecuencia} de acuerdo
        con el calendario mostrado a continuación.
      </p>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-secondary">Calendario de pagos</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase text-secondary">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Fecha de pago</th>
                <th className="px-3 py-2 text-right">Abono a deuda</th>
                <th className="px-3 py-2 text-right">Saldo pendiente</th>
              </tr>
            </thead>
            <tbody>
              {quote.schedule.map((entry) => {
                saldo = Math.max(0, Math.round((saldo - entry.amount) * 100) / 100);
                return (
                  <tr key={entry.seq} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-secondary">{entry.seq}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-secondary">
{formatShortDate(entry.dueDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-secondary">
                      {currency.format(entry.amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-secondary">
                      {currency.format(saldo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoanSummaryCard({ quote }: { quote: QuoteResult }) {
  const nextDate = quote.schedule[1]?.dueDate ?? quote.schedule[0]?.dueDate ?? quote.openingDate;
  return (
    <div className="rounded-xl bg-surface-container-lowest p-md shadow-level-2 border-l-2 border-secondary-container">
      <div className="grid grid-cols-2 gap-y-lg gap-x-md">
        <div className="col-span-2 md:col-span-1">
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-1">Monto solicitado</p>
          <p className="font-data-lg text-data-lg text-primary">{currency.format(quote.amount)}</p>
        </div>
        <div className="col-span-2 md:col-span-1">
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-1">Total a pagar</p>
          <p className="font-data-lg text-data-lg text-primary">{currency.format(quote.total)}</p>
        </div>
        <div className="col-span-2 my-2 h-px w-full bg-outline-variant opacity-30" />
        <div>
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-1">Pago {quote.model === 'WEEKLY' ? 'semanal' : 'quincenal'}</p>
          <p className="font-headline-md text-headline-md text-on-surface">{currency.format(quote.payment)}</p>
        </div>
        <div>
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-1">Duración</p>
          <p className="font-headline-md text-headline-md text-on-surface">{quote.model === 'WEEKLY' ? '20 Semanas' : '10 Quincenas'}</p>
        </div>
        <div>
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-1">Fecha de inicio</p>
          <p className="font-body-md text-body-md text-on-surface">{formatShortDate(quote.openingDate)}</p>
        </div>
        <div>
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-1">Próximo pago</p>
          <p className="font-body-md text-body-md text-on-surface">{formatShortDate(nextDate)}</p>
        </div>
      </div>
    </div>
  );
}

function PenaltyGuide() {
  return (
    <div className="rounded-xl bg-surface-container-low p-md">
      <h3 className="font-headline-md text-headline-md text-primary mb-2 flex items-center gap-2">
        <Icon name="warning" className="text-error" size={20} />¿Qué pasa si no pagas a tiempo?
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">Se aplica una multa acumulable por cada pago consecutivo no realizado (configurable por el administrador).</p>
      <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="flex flex-col items-center p-3 bg-surface-container-lowest rounded-lg shadow-sm flex-1 w-full border border-outline-variant">
          <span className="font-label-md text-label-md text-error mb-1">Atraso</span>
          <Icon name="event_busy" className="text-on-surface-variant mb-1" size={20} />
          <span className="font-body-sm text-body-sm text-center">Pago no realizado</span>
        </div>
        <Icon name="arrow_forward" className="text-outline rotate-90 md:rotate-0" size={20} />
        <div className="flex flex-col items-center p-3 bg-surface-container-lowest rounded-lg shadow-sm flex-1 w-full border border-outline-variant">
          <span className="font-label-md text-label-md text-on-surface mb-1">Semana 1</span>
          <span className="font-headline-md text-headline-md text-error mb-1">+$50</span>
          <span className="font-body-sm text-body-sm text-center">Multa</span>
        </div>
        <Icon name="arrow_forward" className="text-outline rotate-90 md:rotate-0" size={20} />
        <div className="flex flex-col items-center p-3 bg-surface-container-lowest rounded-lg shadow-sm flex-1 w-full border border-outline-variant">
          <span className="font-label-md text-label-md text-on-surface mb-1">Semana 2</span>
          <span className="font-headline-md text-headline-md text-error mb-1">+$50</span>
          <span className="font-body-sm text-body-sm text-center">Adicional</span>
        </div>
      </div>
    </div>
  );
}

function PenaltySummary({ penalty }: { penalty: PenaltyResult }) {
  if (penalty.totalPenalty <= 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-2 border-t border-gray-200 pt-4">
      <Alert variant="error">
        Tienes {penalty.overdueInstallments.length}{' '}
        {penalty.overdueInstallments.length === 1 ? 'pago vencido' : 'pagos vencidos'} y una
        multa acumulada de <strong>{currency.format(penalty.totalPenalty)}</strong>.
      </Alert>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[380px] text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase text-secondary">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Vencía el</th>
              <th className="px-3 py-2 text-right">Días de atraso</th>
              <th className="px-3 py-2 text-right">Multa</th>
            </tr>
          </thead>
          <tbody>
            {penalty.overdueInstallments.map((entry) => (
              <tr key={entry.seq} className="border-t border-gray-100">
                <td className="px-3 py-2 text-secondary">{entry.seq}</td>
                <td className="whitespace-nowrap px-3 py-2 text-secondary">
                  {formatShortDate(entry.dueDate)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-secondary">
                  {entry.daysLate}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-secondary">
                  {currency.format(entry.penalty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CalculatorPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState(500);
  const [maxAmount, setMaxAmount] = useState(20000);
  const [model, setModel] = useState<Model>('WEEKLY');
  const [openingDate, setOpeningDate] = useState(() => nextValidDates('WEEKLY', 1)[0].full);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [estimate, setEstimate] = useState<QuoteResult | null>(null);
  const [draft, setDraft] = useState<LoanDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantItError, setWantItError] = useState<string | null>(null);
  const [wantItLoading, setWantItLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingDraft, setCheckingDraft] = useState(user?.role === 'CLIENT');
  const [penalty, setPenalty] = useState<PenaltyResult | null>(null);
  const [score, setScore] = useState<CustomerScore | null>(null);
  const [increaseRequest, setIncreaseRequest] = useState<CreditIncreaseRequestItem | null>(null);
  const [increaseFormOpen, setIncreaseFormOpen] = useState(false);
  const [increaseAmount, setIncreaseAmount] = useState(5000);
  const [increaseError, setIncreaseError] = useState<string | null>(null);
  const [increaseLoading, setIncreaseLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const dates = useMemo(
    () => nextValidDates(model, model === 'WEEKLY' ? 5 : 4),
    [model],
  );

  useEffect(() => {
    apiFetch<{ maxAmount: number | null }>('/loans/quote-limit')
      .then((r) => setMaxAmount(r.maxAmount ?? 20000))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (amount > maxAmount) setAmount(maxAmount);
  }, [maxAmount, amount]);

  useEffect(() => {
    if (draft || !openingDate) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      apiFetch<QuoteResult>('/loans/quote', {
        method: 'POST',
        body: JSON.stringify({ amount, model, openingDate }),
      })
        .then((q) => {
          if (!cancelled) setEstimate(q);
        })
        .catch(() => {
          if (!cancelled) setEstimate(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, model, openingDate, draft]);

  useEffect(() => {
    if (user?.role !== 'CLIENT') {
      setCheckingDraft(false);
      return;
    }
    apiFetch<LoanDraft[]>('/loans')
      .then((loans) => {
        const active = loans.find((l) => !TERMINAL_STATUSES.includes(l.status));
        if (active) {
          if (active.status === 'APPROVED' || active.status === 'ACTIVE') {
            navigate('/app/cliente', { replace: true });
            return;
          }
          setDraft(active);
        }
      })
      .catch(() => undefined)
      .finally(() => setCheckingDraft(false));

    apiFetch<CustomerScore>('/customers/me/score')
      .then(setScore)
      .catch(() => undefined);
  }, [user, navigate]);

  useEffect(() => {
    if (user?.role !== 'CLIENT') return;
    let cancelled = false;
    apiFetch<{ request: CreditIncreaseRequestItem | null }>('/credit-increase/me')
      .then((r) => {
        if (!cancelled) setIncreaseRequest(r.request);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onSubmitIncrease = async () => {
    if (!increaseAmount || increaseAmount % 500 !== 0 || increaseAmount <= maxAmount) {
      setIncreaseError(
        `El monto debe ser múltiplo de $500 y mayor a tu límite actual de ${currency.format(
          maxAmount,
        )}`,
      );
      return;
    }
    setIncreaseError(null);
    setIncreaseLoading(true);
    try {
      const created = await apiFetch<CreditIncreaseRequestItem>('/credit-increase', {
        method: 'POST',
        body: JSON.stringify({ amount: increaseAmount }),
      });
      setIncreaseRequest(created);
      setIncreaseFormOpen(false);
    } catch (err) {
      setIncreaseError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud');
    } finally {
      setIncreaseLoading(false);
    }
  };

  useEffect(() => {
    if (!draft) {
      setPenalty(null);
      return;
    }
    apiFetch<PenaltyResult>(`/loans/${draft.id}/penalty`)
      .then(setPenalty)
      .catch(() => undefined);
  }, [draft]);

  const selectModel = (m: Model) => {
    setModel(m);
    setOpeningDate(nextValidDates(m, 1)[0].full);
  };

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    setWantItError(null);
    setLoading(true);
    try {
      const quote =
        estimate && estimate.amount === amount && estimate.model === model
          ? estimate
          : await apiFetch<QuoteResult>('/loans/quote', {
              method: 'POST',
              body: JSON.stringify({ amount, model, openingDate }),
            });
      setResult(quote);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo calcular la cotización');
    } finally {
      setLoading(false);
    }
  };

  const onWantIt = async () => {
    if (!user) return; // el Link a /register cubre este caso
    setWantItError(null);
    setWantItLoading(true);
    try {
      const created = await apiFetch<LoanDraft>('/loans', {
        method: 'POST',
        body: JSON.stringify({ amount, model, openingDate }),
      });
      setDraft(created);
      captureLocation('REQUEST');
    } catch (err) {
      setWantItError(err instanceof ApiError ? err.message : 'No se pudo guardar la solicitud');
    } finally {
      setWantItLoading(false);
    }
  };

  if (checkingDraft) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Spinner />
      </main>
    );
  }

  if (draft) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-2xl">
          <h1 className="mb-1 text-center text-xl font-bold text-secondary">
            Calculadora de préstamo
          </h1>
          <p className="mb-6 text-center text-sm text-secondary">
            Ya tienes una solicitud guardada
          </p>

          {score && <ScoreBadge score={score} />}

          <div className="flex flex-col gap-4">
            <Alert variant="success">
              Folio <strong>{draft.folio}</strong> · estado {draft.status}. Vas a retomar esta
              misma cotización al terminar el registro de tus datos.
            </Alert>

            <ScheduleSummary quote={draft} />

            {penalty && <PenaltySummary penalty={penalty} />}

            {draft.status === 'REQUIRES_CORRECTION' && draft.adminNote && (
              <Alert variant="error">
                El administrador pidió una corrección: {draft.adminNote}
              </Alert>
            )}

            {draft.status === 'DRAFT' || draft.status === 'REQUIRES_CORRECTION' ? (
              <>
                <Link to="/onboarding">
                  <Button type="button" className="w-full">
                    Completar mis datos
                  </Button>
                </Link>
                <Link to="/documentos">
                  <Button type="button" variant="ghost" className="w-full">
                    Subir mis documentos
                  </Button>
                </Link>
                <Link to="/video">
                  <Button type="button" variant="ghost" className="w-full">
                    Grabar mi video de identidad
                  </Button>
                </Link>
                <Link to="/pagare">
                  <Button type="button" variant="ghost" className="w-full">
                    Firmar mi pagaré
                  </Button>
                </Link>
              </>
            ) : (
              <Alert variant="success">Tu solicitud está siendo procesada.</Alert>
            )}
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main
      className={`flex w-full flex-col items-center bg-surface px-margin-mobile ${
        embedded ? '' : 'min-h-screen pb-[120px]'
      }`}
    >
      <div className="flex w-full max-w-md flex-1 flex-col gap-lg pt-sm">
        <div className="pt-sm">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
            Calcula tu préstamo
          </h1>
          <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
            Define el monto y el plazo deseado.
          </p>
        </div>

        {score && <ScoreBadge score={score} />}

        {error && <Alert variant="error">{error}</Alert>}

        <div className="rounded-xl border border-transparent bg-surface-container-lowest p-md shadow-level-2 transition-all focus-within:border-secondary">
          <label
            htmlFor="amount-slider"
            className="mb-xs block font-label-md text-label-md text-on-surface-variant"
          >
            Monto solicitado
          </label>
          <div className="flex flex-col gap-sm">
            <div className="flex items-baseline gap-1">
              <span className="font-data-lg text-data-lg text-primary">$</span>
              <span className="font-data-lg text-data-lg text-primary">
                {amount.toLocaleString('es-MX')}
              </span>
              <span className="ml-2 font-body-sm text-body-sm text-outline">
                · {maxAmount > 0 ? Math.round((amount / maxAmount) * 100) : 0}% de tu tope
              </span>
            </div>
            <input
              id="amount-slider"
              type="range"
              min={500}
              max={maxAmount}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="range-slider w-full"
            />
          </div>
          <div className="mt-xs flex justify-between px-2">
            <span className="font-body-sm text-body-sm text-outline">Mín: $500</span>
            <span className="font-body-sm text-body-sm text-outline">
              Máx: {maxAmount >= 20000 ? '$20k' : currency.format(maxAmount)}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200"
              style={{ width: `${maxAmount > 0 ? Math.min(100, Math.round((amount / maxAmount) * 100)) : 0}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1 flex justify-between px-1">
            <span className="font-body-sm text-[11px] text-outline">Ocupado</span>
            <span className="font-body-sm text-[11px] text-outline">Disponible</span>
          </div>
          <div className="mt-2 flex items-center gap-sm">
            <button
              type="button"
              onClick={() => {
                const half = Math.round(maxAmount / 2 / 500) * 500;
                const clamped = Math.max(500, Math.min(maxAmount, half || 500));
                setAmount(clamped);
              }}
              className="rounded-full border border-primary px-3 py-1.5 font-label-md text-[12px] font-semibold text-primary transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Poner monto a mitad del crédito"
            >
              ↔ Poner a mitad
            </button>
            <span className="font-body-sm text-[11px] text-outline">
              {currency.format(Math.round(maxAmount / 2 / 500) * 500)} · 50% de {maxAmount >= 20000 ? '$20,000' : currency.format(maxAmount)}
            </span>
          </div>
          {maxAmount < 20000 && (
            <p className="mt-2 text-xs text-secondary">
              Tope de {currency.format(maxAmount)} para tu primer préstamo.
            </p>
          )}
        </div>

        {user?.role === 'CLIENT' && maxAmount < 20000 && (
          <div className="flex flex-col gap-sm">
            {increaseRequest?.status === 'PENDING' && (
              <Alert variant="warning">
                Tu solicitud de aumento a {currency.format(increaseRequest.amount)} está en
                revisión. Te avisaremos por notificación y correo.
              </Alert>
            )}
            {increaseRequest?.status === 'REJECTED' && (
              <Alert variant="error">
                Tu solicitud de aumento a {currency.format(increaseRequest.amount)} no fue
                aprobada.
                {increaseRequest.note ? ` Motivo: ${increaseRequest.note}` : ''}
              </Alert>
            )}
            {increaseRequest?.status !== 'PENDING' && (
              <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-md">
                {increaseFormOpen ? (
                  <div className="flex flex-col gap-sm">
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      ¿A cuánto quieres aumentar tu límite?
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-data-lg text-data-lg text-primary">$</span>
                      <span className="font-data-lg text-data-lg text-primary">
                        {increaseAmount.toLocaleString('es-MX')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={Math.min(maxAmount + 500, 20000)}
                      max={20000}
                      step={500}
                      value={increaseAmount}
                      onChange={(e) => setIncreaseAmount(Number(e.target.value))}
                      className="range-slider w-full"
                    />
                    <div className="flex justify-between px-2">
                      <span className="font-body-sm text-body-sm text-outline">
                        Mín: ${Math.min(maxAmount + 500, 20000).toLocaleString('es-MX')}
                      </span>
                      <span className="font-body-sm text-body-sm text-outline">Máx: $20,000</span>
                    </div>
                    {increaseError && <Alert variant="error">{increaseError}</Alert>}
                    <div className="flex gap-sm">
                      <Button
                        type="button"
                        className="flex-1"
                        loading={increaseLoading}
                        onClick={onSubmitIncrease}
                      >
                        Enviar solicitud
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIncreaseFormOpen(false);
                          setIncreaseError(null);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-sm">
                    <p className="text-sm text-secondary">
                      ¿Necesitas más de {currency.format(maxAmount)}?
                    </p>
                    <Button type="button" variant="secondary" onClick={() => setIncreaseFormOpen(true)}>
                      Aumentar mi crédito
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-sm">
          <span className="px-1 font-label-md text-label-md text-on-surface-variant">
            Modelo de préstamo
          </span>
          <div
            className="flex rounded-xl bg-surface-container-lowest p-1 shadow-level-2"
            role="radiogroup"
            aria-label="Modelo de préstamo"
          >
            <button
              type="button"
              role="radio"
              aria-checked={model === 'WEEKLY'}
              onClick={() => selectModel('WEEKLY')}
              className={`flex-1 rounded-lg py-3 text-center font-label-md text-label-md transition-all duration-200 ${
                model === 'WEEKLY'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Semanal
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={model === 'BIWEEKLY'}
              onClick={() => selectModel('BIWEEKLY')}
              className={`flex-1 rounded-lg py-3 text-center font-label-md text-label-md transition-all duration-200 ${
                model === 'BIWEEKLY'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Quincenal
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-sm">
          <div className="flex items-center justify-between px-1">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Fecha de inicio
            </span>
            <span className="font-body-sm text-body-sm text-accent">
              {model === 'WEEKLY' ? 'Solo Lun / Vie' : '15 / Fin de mes'}
            </span>
          </div>
          <div className="hide-scrollbar flex gap-md overflow-x-auto px-1 py-2 snap-x">
            {dates.map((d) => {
              const selected = openingDate === d.full;
              return (
                <button
                  key={d.full}
                  type="button"
                  onClick={() => setOpeningDate(d.full)}
                  aria-pressed={selected}
                  aria-label={d.full}
                  className={`flex h-16 w-[120px] flex-shrink-0 snap-start items-center justify-center gap-2 rounded-xl border-2 bg-surface-container-lowest shadow-level-2 transition-all ${
                    selected
                      ? 'border-secondary'
                      : 'border-transparent hover:border-outline-variant'
                  }`}
                >
                  <span
                    className={`font-body-sm text-body-sm ${
                      selected ? 'text-accent' : 'text-outline'
                    }`}
                  >
                    {d.day}
                  </span>
                  <span
                    className={`font-headline-md text-headline-md ${
                      selected ? 'text-primary' : 'text-on-surface'
                    }`}
                  >
                    {d.dayNum}
                  </span>
                  <span
                    className={`font-body-sm text-body-sm ${
                      selected ? 'text-primary' : 'text-outline'
                    }`}
                  >
                    {d.month}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto rounded-xl bg-surface-container-low p-md">
          <div className="mb-sm flex items-center justify-between">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Pago {model === 'WEEKLY' ? 'semanal' : 'quincenal'}
            </span>
            <span className="font-headline-md text-headline-md text-primary">
              {estimate ? currency.format(estimate.payment) : '—'}
            </span>
          </div>
          <div className="my-2 h-px w-full bg-outline-variant opacity-30" />
          <div className="flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-on-surface-variant">Duración</span>
            <span className="font-body-sm text-body-sm font-medium text-primary">
              {estimate ? (model === 'WEEKLY' ? '20 semanas' : '10 quincenas') : '—'}
            </span>
          </div>
        </div>
      </div>

      {result && (
        <div ref={resultRef} className="flex w-full max-w-md flex-col gap-4 pt-6">
          <LoanSummaryCard quote={result} />
          <PenaltyGuide />
          <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-md shadow-level-2">
            <ScheduleSummary quote={result} />
            {wantItError && <Alert variant="error">{wantItError}</Alert>}
            {user ? (
              <Button type="button" loading={wantItLoading} onClick={onWantIt}>
                Lo quiero
              </Button>
            ) : (
              <Link to="/register">
                <Button type="button" className="w-full">
                  Lo quiero
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 z-50 flex w-full justify-center bg-gradient-to-t from-surface via-surface to-transparent px-margin-mobile pb-6 pt-4">
        <Button
          type="button"
          className="h-14 w-full max-w-md gap-2 rounded-xl shadow-level-3"
          loading={loading}
          onClick={onSubmit}
        >
          Calcular opciones
          <Icon name="arrow_forward" size={20} />
        </Button>
      </div>
    </main>
  );
}
