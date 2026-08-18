import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { apiFetch, ApiError } from '../lib/api';
import { captureLocation } from '../lib/location';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

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

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const longDate = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatLongDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return longDate.format(new Date(Date.UTC(y, m - 1, d)));
}

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
                      {formatLongDate(entry.dueDate)}
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
                  {formatLongDate(entry.dueDate)}
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

export function CalculatorPage() {
  const { user } = useAuth();
  const modelId = useId();
  const [amount, setAmount] = useState(500);
  const [maxAmount, setMaxAmount] = useState(20000);
  const [model, setModel] = useState<Model>('WEEKLY');
  const [openingDate, setOpeningDate] = useState('');
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [draft, setDraft] = useState<LoanDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantItError, setWantItError] = useState<string | null>(null);
  const [wantItLoading, setWantItLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingDraft, setCheckingDraft] = useState(user?.role === 'CLIENT');
  const [penalty, setPenalty] = useState<PenaltyResult | null>(null);
  const [score, setScore] = useState<CustomerScore | null>(null);

  useEffect(() => {
    apiFetch<{ maxAmount: number | null }>('/loans/quote-limit')
      .then((r) => setMaxAmount(r.maxAmount ?? 20000))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (amount > maxAmount) setAmount(maxAmount);
  }, [maxAmount, amount]);

  useEffect(() => {
    if (user?.role !== 'CLIENT') {
      setCheckingDraft(false);
      return;
    }
    apiFetch<LoanDraft[]>('/loans')
      .then((loans) => {
        const active = loans.find((l) => !TERMINAL_STATUSES.includes(l.status));
        if (active) setDraft(active);
      })
      .catch(() => undefined)
      .finally(() => setCheckingDraft(false));

    apiFetch<CustomerScore>('/customers/me/score')
      .then(setScore)
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!draft) {
      setPenalty(null);
      return;
    }
    apiFetch<PenaltyResult>(`/loans/${draft.id}/penalty`)
      .then(setPenalty)
      .catch(() => undefined);
  }, [draft]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setWantItError(null);
    setLoading(true);
    try {
      const quote = await apiFetch<QuoteResult>('/loans/quote', {
        method: 'POST',
        body: JSON.stringify({ amount, model, openingDate }),
      });
      setResult(quote);
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
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">
          Calculadora de préstamo
        </h1>
        <p className="mb-6 text-center text-sm text-secondary">
          {draft ? 'Ya tienes una solicitud guardada' : 'Simula tu préstamo antes de solicitarlo'}
        </p>

        {score && <ScoreBadge score={score} />}

        {draft && (
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
        )}

        {!draft && (
          <>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              {error && <Alert variant="error">{error}</Alert>}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="amount-slider" className="text-sm font-medium text-secondary">
                    Monto a solicitar
                  </label>
                  <span className="font-mono text-lg font-bold text-primary">
                    {currency.format(amount)}
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
                  aria-label="Monto a solicitar"
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-secondary">
                  <span>{currency.format(500)}</span>
                  <span>{currency.format(maxAmount)}</span>
                </div>
                {maxAmount < 20000 && (
                  <p className="text-xs text-secondary">
                    Tope de {currency.format(maxAmount)} para tu primer préstamo.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={modelId} className="text-sm font-medium text-secondary">
                  Frecuencia de pago
                </label>
                <select
                  id={modelId}
                  value={model}
                  onChange={(e) => setModel(e.target.value as Model)}
                  className="min-h-11 rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="WEEKLY">Semanal</option>
                  <option value="BIWEEKLY">Quincenal</option>
                </select>
              </div>
              <Input
                label="Fecha de apertura"
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                required
              />
              <p className="text-xs text-secondary">
                {model === 'WEEKLY'
                  ? 'Modelo semanal: la fecha debe ser lunes o viernes.'
                  : 'Modelo quincenal: la fecha debe ser día 15 o el último día del mes.'}
              </p>
              <Button type="submit" loading={loading}>
                Calcular
              </Button>
            </form>

            {result && (
              <div className="mt-6 flex flex-col gap-4 border-t border-gray-200 pt-4">
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
            )}
          </>
        )}
      </Card>
    </main>
  );
}
