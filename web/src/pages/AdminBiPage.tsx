import { lazy, Suspense, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Icon } from '../components/ui/Icon';
import { AdminShell } from './dashboard/AdminShell';

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
interface WeeklyTrendPoint { weekStart: string; capitalCobrado: number; }
interface GeoZone { ciudad: string; colonia: string; totalClientes: number; porScore: Record<string, number>; }
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
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borradores', SUBMITTED: 'Enviadas', IN_REVIEW: 'En revisión', REQUIRES_CORRECTION: 'Requieren corrección', APPROVED: 'Aprobadas', REJECTED: 'Rechazadas', ACTIVE: 'Activas', LIQUIDATED: 'Liquidadas', CANCELLED: 'Canceladas' };
const SCORE_LABEL: Record<string, string> = { GREEN: 'Verde', YELLOW: 'Amarillo', ORANGE: 'Naranja', RED: 'Rojo' };
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const percent = (v: number) => `${v.toFixed(1)}%`;

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
    ]).then(([k, c, t, g]) => { setKpis(k); setCollectors(c); setTrends(t); setGeoZones(g); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los KPIs'))
      .finally(() => setLoading(false));
  }, []);

  const multasPct = kpis && kpis.multasAcumuladas > 0 ? (kpis.multasCobradas / kpis.multasAcumuladas) * 100 : 0;
  const maxLoanStatus = Math.max(1, ...Object.values(kpis?.loansByStatus ?? { x: 1 }));

  return (
    <AdminShell active="dashboard" title="Resumen General">
      <div className="mb-lg">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">Dashboard Administrador BI</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Vista general de cartera y rendimiento de cobranza al día de hoy.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : kpis ? (
        <div className="flex flex-col gap-6">
          {/* KPIs originales — se conservan */}
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-md shadow-level-2 border-l-2 border-secondary-container">
              <div className="mb-sm flex items-start justify-between"><span className="font-body-sm text-body-sm text-on-surface-variant">Capital Colocado</span><div className="rounded-lg bg-surface-container-low p-2 text-primary"><Icon name="account_balance" size={20} /></div></div>
              <div className="font-data-lg text-data-lg text-primary">{currency.format(kpis.capitalColocado)}</div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-md shadow-level-2 border-l-2 border-secondary-container">
              <div className="mb-sm flex items-start justify-between"><span className="font-body-sm text-body-sm text-on-surface-variant">Capital Recuperado</span><div className="rounded-lg bg-surface-container-low p-2 text-primary"><Icon name="payments" size={20} /></div></div>
              <div className="font-data-lg text-data-lg text-primary">{currency.format(kpis.capitalCobrado)}</div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-md shadow-level-2 border-l-2 border-secondary-container">
              <div className="mb-sm flex items-start justify-between"><span className="font-body-sm text-body-sm text-on-surface-variant">Por Cobrar (Pendiente)</span><div className="rounded-lg bg-surface-container-low p-2 text-primary"><Icon name="pending_actions" size={20} /></div></div>
              <div className="font-data-lg text-data-lg text-primary">{currency.format(kpis.capitalPendiente)}</div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-md shadow-level-2 border-l-2 border-error">
              <div className="mb-sm flex items-start justify-between"><span className="font-body-sm text-body-sm text-on-surface-variant">Cartera Vencida</span><div className="rounded-lg bg-error-container p-2 text-error"><Icon name="warning" size={20} /></div></div>
              <div className="font-data-lg text-data-lg text-error">{currency.format(kpis.carteraVencida)}</div>
              <div className="mt-1 flex items-center gap-1 text-sm text-error"><Icon name="trending_up" size={16} /><span className="font-body-sm text-body-sm">{percent(kpis.morosidadPct)} morosidad</span></div>
            </div>
          </div>

          {/* Nuevas KPIs Dash_admin — se agregan */}
          <div className="mb-xl">
            <h2 className="font-headline-md text-headline-md text-primary mb-4">Cartera y Riesgo</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              <div className="bg-surface-container-lowest p-md rounded-xl shadow-level-2 border-l-2 border-error">
                <div className="flex justify-between items-start mb-sm">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Cartera Vencida</span>
                  <Icon name="warning" className="text-error" size={20} />
                </div>
                <div className="font-data-lg text-data-lg text-error mb-1">{currency.format(kpis.carteraVencida)}</div>
                <div className="text-xs text-on-surface-variant">Monto total en mora</div>
              </div>
              <div className="bg-surface-container-lowest p-md rounded-xl shadow-level-2 border-l-2 border-error">
                <div className="flex justify-between items-start mb-sm">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Morosidad</span>
                  <Icon name="trending_up" className="text-error" size={20} />
                </div>
                <div className="font-data-lg text-data-lg text-error mb-1">{percent(kpis.morosidadPct)}</div>
                <div className={`text-xs font-bold ${kpis.morosidadPct > 20 ? 'text-error' : 'text-on-surface-variant'}`}>
                  {kpis.morosidadPct > 50 ? 'Nivel Crítico' : kpis.morosidadPct > 20 ? 'Alto' : 'Controlado'}
                </div>
              </div>
              <div className="bg-surface-container-lowest p-md rounded-xl shadow-level-2 border-l-2 border-secondary">
                <div className="flex justify-between items-start mb-sm">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Tasa de Recuperación</span>
                  <Icon name="analytics" className="text-secondary" size={20} />
                </div>
                <div className="font-data-lg text-data-lg text-primary mb-1">{percent(kpis.tasaRecuperacionPct)}</div>
                <div className="text-xs text-on-surface-variant">Rendimiento actual</div>
              </div>
            </div>
          </div>

          {/* Charts Section — 2 columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md mb-xl">
            <div className="bg-surface-container-lowest p-md rounded-xl shadow-level-2">
              <h2 className="font-headline-md text-headline-md text-primary mb-6">Multas</h2>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-body-sm text-on-surface-variant">Acumuladas</p>
                    <p className="text-headline-md font-bold text-primary">{currency.format(kpis.multasAcumuladas)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-body-sm text-on-surface-variant">Cobradas</p>
                    <p className="text-headline-md font-bold text-secondary">{currency.format(kpis.multasCobradas)}</p>
                  </div>
                </div>
                <div className="w-full bg-surface-container-low h-4 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full" style={{ width: `${Math.min(100, multasPct).toFixed(2)}%` }} />
                </div>
                <p className="text-xs text-on-surface-variant">{multasPct.toFixed(2)}% de recuperación de multas</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-md rounded-xl shadow-level-2">
              <h2 className="font-headline-md text-headline-md text-primary mb-6">Préstamos por estado</h2>
              <div className="flex flex-col gap-3">
                {Object.entries(kpis.loansByStatus).length === 0 ? (
                  <p className="text-xs text-secondary">Sin préstamos registrados.</p>
                ) : (
                  Object.entries(kpis.loansByStatus).map(([st, count]) => {
                    const pct = (count / maxLoanStatus) * 100;
                    const color = st === 'SUBMITTED' ? 'bg-primary-container' : st === 'APPROVED' ? 'bg-secondary-container' : st === 'ACTIVE' ? 'bg-success' : st === 'LIQUIDATED' ? 'bg-surface-variant' : 'bg-outline-variant';
                    return (
                      <div key={st} className="flex items-center gap-4">
                        <span className="w-28 text-body-sm text-on-surface-variant truncate">{STATUS_LABEL[st] ?? st}</span>
                        <div className="flex-1 bg-surface-container-low h-6 rounded-lg overflow-hidden">
                          <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right font-bold">{count}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Capital cobrado — 12 semanas (existente, ahora debajo) */}
          <div className="rounded-xl bg-surface-container-lowest p-md shadow-level-2">
            <p className="mb-2 font-headline-md text-headline-md text-primary">Capital cobrado — últimas 12 semanas</p>
            <div className="rounded-lg">
              <Suspense fallback={<div className="flex h-[260px] items-center justify-center"><Spinner /></div>}>
                <WeeklyTrendChart data={trends} />
              </Suspense>
            </div>
          </div>

          {/* Resto de KPIs — se mantienen pero con estilo Card */}
          <Card className="w-full">
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Capital Colocado" value={currency.format(kpis.capitalColocado)} />
                <StatTile label="Capital Recuperado" value={currency.format(kpis.capitalCobrado)} />
                <StatTile label="Por Cobrar (Pendiente)" value={currency.format(kpis.capitalPendiente)} />
                <StatTile label="Cartera Vencida" value={currency.format(kpis.carteraVencida)} />
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
                      <thead><tr className="border-b border-gray-200 text-xs text-secondary"><th className="p-3">Cobrador</th><th className="p-3">Cartera</th><th className="p-3">Pagos registrados</th><th className="p-3">Cumplimiento</th><th className="p-3">Cartera vencida</th></tr></thead>
                      <tbody>{collectors.map((c) => (
                        <tr key={c.collectorId} className="border-b border-gray-100 last:border-0">
                          <td className="p-3 text-secondary">{c.collectorName}{!c.active && <span className="ml-1 text-xs">(inactivo)</span>}</td>
                          <td className="p-3 font-mono text-secondary">{c.carteraSize}</td>
                          <td className="p-3 font-mono text-secondary">{c.pagosRegistrados}</td>
                          <td className="p-3 font-mono text-secondary">{percent(c.cumplimientoPct)}</td>
                          <td className="p-3 font-mono text-secondary">{currency.format(c.carteraVencida)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-secondary">Distribución por zona</p>
                {geoZones.length === 0 ? (
                  <p className="text-xs text-secondary">Ningún cliente tiene ciudad/colonia registrada todavía.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b border-gray-200 text-xs text-secondary"><th className="p-3">Ciudad</th><th className="p-3">Colonia</th><th className="p-3">Clientes</th><th className="p-3">Verde</th><th className="p-3">Amarillo</th><th className="p-3">Naranja</th><th className="p-3">Rojo</th></tr></thead>
                      <tbody>{geoZones.map((z) => (
                        <tr key={`${z.ciudad}|${z.colonia}`} className="border-b border-gray-100 last:border-0">
                          <td className="p-3 text-secondary">{z.ciudad}</td>
                          <td className="p-3 text-secondary">{z.colonia}</td>
                          <td className="p-3 font-mono text-secondary">{z.totalClientes}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.GREEN ?? 0}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.YELLOW ?? 0}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.ORANGE ?? 0}</td>
                          <td className="p-3 font-mono text-secondary">{z.porScore.RED ?? 0}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminShell>
  );
}
