import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../store/auth';
import { NotificationsBell } from '../../components/NotificationsBell';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const CLIENT_NAV = [
  { icon: 'home', label: 'Inicio', to: '/app/cliente' },
  { icon: 'payments', label: 'Pagos', to: '/app/cliente/pagos' },
  { icon: 'notifications', label: 'Notificaciones', to: '/app/cliente/notificaciones' },
  { icon: 'person', label: 'Perfil', to: '/app/cliente' },
] as const;

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ClientNotificationsPage() {
  const { logout } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const load = () => {
    setLoading(true);
    apiFetch<NotificationItem[]>('/notifications')
      .then(setItems)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => undefined);
  };

  const filtered = filter === 'UNREAD' ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-surface pb-24 text-on-surface">
      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-surface px-margin-mobile">
        <span className="font-headline-md text-headline-lg-mobile font-bold text-primary">Prestamitos</span>
        <div className="flex items-center gap-md">
          <NotificationsBell />
          <button type="button" onClick={() => logout()} className="text-primary" aria-label="Cerrar sesión">
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-margin-mobile pt-20">
        <div className="flex items-center gap-2">
          <Link to="/app/cliente" className="rounded-full p-1 hover:bg-surface-container text-primary">
            <Icon name="arrow_back" size={20} />
          </Link>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">Notificaciones</h1>
        </div>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Historial de todas las notificaciones que has recibido.</p>

        <div className="mt-4 flex gap-sm">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`rounded-full px-4 py-2 font-label-md text-label-md ${filter === 'ALL' ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant border border-outline-variant'}`}
          >
            Todas ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('UNREAD')}
            className={`rounded-full px-4 py-2 font-label-md text-label-md ${filter === 'UNREAD' ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant border border-outline-variant'}`}
          >
            No leídas ({unreadCount})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center font-body-sm text-body-sm text-on-surface-variant">Sin notificaciones en este filtro.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-sm">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-md shadow-level-2 ${n.read ? 'bg-surface-container-lowest border-outline-variant opacity-80' : 'bg-surface-container-lowest border-secondary-container'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-label-md text-label-md font-bold text-primary">{n.title}</p>
                    <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{n.body}</p>
                    <p className="mt-2 font-body-sm text-[11px] text-outline">{formatDate(n.createdAt)} · {n.type}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="shrink-0 rounded-full bg-primary px-3 py-1.5 font-label-md text-[11px] text-white"
                    >
                      Marcar leída
                    </button>
                  )}
                </div>
                {n.read && <p className="mt-2 font-label-md text-[11px] text-success">✓ Leída</p>}
              </div>
            ))}
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl bg-surface-container-lowest px-2 shadow-[0px_-4px_20px_rgba(26,43,76,0.05)]">
        {CLIENT_NAV.map((item, i) => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex w-16 flex-col items-center justify-center gap-1 rounded-lg p-2 ${i === 2 ? 'font-bold text-secondary-container' : 'text-on-surface-variant'}`}
          >
            <Icon name={item.icon} filled={i === 2} />
            <span className="font-label-md text-[11px] leading-none">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
