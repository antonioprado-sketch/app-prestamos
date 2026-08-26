import { lazy, Suspense, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
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
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const percent = (v: number) => `${v.toFixed(1)}%`;

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

          {/* Clientes + por score — diseño Dash_admin + datos previos conservados */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
            <div className="bg-surface-container-lowest p-md rounded-xl shadow-level-2">
              <h2 className="font-headline-md text-headline-md text-primary mb-6">Clientes</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-on-surface-variant">Total</p><p className="text-data-lg font-bold">{kpis.customers.totalClientes}</p></div>
                <div><p className="text-xs text-on-surface-variant">Activos</p><p className="text-data-lg font-bold text-secondary">{kpis.customers.clientesActivos}</p></div>
                <div><p className="text-xs text-on-surface-variant">Nuevos</p><p className="text-data-lg font-bold text-success">{kpis.customers.clientesNuevos}</p></div>
                <div><p className="text-xs text-on-surface-variant">Recurrentes</p><p className="text-data-lg font-bold">{kpis.customers.clientesRecurrentes}</p></div>
              </div>
            </div>
            <div className="lg:col-span-2 bg-surface-container-lowest p-md rounded-xl shadow-level-2">
              <h2 className="font-headline-md text-headline-md text-primary mb-6">Clientes por score</h2>
              <div className="flex items-center justify-around h-32">
                {[
                  { k: 'GREEN', label: 'Verde', bg: 'bg-success', count: kpis.customers.porScore.GREEN ?? 0 },
                  { k: 'YELLOW', label: 'Amarillo', bg: 'bg-yellow-400', count: kpis.customers.porScore.YELLOW ?? 0 },
                  { k: 'ORANGE', label: 'Naranja', bg: 'bg-orange-400', count: kpis.customers.porScore.ORANGE ?? 0 },
                  { k: 'RED', label: 'Rojo', bg: 'bg-error', count: kpis.customers.porScore.RED ?? 0 },
                ].map((s) => (
                  <div key={s.k} className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full ${s.bg} flex items-center justify-center text-white font-bold`}>{s.count}</div>
                    <span className="text-xs mt-2">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-xl">
            <div className="bg-surface-container-lowest rounded-xl shadow-level-2 overflow-hidden">
              <div className="p-md border-b border-outline-variant/30"><h2 className="font-headline-md text-headline-md text-primary">Por cobrador</h2></div>
              {collectors.length === 0 ? (
                <p className="p-md text-xs text-secondary">Sin cobradores registrados.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase"><tr><th className="p-4">Cobrador</th><th className="p-4">Cartera</th><th className="p-4">Pagos registrados</th><th className="p-4">Cumplimiento</th><th className="p-4">Cartera vencida</th></tr></thead>
                  <tbody className="text-body-sm">{collectors.map((c) => (
                    <tr key={c.collectorId} className="border-b border-outline-variant/30">
                      <td className="p-4">{c.collectorName}{!c.active && <span className="ml-1 text-xs">(inactivo)</span>}</td>
                      <td className="p-4">{c.carteraSize}</td>
                      <td className="p-4">{c.pagosRegistrados}</td>
                      <td className="p-4">{percent(c.cumplimientoPct)}</td>
                      <td className="p-4">{currency.format(c.carteraVencida)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="bg-surface-container-lowest rounded-xl shadow-level-2 overflow-hidden">
              <div className="p-md border-b border-outline-variant/30"><h2 className="font-headline-md text-headline-md text-primary">Distribución por zona</h2></div>
              {geoZones.length === 0 ? (
                <p className="p-md text-xs text-secondary">Ningún cliente tiene ciudad/colonia registrada todavía.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase"><tr><th className="p-4">Ciudad</th><th className="p-4">Colonia</th><th className="p-4">Clientes</th><th className="p-4">Verde</th><th className="p-4">Amarillo</th><th className="p-4">Naranja</th><th className="p-4">Rojo</th></tr></thead>
                  <tbody className="text-body-sm">{geoZones.map((z) => (
                    <tr key={`${z.ciudad}|${z.colonia}`} className="border-b border-outline-variant/30">
                      <td className="p-4">{z.ciudad}</td>
                      <td className="p-4">{z.colonia}</td>
                      <td className="p-4">{z.totalClientes}</td>
                      <td className="p-4"><div className="w-3 h-3 rounded-full bg-success mx-auto" /><p className="text-center text-xs mt-1">{z.porScore.GREEN ?? 0}</p></td>
                      <td className="p-4"><div className="w-3 h-3 rounded-full bg-yellow-400 mx-auto" /><p className="text-center text-xs mt-1">{z.porScore.YELLOW ?? 0}</p></td>
                      <td className="p-4"><div className="w-3 h-3 rounded-full bg-orange-400 mx-auto" /><p className="text-center text-xs mt-1">{z.porScore.ORANGE ?? 0}</p></td>
                      <td className="p-4"><div className="w-3 h-3 rounded-full bg-error mx-auto" /><p className="text-center text-xs mt-1">{z.porScore.RED ?? 0}</p></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
