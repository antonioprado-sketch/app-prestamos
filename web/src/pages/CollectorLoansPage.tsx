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
  status: string;
  paidAmount: number;
}

interface CollectorLoan {
  id: string;
  folio: string;
  status: string;
  customerPhone: string;
  customerName: string | null;
  amount: number;
  total: number;
  model: 'WEEKLY' | 'BIWEEKLY';
  schedule: ScheduleEntry[];
}

interface Payment {
  id: string;
  amount: number;
  penaltyApplied: number;
  receivedAt: string;
  notes: string | null;
  createdBy: string;
}

interface FieldDocument {
  id: string;
  type: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

interface LastLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  capturedAt: string;
}

const PAYABLE_STATUSES = ['APPROVED', 'ACTIVE'];

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprobado, sin primer pago',
  ACTIVE: 'Activo',
  LIQUIDATED: 'Liquidado',
};

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function telHref(phone: string) {
  return `tel:+52${phone}`;
}

function whatsappHref(phone: string) {
  return `https://wa.me/52${phone}`;
}

function mapHref(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export function CollectorLoansPage() {
  const [loans, setLoans] = useState<CollectorLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentsByLoan, setPaymentsByLoan] = useState<Record<string, Payment[]>>({});
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [cuotaCount, setCuotaCount] = useState(1);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [documentsByLoan, setDocumentsByLoan] = useState<Record<string, FieldDocument[]>>({});
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [locationByLoan, setLocationByLoan] = useState<Record<string, LastLocation | null>>({});

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<CollectorLoan[]>('/collector/loans')
      .then(setLoans)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la cartera'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const selected = loans.find((l) => l.id === selectedId) ?? null;
  const paymentLoan = loans.find((l) => l.id === paymentFor) ?? null;

  const remainingPerCuota = (loan: CollectorLoan) =>
    loan.schedule.map((s) =>
      s.status === 'PAID' ? 0 : Math.max(0, s.amount - (s.paidAmount ?? 0)),
    );

  const unpaidCount = (loan: CollectorLoan) => loan.schedule.filter((s) => s.status !== 'PAID').length;

  const totalFor = (loan: CollectorLoan, count: number) => {
    const remaining = remainingPerCuota(loan);
    return Math.round(remaining.slice(0, count).reduce((a, b) => a + b, 0) * 100) / 100;
  };

  const openPaymentModal = (loanId: string) => {
    setPaymentFor(loanId);
    setCuotaCount(1);
    setPaymentError(null);
  };

  const loadPayments = (loanId: string) => {
    apiFetch<Payment[]>(`/loans/${loanId}/payments`)
      .then((payments) => setPaymentsByLoan((prev) => ({ ...prev, [loanId]: payments })))
      .catch(() => undefined);
  };

  const loadDocuments = (loanId: string) => {
    apiFetch<FieldDocument[]>(`/collector/loans/${loanId}/documents`)
      .then((docs) => setDocumentsByLoan((prev) => ({ ...prev, [loanId]: docs })))
      .catch(() => undefined);
  };

  const loadLocation = (loanId: string) => {
    apiFetch<{ location: LastLocation | null }>(`/collector/loans/${loanId}/location`)
      .then(({ location }) => setLocationByLoan((prev) => ({ ...prev, [loanId]: location })))
      .catch(() => undefined);
  };

  const selectLoan = (id: string) => {
    const next = id === selectedId ? null : id;
    setSelectedId(next);
    setDocumentError(null);
    if (next) {
      loadPayments(next);
      loadDocuments(next);
      loadLocation(next);
    }
  };

  const uploadDocument = async (loanId: string, file: File) => {
    setDocumentUploading(true);
    setDocumentError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiFetch(`/collector/loans/${loanId}/documents`, { method: 'POST', body: form });
      loadDocuments(loanId);
    } catch (err) {
      setDocumentError(err instanceof ApiError ? err.message : 'No se pudo subir la foto');
    } finally {
      setDocumentUploading(false);
    }
  };

  const registerPayment = async (loanId: string, amount: number) => {
    if (!amount || amount <= 0) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      await apiFetch(`/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, idempotencyKey: crypto.randomUUID() }),
      });
      setPaymentFor(null);
      loadPayments(loanId);
      load();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-3xl">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Mi cartera</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Préstamos que tienes asignados y sus pagos
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : loans.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary">No tienes préstamos asignados.</p>
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
                      {currency.format(loan.total)} · {STATUS_LABEL[loan.status] ?? loan.status}
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

                    <div className="flex gap-2">
                      <a
                        href={telHref(loan.customerPhone)}
                        className="min-h-11 flex-1 rounded-xl bg-transparent px-4 py-2.5 text-center font-semibold text-primary transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Llamar
                      </a>
                      <a
                        href={whatsappHref(loan.customerPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-11 flex-1 rounded-xl bg-transparent px-4 py-2.5 text-center font-semibold text-primary transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        WhatsApp
                      </a>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-3">
                      <p className="mb-1 text-sm font-medium text-secondary">
                        Última ubicación conocida
                      </p>
                      {locationByLoan[loan.id] ? (
                        <div className="flex items-center justify-between text-xs text-secondary">
                          <span>
                            {new Date(locationByLoan[loan.id]!.capturedAt).toLocaleString('es-MX')}
                          </span>
                          <a
                            href={mapHref(locationByLoan[loan.id]!.lat, locationByLoan[loan.id]!.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-primary"
                          >
                            Ver en el mapa
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-secondary">
                          El cliente no ha compartido su ubicación.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                      <p className="text-sm font-medium text-secondary">Pagos</p>

                      {(paymentsByLoan[loan.id] ?? []).length === 0 ? (
                        <p className="text-xs text-secondary">Sin pagos registrados.</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {(paymentsByLoan[loan.id] ?? []).map((p) => (
                            <div key={p.id} className="flex justify-between text-xs text-secondary">
                              <span>{new Date(p.receivedAt).toLocaleDateString('es-MX')}</span>
                              <span className="font-mono">{currency.format(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {PAYABLE_STATUSES.includes(loan.status) && (
                        <Button
                          type="button"
                          className="w-full"
                          onClick={() => openPaymentModal(loan.id)}
                        >
                          Cobrar
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                      <p className="text-sm font-medium text-secondary">Evidencia de visita</p>

                      {documentError && <Alert variant="error">{documentError}</Alert>}

                      {(documentsByLoan[loan.id] ?? []).length === 0 ? (
                        <p className="text-xs text-secondary">Sin fotos subidas.</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {(documentsByLoan[loan.id] ?? []).map((d) => (
                            <p key={d.id} className="text-xs text-secondary">
                              {new Date(d.createdAt).toLocaleString('es-MX')}
                            </p>
                          ))}
                        </div>
                      )}

                      <label className="min-h-11 flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-center font-semibold text-white transition-colors hover:bg-primary-dark">
                        {documentUploading ? 'Subiendo…' : 'Tomar/subir foto'}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={documentUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) uploadDocument(loan.id, file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {paymentLoan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Registrar pago"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-secondary">
              Cobrar a {paymentLoan.customerName ?? paymentLoan.customerPhone}
            </p>
            <p className="mb-3 text-xs text-secondary">{paymentLoan.folio}</p>

            {paymentError && <Alert variant="error">{paymentError}</Alert>}

            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={cuotaCount <= 1}
                  onClick={() => setCuotaCount((c) => c - 1)}
                  aria-label="Quitar cuota"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl font-bold text-secondary transition-colors hover:bg-gray-200 disabled:opacity-40"
                >
                  −
                </button>
                <div className="text-center">
                  <p className="font-semibold text-secondary">
                    {cuotaCount} {cuotaCount === 1 ? 'cuota' : 'cuotas'}
                  </p>
                  <p className="text-xs text-secondary">
                    Cada cuota: {currency.format(paymentLoan.schedule[0]?.amount ?? 0)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={cuotaCount >= unpaidCount(paymentLoan)}
                  onClick={() => setCuotaCount((c) => c + 1)}
                  aria-label="Sumar cuota"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl font-bold text-secondary transition-colors hover:bg-gray-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div className="my-3 flex items-center justify-between">
              <span className="text-sm font-medium text-secondary">Monto a cobrar</span>
              <span
                data-testid="payment-total"
                className="font-mono text-lg font-bold text-primary"
              >
                {currency.format(totalFor(paymentLoan, cuotaCount))}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={paymentLoading}
                onClick={() => setPaymentFor(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                loading={paymentLoading}
                onClick={() =>
                  registerPayment(paymentLoan.id, totalFor(paymentLoan, cuotaCount))
                }
              >
                Registrar pago
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
