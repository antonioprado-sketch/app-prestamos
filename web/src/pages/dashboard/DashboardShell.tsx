import { Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { Icon } from '../../components/ui/Icon';
import { LocationConsentBanner } from '../../components/LocationConsentBanner';
import { WelcomeTour } from '../../components/WelcomeTour';
import { PushConsentBanner } from '../../components/PushConsentBanner';
import { NotificationsBell } from '../../components/NotificationsBell';
import { ClientHome } from './ClientHome';
import { CollectorHome } from './CollectorHome';

type DashboardRole = 'CLIENT' | 'COLLECTOR';

const CLIENT_NAV = [
  { icon: 'home', label: 'Inicio', to: '/app/cliente' },
  { icon: 'account_balance_wallet', label: 'Préstamos', to: '/calculadora' },
  { icon: 'payments', label: 'Pagos', to: '/calculadora' },
  { icon: 'notifications', label: 'Notificaciones', to: '/app/cliente' },
  { icon: 'person', label: 'Perfil', to: '/app/cliente' },
] as const;

export function DashboardShell({ role }: { role: DashboardRole }) {
  const { logout } = useAuth();

  if (role === 'CLIENT') {
    return (
      <div className="min-h-screen bg-surface pb-24 text-on-surface">
        <WelcomeTour />
        <LocationConsentBanner />
        <PushConsentBanner />
        <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-surface px-margin-mobile">
          <div className="flex items-center gap-xs">
            <span className="font-headline-md text-headline-lg-mobile font-bold text-primary">
              LendWise
            </span>
          </div>
          <div className="flex items-center gap-md">
            <NotificationsBell />
            <button
              type="button"
              onClick={() => logout()}
              className="text-primary transition-opacity hover:opacity-80"
              aria-label="Cerrar sesión"
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-margin-mobile pt-20">
          <ClientHome />
        </main>
        <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl bg-surface-container-lowest px-2 shadow-[0px_-4px_20px_rgba(26,43,76,0.05)]">
          {CLIENT_NAV.map((item, i) => (
            <Link
              key={item.label}
              to={item.to}
              className={`flex w-16 flex-col items-center justify-center gap-1 rounded-lg p-2 transition-transform active:scale-90 ${
                i === 0 ? 'font-bold text-secondary-container' : 'text-on-surface-variant'
              }`}
            >
              <Icon name={item.icon} filled={i === 0} />
              <span className="font-label-md text-[11px] leading-none">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-24 text-on-surface">
        <PushConsentBanner />
        <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-surface px-margin-mobile">
          <span className="font-headline-md text-headline-md font-bold text-primary">LendWise</span>
          <div className="flex items-center gap-md">
            <NotificationsBell />
            <button
              type="button"
              onClick={() => logout()}
              className="text-primary transition-opacity hover:opacity-80"
              aria-label="Cerrar sesión"
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-margin-mobile pt-20">
          <CollectorHome />
        </main>
        <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl bg-surface-container-lowest px-2 shadow-[0px_-4px_20px_rgba(26,43,76,0.05)]">
          <div className="flex w-16 flex-col items-center justify-center gap-1 font-bold text-secondary-container">
            <Icon name="dashboard" filled />
            <span className="font-label-md text-[11px] leading-none">Inicio</span>
          </div>
          <Link to="/collector/cartera" className="flex w-16 flex-col items-center justify-center gap-1 text-on-surface-variant">
            <Icon name="group" />
            <span className="font-label-md text-[11px] leading-none">Clientes</span>
          </Link>
        </nav>
      </div>
  );
}
