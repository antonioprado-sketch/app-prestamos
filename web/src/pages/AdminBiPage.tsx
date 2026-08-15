import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<FinancialKpis>('/admin/bi/kpis')
      .then(setKpis)
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
          </div>
        ) : null}
      </Card>
    </main>
  );
}
