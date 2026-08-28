import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { PasswordRules, isPasswordValid } from '../components/PasswordRules';

function homeFor(role: string) {
  if (role === 'ADMIN') return '/admin/indicadores';
  if (role === 'COLLECTOR') return '/app/cobrador';
  return '/app/cliente';
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener mínimo 8 caracteres';
  if (password.length > 64) return 'La contraseña debe tener máximo 64 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula';
  if (!/[a-z]/.test(password)) return 'La contraseña debe tener al menos una minúscula';
  if (!/\d/.test(password)) return 'La contraseña debe tener al menos un número';
  if (!/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe tener al menos un carácter especial';
  return null;
}

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const policyError = validatePassword(next);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (next !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
      navigate(homeFor(user?.role ?? 'CLIENT'), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-bold text-secondary">Cambiar contraseña</h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">Contraseña actualizada</Alert>}
          <Input
            label="Contraseña actual"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Input
            label="Nueva contraseña"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <PasswordRules password={next} confirm={confirm} />
          <Button type="submit" loading={loading} disabled={!isPasswordValid(next, confirm) || !current}>
            Guardar
          </Button>
        </form>
      </Card>
    </main>
  );
}
