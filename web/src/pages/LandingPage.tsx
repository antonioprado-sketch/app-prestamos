import { Link } from 'react-router-dom';
import { CalculatorPage } from './CalculatorPage';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

const ACCESS = [
  { role: 'Cliente', to: '/cliente', icon: 'person', desc: 'Solicita y paga tus préstamos' },
  { role: 'Cobrador', to: '/cobrador', icon: 'work', desc: 'Gestiona tu cartera' },
  { role: 'Administrador', to: '/admin', icon: 'admin_panel_settings', desc: 'Panel de administración' },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-white/90 px-4 backdrop-blur">
        <span className="font-headline-md text-headline-lg-mobile font-bold text-primary">
          Prestamitos
        </span>
        <Link to="/login">
          <Button type="button">Iniciar sesión</Button>
        </Link>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <section aria-label="Accesos por rol" className="mb-6 grid gap-3 sm:grid-cols-3">
          {ACCESS.map((a) => (
            <Link
              key={a.role}
              to={a.to}
              className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-primary"
            >
              <Icon name={a.icon} filled className="text-primary" />
              <span className="font-semibold text-secondary">{a.role}</span>
              <span className="text-xs text-secondary">{a.desc}</span>
            </Link>
          ))}
        </section>
        <CalculatorPage />
      </div>
    </div>
  );
}
