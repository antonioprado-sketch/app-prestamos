import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { formatShortDate } from '../../lib/dates';
import { todayInMexicoCity } from '../../lib/calculator-dates';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../store/auth';
import { NotificationsBell } from '../../components/NotificationsBell';

type ScheduleEntry = {
  seq: number;
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';
  paidAmount: number;
};

interface LoanSummary {
  id: string;
  status: string;
  total: number;
  schedule: ScheduleEntry[];
}

type Filter = 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE';
const ACTIVE_STATUSES = ['APPROVED', 'ACTIVE'];

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function isOverdue(entry: ScheduleEntry, today: string) {
  return entry.status !== 'PAID' && entry.dueDate < today;
}

function isNext(entry: ScheduleEntry, schedule: ScheduleEntry[], today: string) {
  // first non-PAID in order
  const firstPending = schedule.find((s) => s.status !== 'PAID');
  return firstPending?.seq === entry.seq && !isOverdue(entry, today);
}

const CLIENT_NAV = [
  { icon: 'home', label: 'Inicio', to: '/app/cliente' },
  { icon: 'payments', label: 'Pagos', to: '/app/cliente/pagos' },
  { icon: 'notifications', label: 'Notificaciones', to: '/app/cliente/notificaciones' },
  { icon: 'person', label: 'Perfil', to: '/app/cliente/perfil' },
] as const;

export function ClientPaymentsPage() {
  const { logout } = useAuth();
  const [loan, setLoan] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');

  useEffect(() => {
    apiFetch<LoanSummary[]>('/loans')
      .then((loans) => {
        const active = loans.find((l) => ACTIVE_STATUSES.includes(l.status));
        setLoan(active ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const today = todayInMexicoCity();

  const filtered = useMemo(() => {
    if (!loan) return [];
    const s = loan.schedule;
    if (filter === 'ALL') return s;
    if (filter === 'PAID') return s.filter((e) => e.status === 'PAID');
    if (filter === 'PENDING') return s.filter((e) => e.status !== 'PAID' && !isOverdue(e, today));
    if (filter === 'OVERDUE') return s.filter((e) => isOverdue(e, today));
    return s;
  }, [loan, filter, today]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-surface px-margin-mobile">
          <span className="font-headline-md text-headline-lg-mobile font-bold text-primary">Prestamitos</span>
          <div className="flex items-center gap-md">
            <NotificationsBell />
            <button type="button" onClick={() => logout()} className="text-primary" aria-label="Cerrar sesión">
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-margin-mobile pt-20 w-full flex justify-center py-12">
          <Spinner />
        </main>
      </div>
    );
  }

  const inner = !loan ? (
    <div className="flex flex-col gap-md">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">
        Calendario de pagos
      </h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant">Aún no tienes un préstamo activo.</p>
      <Link to="/calculadora">
        <button className="w-full rounded-lg bg-primary px-lg py-sm font-label-md text-label-md text-white">Solicitar préstamo</button>
      </Link>
    </div>
  ) : (
    <div className="flex flex-col gap-md">
      <div>
        <div className="flex items-center gap-2">
          <Link to="/app/cliente" className="rounded-full p-1 hover:bg-surface-container text-primary">
            <Icon name="arrow_back" size={20} />
          </Link>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">Calendario de pagos</h1>
        </div>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Sigue tus pagos próximos, pendientes y realizados.</p>
      </div>

      <div className="flex gap-sm overflow-x-auto pb-2 hide-scrollbar">
        {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as Filter[]).map((f) => {
          const label = f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendientes' : f === 'PAID' ? 'Pagados' : 'Vencidos';
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${active ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-md">
        {filtered.length === 0 ? (
          <p className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">Sin pagos en este filtro.</p>
        ) : (
          filtered.map((entry) => {
            const overdue = isOverdue(entry, today);
            const next = isNext(entry, loan.schedule, today);
            const border = overdue ? 'border-error' : next ? 'border-secondary-container' : entry.status === 'PAID' ? 'border-outline-variant' : 'border-outline-variant';
            const opacity = entry.status === 'PAID' ? 'opacity-70' : overdue ? '' : 'opacity-90';
            return (
              <article
                key={entry.seq}
                className={`flex items-center justify-between rounded-xl bg-surface-container-lowest p-md shadow-level-2 border-l-2 ${border} ${opacity} transition-shadow hover:shadow-level-3`}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Pago #{entry.seq}</span>
                  <span className={`font-headline-md text-headline-md ${overdue ? 'text-error' : entry.status === 'PAID' ? 'text-on-surface-variant' : 'text-primary'}`}>
                    {formatShortDate(entry.dueDate)}
                  </span>
                  <div
                    className={`mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 font-label-md text-[12px] w-max ${overdue ? 'bg-error-container text-on-error-container' : next ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : entry.status === 'PAID' ? 'bg-success-container text-success' : 'bg-warning-container text-warning'}`}
                  >
                    <Icon name={overdue ? 'error' : next ? 'schedule' : entry.status === 'PAID' ? 'check_circle' : 'hourglass_empty'} size={14} />
                    {overdue ? 'Vencido' : next ? 'Siguiente' : entry.status === 'PAID' ? 'Pagado' : 'Pendiente'}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-data-lg text-data-lg ${entry.status === 'PAID' ? 'text-on-surface-variant' : 'text-primary'}`}>{currency.format(entry.amount)}</span>
                  {next && (
                    <div className="mt-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 font-label-md text-label-md text-on-surface-variant border border-outline-variant cursor-not-allowed"
                        title="Tu cobrador registra el pago — P4 pendiente de definir autopago"
                      >
                        Pagar <Icon name="arrow_forward" size={14} />
                      </span>
                    </div>
                  )}
                  {overdue && (
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 font-label-md text-label-md text-secondary hover:underline"
                      title="Tu cobrador registra el pago"
                    >
                      Pagar <Icon name="arrow_forward" size={16} />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface pb-24 text-on-surface">
      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-surface px-margin-mobile">
        <span className="font-headline-md text-headline-lg-mobile font-bold text-primary">Prestamitos</span>
        <div className="flex items-center gap-md">
          <NotificationsBell />
          <button type="button" onClick={() => logout()} className="text-primary transition-opacity hover:opacity-80" aria-label="Cerrar sesión">
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-margin-mobile pt-20">{inner}</main>
      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl bg-surface-container-lowest px-2 shadow-[0px_-4px_20px_rgba(26,43,76,0.05)]">
        {CLIENT_NAV.map((item, i) => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex w-16 flex-col items-center justify-center gap-1 rounded-lg p-2 transition-transform active:scale-90 ${i === 1 ? 'font-bold text-secondary-container' : 'text-on-surface-variant'}`}
          >
            <Icon name={item.icon} filled={i === 1} />
            <span className="font-label-md text-[11px] leading-none">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
