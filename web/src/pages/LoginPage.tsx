import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import type { Role } from '../store/auth';
import { ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { InstallButton } from '../components/InstallButton';

function homeFor(role: string) {
  if (role === 'ADMIN') return '/admin/indicadores';
  if (role === 'COLLECTOR') return '/app/cobrador';
  return '/app/cliente';
}

const ROLE_ACCESS: Partial<Record<Role, { label: string }>> = {
  CLIENT: { label: 'Acceso cliente' },
  COLLECTOR: { label: 'Acceso cobrador' },
  ADMIN: { label: 'Acceso administrador' },
};

export function LoginPage({ role }: { role?: Role }) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const access = role ? ROLE_ACCESS[role] : undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(phone, password);
      if (role && user.role !== role) {
        await logout();
        setError('Esta cuenta no corresponde al acceso seleccionado.');
        setLoading(false);
        return;
      }
      navigate(user.mustChangePassword ? '/change-password' : homeFor(user.role), {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  const allowRegister = role !== 'COLLECTOR' && role !== 'ADMIN';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Prestamitos</h1>
        {access && (
          <p className="mb-4 text-center text-sm font-semibold text-primary">{access.label}</p>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Input
            label="Teléfono"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading}>
            Entrar
          </Button>
        </form>
        {allowRegister && (
          <p className="mt-4 text-center text-sm text-secondary">
            ¿No tienes cuenta? <Link to="/register" className="text-primary">Regístrate</Link>
          </p>
        )}
        <p className="mt-2 text-center text-sm text-secondary">
          <Link to="/" className="text-primary">Volver al inicio</Link>
        </p>
        <div className="mt-4">
          <InstallButton variant="secondary" />
        </div>
      </Card>
    </main>
  );
}
