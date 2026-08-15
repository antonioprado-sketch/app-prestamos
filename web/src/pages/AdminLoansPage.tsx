import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

interface ScheduleEntry {
  seq: number;
  dueDate: string;
  amount: number;
}

interface AdminLoan {
  id: string;
  folio: string;
  status: string;
  adminNote: string | null;
  customerPhone: string;
  customerName: string | null;
  amount: number;
  total: number;
  payment: number;
  model: 'WEEKLY' | 'BIWEEKLY';
  openingDate: string;
  schedule: ScheduleEntry[];
}

const STATUS_FILTERS = [
  { value: 'SUBMITTED', label: 'Enviadas (pendientes de revisión)' },
  { value: '', label: 'Todas' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'REQUIRES_CORRECTION', label: 'Requieren corrección' },
  { value: 'DRAFT', label: 'Borradores' },
];

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function AdminLoansPage() {
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'reject' | 'correction' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    apiFetch<AdminLoan[]>(`/admin/loans${query}`)
      .then(setLoans)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const selected = loans.find((l) => l.id === selectedId) ?? null;

  const resetAction = () => {
    setActionMode(null);
    setReasonText('');
  };

  const selectLoan = (id: string) => {
    setSelectedId(id === selectedId ? null : id);
    resetAction();
  };

  const approve = async (id: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/admin/loans/${id}/approve`, { method: 'POST' });
      setSelectedId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aprobar');
    } finally {
      setActionLoading(false);
    }
  };

  const submitReasonAction = async (id: string) => {
    if (!actionMode) return;
    const endpoint = actionMode === 'reject' ? 'reject' : 'request-correction';
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/admin/loans/${id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ reason: reasonText }),
      });
      setSelectedId(null);
      resetAction();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-3xl">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">
          Solicitudes de préstamo
        </h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Revisa, aprueba, rechaza o pide corrección
        </p>

        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="status-filter" className="text-sm font-medium text-secondary">
            Estado
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSelectedId(null);
            }}
            className="min-h-11 rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : loans.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary">No hay solicitudes en este estado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {loans.map((loan) => (
              <div key={loan.id} className="rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => selectLoan(loan.id)}
                  className="flex w-full items-center justify-between gap-2 p-3 text-left"
                >
                  <div>
                    <p className="font-semibold text-secondary">
                      {loan.folio} · {loan.customerName ?? loan.customerPhone}
                    </p>
                    <p className="text-xs text-secondary">
                      {currency.format(loan.total)} · {loan.status}
                    </p>
                  </div>
                  <span className="text-sm text-primary">
                    {selectedId === loan.id ? 'Ocultar' : 'Ver'}
                  </span>
                </button>

                {selected?.id === loan.id && (
                  <div className="flex flex-col gap-3 border-t border-gray-200 p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm text-secondary">
                      <span>Teléfono</span>
                      <span className="text-right font-mono">{loan.customerPhone}</span>
                      <span>Monto solicitado</span>
                      <span className="text-right font-mono">{currency.format(loan.amount)}</span>
                      <span>Total a pagar</span>
                      <span className="text-right font-mono">{currency.format(loan.total)}</span>
                      <span>Modelo</span>
                      <span className="text-right">
                        {loan.model === 'WEEKLY' ? 'Semanal' : 'Quincenal'}
                      </span>
                      <span>Cuotas</span>
                      <span className="text-right">{loan.schedule.length}</span>
                    </div>

                    {loan.adminNote && (
                      <Alert variant="error">Nota admin: {loan.adminNote}</Alert>
                    )}

                    {loan.status === 'SUBMITTED' && !actionMode && (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          loading={actionLoading}
                          className="w-full"
                          onClick={() => approve(loan.id)}
                        >
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full"
                          onClick={() => setActionMode('correction')}
                        >
                          Pedir corrección
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="w-full"
                          onClick={() => setActionMode('reject')}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}

                    {loan.status === 'SUBMITTED' && actionMode && (
                      <div className="flex flex-col gap-2">
                        <label htmlFor={`reason-${loan.id}`} className="text-sm font-medium text-secondary">
                          {actionMode === 'reject' ? 'Motivo del rechazo' : 'Qué debe corregir el cliente'}
                        </label>
                        <textarea
                          id={`reason-${loan.id}`}
                          value={reasonText}
                          onChange={(e) => setReasonText(e.target.value)}
                          maxLength={500}
                          rows={3}
                          className="rounded-xl border border-gray-300 p-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={actionMode === 'reject' ? 'danger' : 'primary'}
                            loading={actionLoading}
                            disabled={!reasonText.trim()}
                            className="w-full"
                            onClick={() => submitReasonAction(loan.id)}
                          >
                            Confirmar {actionMode === 'reject' ? 'rechazo' : 'corrección'}
                          </Button>
                          <Button type="button" variant="ghost" onClick={resetAction}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
