import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

type Role = 'CLIENT' | 'COLLECTOR' | 'ADMIN';
type Status = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

interface AdminUser {
  phone: string;
  name: string | null;
  role: Role;
  status: Status;
  mustChangePassword: boolean;
  createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = {
  CLIENT: 'Cliente',
  COLLECTOR: 'Cobrador',
  ADMIN: 'Admin',
};

const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  BLOCKED: 'Bloqueado',
};

const STATUS_DOT: Record<Status, string> = {
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  BLOCKED: 'bg-red-500',
};

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ phone: string; tempPassword: string } | null>(
    null,
  );

  const load = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    const query = params.toString() ? `?${params.toString()}` : '';
    apiFetch<AdminUser[]>(`/admin/users${query}`)
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [roleFilter, statusFilter]);

  const resetPassword = async (phone: string) => {
    setActionLoading(phone);
    setError(null);
    setResetResult(null);
    try {
      const res = await apiFetch<{ tempPassword: string }>(
        `/admin/users/${phone}/reset-password`,
        { method: 'POST' },
      );
      setResetResult({ phone, tempPassword: res.tempPassword });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo resetear la contraseña');
    } finally {
      setActionLoading(null);
    }
  };

  const changeRole = async (phone: string, role: 'CLIENT' | 'COLLECTOR') => {
    setActionLoading(phone);
    setError(null);
    try {
      await apiFetch(`/admin/users/${phone}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el rol');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleCollectorStatus = async (phone: string, active: boolean) => {
    setActionLoading(phone);
    setError(null);
    try {
      await apiFetch(`/admin/collectors/${phone}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AdminShell active="usuarios" title="Usuarios">
      <Card className="mx-auto w-full max-w-3xl">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Usuarios</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Clientes, cobradores y admins en un solo lugar
        </p>

        <div className="mb-4 flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">Todos los roles</option>
            <option value="CLIENT">Clientes</option>
            <option value="COLLECTOR">Cobradores</option>
            <option value="ADMIN">Admins</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
            <option value="BLOCKED">Bloqueados</option>
          </select>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {resetResult && (
          <Alert variant="success">
            Contraseña temporal para <strong>{resetResult.phone}</strong> (compártela por un
            canal seguro, no se vuelve a mostrar): <strong>{resetResult.tempPassword}</strong>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary">No hay usuarios con ese filtro.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {users.map((u) => {
              const isSelf = u.phone === me?.phone;
              return (
                <div key={u.phone} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-secondary">{u.name || u.phone}</p>
                      <p className="text-xs text-secondary">
                        {u.phone} · {ROLE_LABEL[u.role]}
                        {u.mustChangePassword ? ' · debe cambiar contraseña' : ''}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-secondary">
                      <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[u.status]}`} />
                      {STATUS_LABEL[u.status]}
                    </span>
                  </div>

                  {!isSelf && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        loading={actionLoading === u.phone}
                        onClick={() => resetPassword(u.phone)}
                        className="flex-1"
                      >
                        Resetear contraseña
                      </Button>

                      {u.role === 'COLLECTOR' && (
                        <Button
                          type="button"
                          variant="ghost"
                          loading={actionLoading === u.phone}
                          onClick={() => toggleCollectorStatus(u.phone, u.status !== 'ACTIVE')}
                          className="flex-1"
                        >
                          {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                        </Button>
                      )}

                      {u.role === 'CLIENT' && (
                        <Button
                          type="button"
                          variant="ghost"
                          loading={actionLoading === u.phone}
                          onClick={() => changeRole(u.phone, 'COLLECTOR')}
                          className="flex-1"
                        >
                          Convertir en cobrador
                        </Button>
                      )}

                      {u.role === 'COLLECTOR' && (
                        <Button
                          type="button"
                          variant="ghost"
                          loading={actionLoading === u.phone}
                          onClick={() => changeRole(u.phone, 'CLIENT')}
                          className="flex-1"
                        >
                          Convertir en cliente
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
