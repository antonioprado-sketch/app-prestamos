import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { formatShortDate } from '../lib/dates';
import { AdminShell } from './dashboard/AdminShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';

interface CreditIncreaseItem {
  id: string;
  customerPhone: string;
  customerName: string | null;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  createdAt: string;
  currentMaxAmount: number | null;
  scoreLevel: string | null;
}

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

const SCORE_LABELS: Record<string, string> = {
  GREEN: 'Verde',
  YELLOW: 'Amarillo',
  ORANGE: 'Naranja',
  RED: 'Rojo',
};

export function AdminCreditIncreasePage() {
  const [requests, setRequests] = useState<CreditIncreaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    apiFetch<CreditIncreaseItem[]>('/credit-increase')
      .then(setRequests)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las solicitudes'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setError(null);
    setResolvingId(id);
    try {
      await apiFetch(`/credit-increase/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note: notes[id]?.trim() || undefined }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo resolver la solicitud');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <AdminShell active="aumentos" title="Aumentos de crédito">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-secondary">
              No hay solicitudes de aumento pendientes.
            </p>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-secondary">
                    {request.customerName ?? request.customerPhone}
                  </p>
                  <p className="text-xs text-secondary">{request.customerPhone}</p>
                </div>
                <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">
                  {currency.format(request.amount)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-secondary">
                <span>
                  Límite actual:{' '}
                  {request.currentMaxAmount
                    ? currency.format(request.currentMaxAmount)
                    : 'sin tope'}
                </span>
                <span>Score: {request.scoreLevel ? (SCORE_LABELS[request.scoreLevel] ?? request.scoreLevel) : '—'}</span>
                <span>
                  Solicitado:{' '}
                  {formatShortDate(request.createdAt)}
                </span>
              </div>
              <Input
                label="Nota (opcional)"
                placeholder="Razón de la aprobación o rechazo"
                value={notes[request.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [request.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  loading={resolvingId === request.id}
                  onClick={() => resolve(request.id, 'APPROVED')}
                >
                  Aprobar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="flex-1"
                  loading={resolvingId === request.id}
                  onClick={() => resolve(request.id, 'REJECTED')}
                >
                  Rechazar
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </AdminShell>
  );
}