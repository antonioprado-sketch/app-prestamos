import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export function NotificationsBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    apiFetch<NotificationItem[]>('/notifications')
      .then(setItems)
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setOpen(false);
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => undefined);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-primary-light"
      >
        <span aria-hidden className="text-xl">
          🔔
        </span>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl2 border border-gray-200 bg-white shadow-lg">
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-4 text-sm text-secondary">Sin notificaciones por ahora.</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`block w-full border-b border-gray-100 p-3 text-left last:border-b-0 ${
                  n.read ? 'bg-white' : 'bg-primary-light'
                }`}
              >
                <p className="text-sm font-semibold text-secondary">{n.title}</p>
                <p className="text-xs text-secondary">{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
