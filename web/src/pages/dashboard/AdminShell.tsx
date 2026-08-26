import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { Icon } from '../../components/ui/Icon';
import { NotificationsBell } from '../../components/NotificationsBell';

export type AdminNavKey =
  | 'dashboard'
  | 'solicitudes'
  | 'manual'
  | 'clientes'
  | 'usuarios'
  | 'blacklist'
  | 'ubicaciones'
  | 'aumentos'
  | 'configuracion';

const NAV_ITEMS: { key: AdminNavKey; label: string; icon: string; to: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid_view', to: '/admin/indicadores' },
  { key: 'solicitudes', label: 'Solicitudes', icon: 'pending_actions', to: '/admin/solicitudes' },
  { key: 'manual', label: 'Nuevo préstamo', icon: 'add', to: '/admin/prestamos/nuevo' },
  { key: 'clientes', label: 'Clientes', icon: 'badge', to: '/admin/clientes' },
  { key: 'usuarios', label: 'Usuarios', icon: 'directions_run', to: '/admin/usuarios' },
  { key: 'blacklist', label: 'Lista negra', icon: 'block', to: '/admin/blacklist' },
  { key: 'aumentos', label: 'Aumentos', icon: 'trending_up', to: '/admin/aumentos' },
  { key: 'ubicaciones', label: 'Ubicaciones', icon: 'location_on', to: '/admin/ubicaciones' },
  { key: 'configuracion', label: 'Configuración', icon: 'settings', to: '/admin/configuracion' },
];

export function AdminShell({
  active,
  title,
  children,
}: {
  active: AdminNavKey;
  title: string;
  children: ReactNode;
}) {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background text-on-surface">
      <nav className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col gap-2 border-r border-outline-variant bg-surface-container-low p-6 md:flex">
        <div className="mb-8 font-headline-md text-headline-md text-primary">Prestamitos Admin</div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-colors ${
              item.key === active
                ? 'border-l-2 border-secondary-container bg-secondary-fixed text-on-secondary-fixed'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <Icon name={item.icon} filled={item.key === active} />
            <span className="font-body-md text-body-md">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => logout()}
          className="mt-auto flex items-center gap-4 rounded-lg px-4 py-3 text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="logout" />
          <span className="font-body-md text-body-md">Cerrar sesión</span>
        </button>
      </nav>

      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-outline-variant/30 bg-surface px-margin-mobile md:px-margin-desktop">
          <span className="font-headline-md text-headline-md font-bold text-primary md:hidden">
            Prestamitos
          </span>
          <div className="hidden font-headline-md text-headline-md text-on-surface md:block">
            {title}
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <button
              type="button"
              onClick={() => logout()}
              className="text-on-surface-variant transition-opacity hover:opacity-80 md:hidden"
              aria-label="Cerrar sesión"
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop">{children}</div>
      </div>
    </div>
  );
}
