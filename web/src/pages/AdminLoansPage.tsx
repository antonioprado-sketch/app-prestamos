import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { formatShortDate } from '../lib/dates';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { DocumentList, type AdminDocument } from '../components/DocumentList';
import { AdminShell } from './dashboard/AdminShell';

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
  collectorId: string | null;
  collectorName: string | null;
  amount: number;
  total: number;
  payment: number;
  model: 'WEEKLY' | 'BIWEEKLY';
  openingDate: string;
  schedule: ScheduleEntry[];
}

interface Collector {
  id: string;
  phone: string;
  name: string;
  active: boolean;
}

interface Payment {
  id: string;
  amount: number;
  penaltyApplied: number;
  receivedAt: string;
  notes: string | null;
  createdBy: string;
}

type ScoreLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

interface CustomerScore {
  customerPhone: string;
  level: ScoreLevel;
  maxDaysLate: number;
}

const SCORE_DOT: Record<ScoreLevel, string> = {
  GREEN: 'bg-green-500',
  YELLOW: 'bg-yellow-500',
  ORANGE: 'bg-orange-500',
  RED: 'bg-red-500',
};

const ASSIGNABLE_STATUSES = ['APPROVED', 'ACTIVE'];
const PAYABLE_STATUSES = ['APPROVED', 'ACTIVE'];

