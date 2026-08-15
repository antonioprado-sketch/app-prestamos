import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

type ScoreLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

interface CustomerSummary {
  phone: string;
  nombres: string | null;
  apellidos: string | null;
  isNewCustomer: boolean;
  onboardingComplete: boolean;
  scoreLevel: ScoreLevel;
  latestLoanStatus: string | null;
}

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
  loans: { id: string; folio: string; status: string; total: number }[];
  documents: { id: string; type: string; createdAt: string }[];
}

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

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<CustomerSummary[]>('/admin/customers')
      .then(setCustomers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const selectCustomer = (phone: string) => {
    if (phone === selectedPhone) {
      setSelectedPhone(null);
      setDetail(null);
      return;
    }
    setSelectedPhone(phone);
    setDetail(null);
    setDetailLoading(true);
    apiFetch<CustomerDetail>(`/admin/customers/${phone}`)
      .then(setDetail)
      .catch(() => undefined)
      .finally(() => setDetailLoading(false));
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

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-3xl">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Clientes</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Listado de clientes registrados, score y tope de nuevo cliente
        </p>

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

                        <div>
                          <p className="mb-1 text-sm font-medium text-secondary">
                            Documentos ({detail.documents.length})
                          </p>
                          {detail.documents.length === 0 ? (
                            <p className="text-xs text-secondary">Sin documentos.</p>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {detail.documents.map((d) => (
                                <p key={d.id} className="text-xs text-secondary">
                                  {d.type}
                                </p>
                              ))}
                            </div>
                          )}
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
                      </>
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
