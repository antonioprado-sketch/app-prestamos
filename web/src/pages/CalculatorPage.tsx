import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { apiFetch, ApiError } from '../lib/api';
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
}

const TERMINAL_STATUSES = ['LIQUIDATED', 'CANCELLED', 'REJECTED'];

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function CalculatorPage() {
  const { user } = useAuth();
  const modelId = useId();
  const [amount, setAmount] = useState('');
  const [model, setModel] = useState<Model>('WEEKLY');
  const [openingDate, setOpeningDate] = useState('');
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [draft, setDraft] = useState<LoanDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantItError, setWantItError] = useState<string | null>(null);
  const [wantItLoading, setWantItLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingDraft, setCheckingDraft] = useState(user?.role === 'CLIENT');

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
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setWantItError(null);
    setLoading(true);
    try {
      const quote = await apiFetch<QuoteResult>('/loans/quote', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), model, openingDate }),
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
        body: JSON.stringify({ amount: Number(amount), model, openingDate }),
      });
      setDraft(created);
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
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">
          Calculadora de préstamo
        </h1>
        <p className="mb-6 text-center text-sm text-secondary">
          {draft ? 'Ya tienes una solicitud guardada' : 'Simula tu préstamo antes de solicitarlo'}
        </p>

        {draft && (
          <div className="flex flex-col gap-3">
            <Alert variant="success">
              Folio <strong>{draft.folio}</strong> · estado {draft.status}. Vas a retomar esta
              misma cotización al terminar el registro de tus datos.
            </Alert>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Total a pagar</span>
              <span className="font-semibold text-secondary">{currency.format(draft.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">
                Pago {draft.model === 'WEEKLY' ? 'semanal' : 'quincenal'}
              </span>
              <span className="font-semibold text-secondary">
                {currency.format(draft.payment)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Fecha del último pago</span>
              <span className="font-semibold text-secondary">
                {formatDate(draft.schedule[draft.schedule.length - 1].dueDate)}
              </span>
            </div>
            {draft.status === 'DRAFT' ? (
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
              <Input
                label="Monto a solicitar"
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
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
              <div className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Total a pagar</span>
                  <span className="font-semibold text-secondary">
                    {currency.format(result.total)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">
                    Pago {result.model === 'WEEKLY' ? 'semanal' : 'quincenal'}
                  </span>
                  <span className="font-semibold text-secondary">
                    {currency.format(result.payment)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Número de pagos</span>
                  <span className="font-semibold text-secondary">{result.schedule.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Fecha del último pago</span>
                  <span className="font-semibold text-secondary">
                    {formatDate(result.schedule[result.schedule.length - 1].dueDate)}
                  </span>
                </div>

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