const STATUS_FILTERS = [
  { value: 'SUBMITTED', label: 'Enviadas (pendientes de revisión)' },
  { value: '', label: 'Todas' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'LIQUIDATED', label: 'Liquidadas' },
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

  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [collectorPickerFor, setCollectorPickerFor] = useState<string | null>(null);
  const [pickedCollectorId, setPickedCollectorId] = useState('');
  const [showNewCollector, setShowNewCollector] = useState(false);
  const [newCollectorPhone, setNewCollectorPhone] = useState('');
  const [newCollectorName, setNewCollectorName] = useState('');
  const [newCollectorResult, setNewCollectorResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [collectorFormLoading, setCollectorFormLoading] = useState(false);
  const [collectorError, setCollectorError] = useState<string | null>(null);

  const [paymentsByLoan, setPaymentsByLoan] = useState<Record<string, Payment[]>>({});
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, CustomerScore>>({});

  const [documentsByLoan, setDocumentsByLoan] = useState<Record<string, AdminDocument[]>>({});

  const load = () => {
    setLoading(true);
    setError(null);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    apiFetch<AdminLoan[]>(`/admin/loans${query}`)
      .then(setLoans)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista'))
      .finally(() => setLoading(false));
  };

  const loadCollectors = () => {
    apiFetch<Collector[]>('/admin/collectors')
      .then(setCollectors)
      .catch(() => undefined);
  };

  const loadScores = () => {
    apiFetch<CustomerScore[]>('/admin/scores')
      .then((list) => {
        const byPhone: Record<string, CustomerScore> = {};
        for (const s of list) byPhone[s.customerPhone] = s;
        setScores(byPhone);
      })
      .catch(() => undefined);
  };

  useEffect(load, [statusFilter]);
  useEffect(loadCollectors, []);
  useEffect(loadScores, []);

  const createCollector = async () => {
    setCollectorFormLoading(true);
    setCollectorError(null);
    try {
      const res = await apiFetch<{ name: string; tempPassword: string }>('/admin/collectors', {
        method: 'POST',
        body: JSON.stringify({ phone: newCollectorPhone, name: newCollectorName }),
      });
      setNewCollectorResult(res);
      setNewCollectorPhone('');
      setNewCollectorName('');
      loadCollectors();
    } catch (err) {
      setCollectorError(err instanceof ApiError ? err.message : 'No se pudo crear el cobrador');
    } finally {
      setCollectorFormLoading(false);
    }
  };

  const assignCollector = async (loanId: string) => {
    if (!pickedCollectorId) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/admin/loans/${loanId}/assign-collector`, {
        method: 'POST',
        body: JSON.stringify({ collectorId: pickedCollectorId }),
      });
      setCollectorPickerFor(null);
      setPickedCollectorId('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo asignar el cobrador');
    } finally {
      setActionLoading(false);
    }
  };

  const unassignCollector = async (loanId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/admin/loans/${loanId}/unassign-collector`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar el cobrador');
    } finally {
      setActionLoading(false);
    }
  };

  const selected = loans.find((l) => l.id === selectedId) ?? null;

  const resetAction = () => {
    setActionMode(null);
    setReasonText('');
  };

  const loadPayments = (loanId: string) => {
    apiFetch<Payment[]>(`/loans/${loanId}/payments`)
      .then((payments) => setPaymentsByLoan((prev) => ({ ...prev, [loanId]: payments })))
      .catch(() => undefined);
  };

  const loadDocuments = (customerPhone: string) => {
    apiFetch<AdminDocument[]>(`/admin/customers/${customerPhone}/documents`)
      .then((docs) =>
        setDocumentsByLoan((prev) => ({ ...prev, [customerPhone]: docs })),
      )
      .catch(() => undefined);
  };

  const selectLoan = (id: string) => {
    const next = id === selectedId ? null : id;
    setSelectedId(next);
    resetAction();
    setPaymentAmount('');
    setPaymentError(null);
    if (next) {
      loadPayments(next);
      const loan = loans.find((l) => l.id === id);
      if (loan && !documentsByLoan[loan.customerPhone]) {
        loadDocuments(loan.customerPhone);
      }
    }
  };

  const registerPayment = async (loanId: string) => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      await apiFetch(`/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, idempotencyKey: crypto.randomUUID() }),
      });
      setPaymentAmount('');
      loadPayments(loanId);
      load();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago');
    } finally {
      setPaymentLoading(false);
    }
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
    <AdminShell active="solicitudes" title="Solicitudes de préstamo">
      <Card className="mx-auto w-full max-w-3xl">
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
                    <p className="flex items-center gap-2 font-semibold text-secondary">
                      {scores[loan.customerPhone] && (
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${SCORE_DOT[scores[loan.customerPhone].level]}`}
                          title={scores[loan.customerPhone].level}
                        />
                      )}
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

                    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                      <p className="text-sm font-medium text-secondary">
                        Documentos del cliente (revisa INE y video antes de aprobar)
                      </p>
                      {documentsByLoan[loan.customerPhone] ? (
                        <DocumentList documents={documentsByLoan[loan.customerPhone]} />
                      ) : (
                        <p className="text-xs text-secondary">
                          No se pudieron cargar los documentos.
                        </p>
                      )}
                    </div>

                    {ASSIGNABLE_STATUSES.includes(loan.status) && (
                      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                        <p className="text-sm font-medium text-secondary">
                          Cobrador: {loan.collectorName ?? 'sin asignar'}
                        </p>
                        {loan.collectorId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            loading={actionLoading}
                            className="w-full"
                            onClick={() => unassignCollector(loan.id)}
                          >
                            Quitar cobrador
                          </Button>
                        ) : collectorPickerFor === loan.id ? (
                          <div className="flex gap-2">
                            <select
                              value={pickedCollectorId}
                              onChange={(e) => setPickedCollectorId(e.target.value)}
                              className="min-h-11 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <option value="">Selecciona un cobrador</option>
                              {collectors
                                .filter((c) => c.active)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.phone})
                                  </option>
                                ))}
                            </select>
                            <Button
                              type="button"
                              loading={actionLoading}
                              disabled={!pickedCollectorId}
                              onClick={() => assignCollector(loan.id)}
                            >
                              Asignar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={() => setCollectorPickerFor(loan.id)}
                          >
                            Asignar cobrador
                          </Button>
                        )}
                      </div>
                    )}

                    {PAYABLE_STATUSES.includes(loan.status) && (
                      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                        <p className="text-sm font-medium text-secondary">Pagos</p>

                        {paymentError && <Alert variant="error">{paymentError}</Alert>}

                        {(paymentsByLoan[loan.id] ?? []).length === 0 ? (
                          <p className="text-xs text-secondary">Sin pagos registrados.</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {(paymentsByLoan[loan.id] ?? []).map((p) => (
                              <div key={p.id} className="flex justify-between text-xs text-secondary">
                                <span>
                                  {formatShortDate(p.receivedAt)} · {p.createdBy}
                                </span>
                                <span className="font-mono">{currency.format(p.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Input
                            label="Monto del pago"
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                          />
                          <Button
                            type="button"
                            loading={paymentLoading}
                            disabled={!paymentAmount || Number(paymentAmount) <= 0}
                            onClick={() => registerPayment(loan.id)}
                          >
                            Registrar
                          </Button>
                        </div>
                      </div>
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

      <Card className="mt-4 w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-secondary">Cobradores</h2>
          <Button type="button" variant="ghost" onClick={() => setShowNewCollector((v) => !v)}>
            {showNewCollector ? 'Cerrar' : 'Nuevo cobrador'}
          </Button>
        </div>

        {showNewCollector && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            {collectorError && <Alert variant="error">{collectorError}</Alert>}
            {newCollectorResult && (
              <Alert variant="success">
                Cobrador <strong>{newCollectorResult.name}</strong> creado. Contraseña temporal (
                compártela por un canal seguro, no se vuelve a mostrar):{' '}
                <strong>{newCollectorResult.tempPassword}</strong>
              </Alert>
            )}
            <Input
              label="Teléfono (10 dígitos)"
              value={newCollectorPhone}
              onChange={(e) => setNewCollectorPhone(e.target.value)}
            />
            <Input
              label="Nombre completo"
              value={newCollectorName}
              onChange={(e) => setNewCollectorName(e.target.value)}
            />
            <Button
              type="button"
              loading={collectorFormLoading}
              disabled={!newCollectorPhone.trim() || !newCollectorName.trim()}
              onClick={createCollector}
            >
              Crear cobrador
            </Button>
          </div>
        )}

        {collectors.length === 0 ? (
          <p className="py-4 text-center text-sm text-secondary">Sin cobradores registrados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {collectors.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 p-3 text-sm"
              >
                <span className="text-secondary">
                  {c.name} · {c.phone}
                </span>
                <span className={c.active ? 'text-primary' : 'text-secondary'}>
                  {c.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
