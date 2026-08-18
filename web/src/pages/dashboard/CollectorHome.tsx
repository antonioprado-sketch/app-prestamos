import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { Icon } from '../../components/ui/Icon';

interface ScheduleEntry {
  seq: number;
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  paidAmount: number;
}

interface CollectorLoan {
  id: string;
  folio: string;
  status: string;
  customerPhone: string;
  customerName: string | null;
  schedule: ScheduleEntry[];
}

const PAYABLE_STATUSES = ['APPROVED', 'ACTIVE'];
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

export function CollectorHome() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<CollectorLoan[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch<CollectorLoan[]>('/collector/loans')
      .then((all) => setLoans(all.filter((l) => PAYABLE_STATUSES.includes(l.status))))
      .catch(() => undefined);
  }, []);

  const today = todayIso();

  const rows = useMemo(() => {
    const withNext = loans.map((loan) => {
      const next = loan.schedule.find((s) => s.status !== 'PAID');
      const overdue = !!next && next.dueDate < today;
      return { loan, next, overdue };
    });
    const filtered = search
      ? withNext.filter(
          (r) =>
            (r.loan.customerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
            r.loan.folio.toLowerCase().includes(search.toLowerCase()),
        )
      : withNext;
    return filtered.sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0));
  }, [loans, search, today]);

  const pendingCount = rows.filter((r) => r.next).length;
  const overdueTotal = rows
    .filter((r) => r.overdue && r.next)
    .reduce((acc, r) => acc + (r.next!.amount - r.next!.paidAmount), 0);

  return (
    <div className="flex flex-col gap-lg">
      <section>
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">
          Hola{user?.phone ? `, ${user.phone}` : ''}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Tu cartera de hoy</p>
        <div className="mt-md flex items-center justify-between rounded-xl bg-surface-container-lowest p-md shadow-level-2">
          <div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Préstamos por cobrar</p>
            <p className="font-data-lg text-data-lg text-primary">{pendingCount}</p>
          </div>
          <div className="text-right">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Vencido</p>
            <p className="font-headline-md text-headline-md text-secondary-container">
              {currency.format(overdueTotal)}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="relative rounded-lg border border-outline-variant bg-surface-container-lowest transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Icon
            name="search"
            className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant"
            size={20}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full rounded-lg bg-transparent py-sm pl-10 pr-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-md font-headline-md text-headline-md text-primary">Cobros de hoy</h3>
        {rows.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No tienes préstamos pendientes de cobro.
          </p>
        ) : (
          <div className="flex flex-col gap-md">
            {rows.map(({ loan, next, overdue }) => (
              <article
                key={loan.id}
                className={`rounded-xl bg-surface-container-lowest p-md shadow-level-2 ${
                  overdue ? 'border-l-2 border-error' : 'border-l-2 border-transparent'
                }`}
              >
                <div className="mb-sm flex items-start justify-between">
                  <div>
                    <h4 className="font-headline-md text-headline-md leading-tight text-primary">
                      {loan.customerName || loan.customerPhone}
                    </h4>
                    <p className="mt-base font-body-sm text-body-sm text-on-surface-variant">
                      {loan.folio}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-xs py-base font-label-md text-label-md ${
                      overdue ? 'bg-error/10 text-error' : 'bg-secondary-container/10 text-secondary-container'
                    }`}
                  >
                    {overdue ? 'Vencido' : 'Pendiente'}
                  </span>
                </div>
                {next && (
                  <div className="mt-md flex items-end justify-between">
                    <div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Importe</p>
                      <p className="font-data-lg text-data-lg text-primary">
                        {currency.format(next.amount - next.paidAmount)}
                      </p>
                    </div>
                    <Link
                      to="/collector/cartera"
                      className="flex min-h-[48px] items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-md text-label-md text-white transition-opacity active:opacity-80"
                    >
                      <Icon name="payments" size={20} />
                      Registrar Pago
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
