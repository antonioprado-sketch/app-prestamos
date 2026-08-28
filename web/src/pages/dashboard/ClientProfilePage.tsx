import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { NotificationsBell } from '../../components/NotificationsBell';
import { PasswordRules, isPasswordValid } from '../../components/PasswordRules';

interface MeResponse {
  user: { phone: string; email: string | null; role: string; mustChangePassword: boolean };
  customer: { nombres: string | null; apellidos: string | null; email: string | null } | null;
  lastLoginAt: string;
}

const CLIENT_NAV = [
  { icon: 'home', label: 'Inicio', to: '/app/cliente' },
  { icon: 'payments', label: 'Pagos', to: '/app/cliente/pagos' },
  { icon: 'notifications', label: 'Notificaciones', to: '/app/cliente/notificaciones' },
  { icon: 'person', label: 'Perfil', to: '/app/cliente/perfil' },
] as const;

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ClientProfilePage() {
  const { logout, changePassword } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<MeResponse>('/auth/me')
      .then(setMe)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!isPasswordValid(next, confirm)) {
      setError('La nueva contraseña no cumple todas las reglas');
      return;
    }
    if (next !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

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
        <main className="mx-auto max-w-3xl px-margin-mobile pt-20 w-full flex justify-center py-12">
          <Spinner />
        </main>
      </div>
    );
  }

  const phone = me?.user.phone ?? '';
  const email = me?.user.email ?? me?.customer?.email ?? '';
  const nombres = me?.customer?.nombres ?? '';
  const apellidos = me?.customer?.apellidos ?? '';
  const lastLogin = me?.lastLoginAt ? formatDate(me.lastLoginAt) : '—';

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
      <main className="mx-auto max-w-3xl px-margin-mobile pt-20">
        <div className="flex items-center gap-2">
          <Link to="/app/cliente" className="rounded-full p-1 hover:bg-surface-container text-primary">
            <Icon name="arrow_back" size={20} />
          </Link>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">Mi perfil</h1>
        </div>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Consulta tus datos y cambia tu contraseña.</p>

        <Card className="mt-4">
          <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-3">Datos personales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant">Teléfono (no editable)</label>
              <input value={phone} disabled className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-body-md text-body-md text-on-surface" />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant">Correo</label>
              <input value={email || '— sin correo registrado —'} disabled className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface" />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant">Nombres</label>
              <input value={nombres || '—'} disabled className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface" />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant">Apellidos</label>
              <input value={apellidos || '—'} disabled className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface" />
            </div>
            <div className="md:col-span-2">
              <label className="font-label-md text-label-md text-on-surface-variant">Última conexión</label>
              <input value={lastLogin} disabled className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface" />
            </div>
          </div>
          {!email && (
            <div className="mt-4">
              <Alert variant="warning">No tienes correo registrado — no podremos enviarte la confirmación de cambio de contraseña. Contacta a tu administrador.</Alert>
            </div>
          )}
        </Card>

        <Card className="mt-4">
          <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-1">Cambiar contraseña</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">Te pediremos tu contraseña actual por seguridad. La nueva debe tener al menos 8 caracteres, alfanuméricos y carácter especial.</p>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">Contraseña actualizada — te enviamos confirmación a tu correo.</Alert>}
            <Input label="Contraseña actual *" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            <Input label="Nueva contraseña *" type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
            <Input label="Confirmar nueva contraseña *" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <PasswordRules password={next} confirm={confirm} />
            <Button type="submit" loading={saving} disabled={!isPasswordValid(next, confirm) || !current}>
              Guardar nueva contraseña
            </Button>
          </form>
        </Card>
      </main>
      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl bg-surface-container-lowest px-2 shadow-[0px_-4px_20px_rgba(26,43,76,0.05)]">
        {CLIENT_NAV.map((item, i) => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex w-16 flex-col items-center justify-center gap-1 rounded-lg p-2 ${i === 3 ? 'font-bold text-secondary-container' : 'text-on-surface-variant'}`}
          >
            <Icon name={item.icon} filled={i === 3} />
            <span className="font-label-md text-[11px] leading-none">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
