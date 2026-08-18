import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Input } from '../components/ui/Input';
import { DocumentList } from '../components/DocumentList';

type ScoreLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

interface CustomerSummary {
  phone: string;
  nombres: string | null;
  apellidos: string | null;
  isNewCustomer: boolean;
  onboardingComplete: boolean;
  scoreLevel: ScoreLevel;
  isManualScoreOverride: boolean;
  latestLoanStatus: string | null;
}

const SCORE_LEVELS: ScoreLevel[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

const SCORE_LABEL: Record<ScoreLevel, string> = {
  GREEN: 'Verde',
  YELLOW: 'Amarillo',
  ORANGE: 'Naranja',
  RED: 'Rojo',
};

interface CustomerDetail extends CustomerSummary {
  aval: string | null;
  avalPhone: string | null;
  email: string | null;
  calle: string | null;
  numero: string | null;
  colonia: string | null;
  cp: string | null;
  ciudad: string | null;
  estado: string | null;
  referencias: string | null;
  loans: {
    id: string;
    folio: string;
    status: string;
    total: number;
    collectorId: string | null;
    collectorName: string | null;
  }[];
  documents: { id: string; type: string; mime: string; sizeBytes: number; createdAt: string }[];
}

interface Collector {
  id: string;
  phone: string;
  name: string;
  active: boolean;
}

interface BlacklistEntry {
  phone: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

const ASSIGNABLE_STATUSES = ['APPROVED', 'ACTIVE'];

const SCORE_DOT: Record<ScoreLevel, string> = {
  GREEN: 'bg-green-500',
  YELLOW: 'bg-yellow-500',
  ORANGE: 'bg-orange-500',
  RED: 'bg-red-500',
};

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerResult, setNewCustomerResult] = useState<{
    phone: string;
    tempPassword: string;
  } | null>(null);
  const [customerFormLoading, setCustomerFormLoading] = useState(false);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);

  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blPhone, setBlPhone] = useState('');
  const [blReason, setBlReason] = useState('');
  const [blLoading, setBlLoading] = useState(false);
  const [blError, setBlError] = useState<string | null>(null);
  const [blRemoving, setBlRemoving] = useState<string | null>(null);

  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [collectorPickerOpen, setCollectorPickerOpen] = useState(false);
  const [pickedCollectorId, setPickedCollectorId] = useState('');
  const [collectorActionLoading, setCollectorActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<CustomerSummary[]>('/admin/customers')
      .then(setCustomers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    apiFetch<Collector[]>('/admin/collectors')
      .then(setCollectors)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiFetch<BlacklistEntry[]>('/admin/blacklist')
      .then(setBlacklist)
      .catch(() => undefined);
  }, []);

  const deleteCustomer = async (phone: string) => {
    setDeleteLoading(true);
    setError(null);
    try {
      await apiFetch(`/admin/customers/${phone}`, { method: 'DELETE' });
      setSelectedPhone(null);
      setDetail(null);
      setDeleteArmed(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el cliente');
    } finally {
      setDeleteLoading(false);
    }
  };

  const addToBlacklist = async (e: FormEvent) => {
    e.preventDefault();
    setBlError(null);
    setBlLoading(true);
    try {
      const entry = await apiFetch<BlacklistEntry>('/admin/blacklist', {
        method: 'POST',
        body: JSON.stringify({ phone: blPhone, reason: blReason }),
      });
      setBlacklist((prev) => [entry, ...prev]);
      setBlPhone('');
      setBlReason('');
    } catch (err) {
      setBlError(err instanceof ApiError ? err.message : 'No se pudo agregar');
    } finally {
      setBlLoading(false);
    }
  };

  const removeFromBlacklist = async (phone: string) => {
    setBlRemoving(phone);
    setBlError(null);
    try {
      await apiFetch(`/admin/blacklist/${phone}`, { method: 'DELETE' });
      setBlacklist((prev) => prev.filter((b) => b.phone !== phone));
    } catch (err) {
      setBlError(err instanceof ApiError ? err.message : 'No se pudo quitar');
    } finally {
      setBlRemoving(null);
    }
  };

  const selectCustomer = (phone: string) => {
    if (phone === selectedPhone) {
      setSelectedPhone(null);
      setDetail(null);
      return;
    }
    setSelectedPhone(phone);
    setDetail(null);
    setCollectorPickerOpen(false);
    setPickedCollectorId('');
    setDetailLoading(true);
    apiFetch<CustomerDetail>(`/admin/customers/${phone}`)
      .then(setDetail)
      .catch(() => undefined)
      .finally(() => setDetailLoading(false));
  };

  const refreshDetail = (phone: string) => {
    apiFetch<CustomerDetail>(`/admin/customers/${phone}`)
      .then(setDetail)
      .catch(() => undefined);
  };

  const assignCollector = async (loanId: string, phone: string) => {
    if (!pickedCollectorId) return;
    setCollectorActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/admin/loans/${loanId}/assign-collector`, {
        method: 'POST',
        body: JSON.stringify({ collectorId: pickedCollectorId }),
      });
      setCollectorPickerOpen(false);
      setPickedCollectorId('');
      refreshDetail(phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo asignar el cobrador');
    } finally {
      setCollectorActionLoading(false);
    }
  };

  const unassignCollector = async (loanId: string, phone: string) => {
    setCollectorActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/admin/loans/${loanId}/unassign-collector`, { method: 'POST' });
      refreshDetail(phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar el cobrador');
    } finally {
      setCollectorActionLoading(false);
    }
  };

  const toggleNewClient = async (phone: string, isNewCustomer: boolean) => {
    setToggleLoading(true);
    try {
      const updated = await apiFetch<CustomerSummary>(`/admin/customers/${phone}/new-client`, {
        method: 'PATCH',
        body: JSON.stringify({ isNewCustomer }),
      });
      setDetail((d) => (d ? { ...d, isNewCustomer: updated.isNewCustomer } : d));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar');
    } finally {
      setToggleLoading(false);
    }
  };

  const setScoreOverride = async (phone: string, level: ScoreLevel | null) => {
    setOverrideLoading(true);
    try {
      const updated = await apiFetch<{ level: ScoreLevel; isManualOverride: boolean }>(
        `/admin/scores/${phone}`,
        { method: 'PATCH', body: JSON.stringify({ level }) },
      );
      setDetail((d) =>
        d
          ? { ...d, scoreLevel: updated.level, isManualScoreOverride: updated.isManualOverride }
          : d,
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo ajustar el score');
    } finally {
      setOverrideLoading(false);
    }
  };

  const createCustomer = async (e: FormEvent) => {
    e.preventDefault();
    setCustomerFormError(null);
    setCustomerFormLoading(true);
    try {
      const res = await apiFetch<{ phone: string; tempPassword: string }>('/admin/customers', {
        method: 'POST',
        body: JSON.stringify({ phone: newCustomerPhone }),
      });
      setNewCustomerResult(res);
      setNewCustomerPhone('');
      load();
    } catch (err) {
      setCustomerFormError(err instanceof ApiError ? err.message : 'No se pudo crear el cliente');
    } finally {
      setCustomerFormLoading(false);
    }
  };

  return (
    <AdminShell active="clientes" title="Clientes">
      <Card className="mx-auto w-full max-w-3xl">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-xl font-bold text-secondary">Clientes</h1>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setShowNewCustomer((v) => !v);
              setNewCustomerResult(null);
              setCustomerFormError(null);
            }}
          >
            {showNewCustomer ? 'Cerrar' : 'Alta manual de cliente'}
          </Button>
        </div>
        <p className="mb-4 text-center text-sm text-secondary">
          Listado de clientes registrados, score y tope de nuevo cliente
        </p>

        {showNewCustomer && (
          <div className="mb-6 flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
            <p className="text-sm text-secondary">
              Registra un cliente sin que él lo haga desde su celular. El cliente inicia sesión
              con la contraseña temporal y la cambia en su primer ingreso; completa su propio
              onboarding (nombres, aval, dirección) después.
            </p>
            {customerFormError && <Alert variant="error">{customerFormError}</Alert>}
            {newCustomerResult && (
              <Alert variant="success">
                Cliente <strong>{newCustomerResult.phone}</strong> creado. Contraseña temporal
                (compártela por un canal seguro, no se vuelve a mostrar):{' '}
                <strong>{newCustomerResult.tempPassword}</strong>
              </Alert>
            )}
            <form onSubmit={createCustomer} className="flex flex-col gap-2">
              <Input
                label="Teléfono (10 dígitos)"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                required
              />
              <Button type="submit" loading={customerFormLoading}>
                Crear cliente
              </Button>
            </form>
          </div>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : customers.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary">No hay clientes registrados.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {customers.map((c) => (
              <div key={c.phone} className="rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => selectCustomer(c.phone)}
                  className="flex w-full items-center justify-between gap-2 p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${SCORE_DOT[c.scoreLevel]}`} />
                    <div>
                      <p className="font-semibold text-secondary">
                        {c.nombres || c.apellidos ? `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() : c.phone}
                      </p>
                      <p className="text-xs text-secondary">
                        {c.phone} · {c.isNewCustomer ? 'Cliente nuevo' : 'Cliente regular'}
                        {c.latestLoanStatus ? ` · ${c.latestLoanStatus}` : ''}
                        {c.isManualScoreOverride ? ' · score manual' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-primary">
                    {selectedPhone === c.phone ? 'Ocultar' : 'Ver'}
                  </span>
                </button>

                {selectedPhone === c.phone && (
                  <div className="flex flex-col gap-3 border-t border-gray-200 p-3">
                    {detailLoading || !detail ? (
                      <div className="flex justify-center py-4">
                        <Spinner />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-sm text-secondary">
                          <span>Aval</span>
                          <span className="text-right">{detail.aval ?? '—'}</span>
                          <span>Teléfono aval</span>
                          <span className="text-right font-mono">{detail.avalPhone ?? '—'}</span>
                          <span>Dirección</span>
                          <span className="text-right">
                            {[detail.calle, detail.numero, detail.colonia, detail.ciudad].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>

                        <div>
                          <p className="mb-1 text-sm font-medium text-secondary">
                            Préstamos ({detail.loans.length})
                          </p>
                          {detail.loans.length === 0 ? (
                            <p className="text-xs text-secondary">Sin préstamos.</p>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {detail.loans.map((l) => (
                                <div key={l.id} className="flex justify-between text-xs text-secondary">
                                  <span>{l.folio} · {l.status}</span>
                                  <span className="font-mono">{currency.format(l.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {(() => {
                          const assignableLoan = detail.loans.find((l) =>
                            ASSIGNABLE_STATUSES.includes(l.status),
                          );
                          if (!assignableLoan) return null;
                          return (
                            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                              <p className="text-sm font-medium text-secondary">
                                Cobrador ({assignableLoan.folio}):{' '}
                                {assignableLoan.collectorName ?? 'sin asignar'}
                              </p>
                              {assignableLoan.collectorId ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  loading={collectorActionLoading}
                                  className="w-full"
                                  onClick={() => unassignCollector(assignableLoan.id, detail.phone)}
                                >
                                  Quitar cobrador
                                </Button>
                              ) : collectorPickerOpen ? (
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
                                    loading={collectorActionLoading}
                                    disabled={!pickedCollectorId}
                                    onClick={() => assignCollector(assignableLoan.id, detail.phone)}
                                  >
                                    Asignar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="w-full"
                                  onClick={() => setCollectorPickerOpen(true)}
                                >
                                  Asignar cobrador
                                </Button>
                              )}
                            </div>
                          );
                        })()}

                        <div>
                          <p className="mb-1 text-sm font-medium text-secondary">
                            Documentos ({detail.documents.length})
                          </p>
                          <DocumentList documents={detail.documents} />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          loading={toggleLoading}
                          className="w-full"
                          onClick={() => toggleNewClient(detail.phone, !detail.isNewCustomer)}
                        >
                          {detail.isNewCustomer
                            ? 'Quitar tope de cliente nuevo'
                            : 'Marcar como cliente nuevo (aplica tope)'}
                        </Button>

                        <div className="rounded-xl border border-gray-200 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${SCORE_DOT[detail.scoreLevel]}`} />
                            <p className="text-sm font-medium text-secondary">
                              Score actual: {SCORE_LABEL[detail.scoreLevel]}
                            </p>
                          </div>
                          <p className="mb-3 text-xs text-secondary">
                            {detail.isManualScoreOverride
                              ? 'Este color fue forzado a mano por un admin — ya NO se recalcula solo por días de atraso hasta que lo quites.'
                              : 'Se calcula automático según los días de atraso del cliente. Tocar un color de abajo lo fuerza a mano y deja de recalcularse solo.'}
                          </p>
                          <p className="mb-1 text-xs font-medium text-secondary">
                            Forzar score manualmente a:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {SCORE_LEVELS.map((level) => (
                              <Button
                                key={level}
                                type="button"
                                variant={
                                  detail.isManualScoreOverride && detail.scoreLevel === level
                                    ? 'secondary'
                                    : 'ghost'
                                }
                                loading={overrideLoading}
                                onClick={() => setScoreOverride(detail.phone, level)}
                                className="flex-1"
                              >
                                {SCORE_LABEL[level]}
                              </Button>
                            ))}
                          </div>
                          {detail.isManualScoreOverride && (
                            <Button
                              type="button"
                              variant="ghost"
                              loading={overrideLoading}
                              className="mt-2 w-full"
                              onClick={() => setScoreOverride(detail.phone, null)}
                            >
                              Quitar ajuste manual (volver al cálculo automático)
                            </Button>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                          {!deleteArmed ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full text-danger"
                              onClick={() => setDeleteArmed(true)}
                            >
                              Eliminar cliente
                            </Button>
                          ) : (
                            <>
                              <Alert variant="error">
                                Se borrará la cuenta, préstamos, pagos, documentos y
                                ubicaciones. El teléfono quedará libre para que se
                                registre de nuevo. Esta acción no se puede deshacer.
                              </Alert>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="danger"
                                  loading={deleteLoading}
                                  className="w-full"
                                  onClick={() => deleteCustomer(detail.phone)}
                                >
                                  Confirmar eliminación
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  disabled={deleteLoading}
                                  onClick={() => setDeleteArmed(false)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mx-auto mt-4 w-full max-w-3xl">
        <h2 className="mb-1 text-xl font-bold text-secondary">Lista negra</h2>
        <p className="mb-4 text-sm text-secondary">
          Los teléfonos de aquí no pueden registrarse ni solicitar préstamos, aunque
          la cuenta ya esté dada de alta.
        </p>
        {blError && <Alert variant="error">{blError}</Alert>}
        <form onSubmit={addToBlacklist} className="mb-4 flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
          <Input
            label="Teléfono (10 dígitos)"
            value={blPhone}
            onChange={(e) => setBlPhone(e.target.value)}
            required
            pattern="[0-9]{10}"
            title="Debe tener 10 dígitos"
          />
          <Input
            label="Motivo"
            value={blReason}
            onChange={(e) => setBlReason(e.target.value)}
            required
            maxLength={255}
            placeholder="Ej. Fraude detectado"
          />
          <Button type="submit" loading={blLoading}>
            Agregar a la lista negra
          </Button>
        </form>
        {blacklist.length === 0 ? (
          <p className="py-4 text-center text-sm text-secondary">
            No hay teléfonos bloqueados.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {blacklist.map((entry) => (
              <div
                key={entry.phone}
                className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-secondary">{entry.phone}</p>
                  <p className="text-xs text-secondary">
                    {entry.reason} · Bloqueado por {entry.createdBy} el{' '}
                    {new Date(entry.createdAt).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  loading={blRemoving === entry.phone}
                  onClick={() => removeFromBlacklist(entry.phone)}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
