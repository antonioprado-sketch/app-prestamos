import { lazy, Suspense, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

const WeeklyTrendChart = lazy(() => import('../components/WeeklyTrendChart'));

interface CustomerSegmentation {
  totalClientes: number;
  clientesActivos: number;
  clientesNuevos: number;
  clientesRecurrentes: number;
  porScore: Record<string, number>;
}

interface CollectorBreakdown {
  collectorId: string;
  collectorName: string;
  active: boolean;
  carteraSize: number;
  pagosRegistrados: number;
  cumplimientoPct: number;
  carteraVencida: number;
}

interface WeeklyTrendPoint {
  weekStart: string;
  capitalCobrado: number;
}

interface GeoZone {
  ciudad: string;
  colonia: string;
  totalClientes: number;
  porScore: Record<string, number>;
}

interface FinancialKpis {
  capitalColocado: number;
  capitalCobrado: number;
  capitalPendiente: number;
  carteraVencida: number;
  morosidadPct: number;
  tasaRecuperacionPct: number;
  multasAcumuladas: number;
  multasCobradas: number;
  loansByStatus: Record<string, number>;
  customers: CustomerSegmentation;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borradores',
  SUBMITTED: 'Enviadas',
  IN_REVIEW: 'En revisión',
  REQUIRES_CORRECTION: 'Requieren corrección',
  APPROVED: 'Aprobadas',
  REJECTED: 'Rechazadas',
  ACTIVE: 'Activas',
  LIQUIDATED: 'Liquidadas',
  CANCELLED: 'Canceladas',
};

const SCORE_LABEL: Record<string, string> = {
  GREEN: 'Verde',
  YELLOW: 'Amarillo',
  ORANGE: 'Naranja',
  RED: 'Rojo',
};

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const percent = (value: number) => `${value.toFixed(1)}%`;

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-secondary">{label}</p>
      <p className="mt-1 text-xl font-bold text-secondary">{value}</p>
    </div>
  );
}

export function AdminBiPage() {
  const [kpis, setKpis] = useState<FinancialKpis | null>(null);
  const [collectors, setCollectors] = useState<CollectorBreakdown[]>([]);
  const [trends, setTrends] = useState<WeeklyTrendPoint[]>([]);
  const [geoZones, setGeoZones] = useState<GeoZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<FinancialKpis>('/admin/bi/kpis'),
      apiFetch<CollectorBreakdown[]>('/admin/bi/collectors'),
      apiFetch<WeeklyTrendPoint[]>('/admin/bi/trends'),
      apiFetch<GeoZone[]>('/admin/bi/geo'),
    ])
      .then(([kpisRes, collectorsRes, trendsRes, geoRes]) => {
        setKpis(kpisRes);
        setCollectors(collectorsRes);
        setTrends(trendsRes);
        setGeoZones(geoRes);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los KPIs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-4xl">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Indicadores</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Núcleo financiero — capital, cartera y multas
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : kpis ? (
          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-2 text-sm font-medium text-secondary">
                Capital cobrado — últimas 12 semanas
              </p>
              <div className="rounded-xl border border-gray-200 p-3">
                <Suspense
                  fallback={
                    <div className="flex h-[260px] items-center justify-center">
                      <Spinner />
                    </div>
                  }
                >
                  <WeeklyTrendChart data={trends} />
                </Suspense>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Capital</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Colocado" value={currency.format(kpis.capitalColocado)} />
                <StatTile label="Cobrado" value={currency.format(kpis.capitalCobrado)} />
                <StatTile label="Pendiente" value={currency.format(kpis.capitalPendiente)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Cartera y riesgo</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Cartera vencida" value={currency.format(kpis.carteraVencida)} />
                <StatTile label="Morosidad" value={percent(kpis.morosidadPct)} />
                <StatTile label="Tasa de recuperación" value={percent(kpis.tasaRecuperacionPct)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Multas</p>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Acumuladas" value={currency.format(kpis.multasAcumuladas)} />
                <StatTile label="Cobradas" value={currency.format(kpis.multasCobradas)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Préstamos por estado</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(kpis.loansByStatus).map(([status, count]) => (
                  <StatTile
                    key={status}
                    label={STATUS_LABEL[status] ?? status}
                    value={String(count)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Clientes</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Total" value={String(kpis.customers.totalClientes)} />
                <StatTile label="Activos" value={String(kpis.customers.clientesActivos)} />
                <StatTile label="Nuevos" value={String(kpis.customers.clientesNuevos)} />
                <StatTile label="Recurrentes" value={String(kpis.customers.clientesRecurrentes)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Clientes por score</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(kpis.customers.porScore).map(([level, count]) => (
                  <StatTile key={level} label={SCORE_LABEL[level] ?? level} value={String(count)} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Por cobrador</p>
              {collectors.length === 0 ? (
                <p className="text-xs text-secondary">Sin cobradores registrados.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-secondary">
                        <th className="p-3">Cobrador</th>
                        <th className="p-3">Cartera</th>
                        <th className="p-3">Pagos registrados</th>
                        <th className="p-3">Cumplimiento</th>
                        <th className="p-3">Cartera vencida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectors.map((c) => (
                        <tr key={c.collectorId} className="border-b border-gray-100 last:border-0">
                          <td className="p-3 text-secondary">
                            {c.collectorName}
                            {!c.active && <span className="ml-1 text-xs">(inactivo)</span>}
                          </td>
                          <td className="p-3 font-mono text-secondary">{c.carteraSize}</td>
                          <td className="p-3 font-mono text-secondary">{c.pagosRegistrados}</td>
                          <td className="p-3 font-mono text-secondary">{percent(c.cumplimientoPct)}</td>
                          <td className="p-3 font-mono text-secondary">
                            {currency.format(c.carteraVencida)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-secondary">Distribución por zona</p>
              {geoZones.length === 0 ? (
                <p className="text-xs text-secondary">
                  Ningún cliente tiene ciudad/colonia registrada todavía.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-secondary">
                        <th className="p-3">Ciudad</th>
                        <th className="p-3">Colonia</th>
                        <th className="p-3">Clientes</th>
                        <th className="p-3">Verde</th>
                        <th className="p-3">Amarillo</th>
                        <th className="p-3">Naranja</th>
                        <th className="p-3">Rojo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geoZones.map((z) => (
                        <tr
                          key={`${z.ciudad}|${z.colonia}`}
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="p-3 text-secondary">{z.ciudad}</td>
                          <td className="p-3 text-secondary">{z.colonia}</td>
                          <td className="p-3 font-mono text-secondary">{z.totalClientes}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.GREEN ?? 0}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.YELLOW ?? 0}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.ORANGE ?? 0}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.RED ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
