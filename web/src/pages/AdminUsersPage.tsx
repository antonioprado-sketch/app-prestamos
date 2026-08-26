import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { Button } from '../components/ui/Button';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Icon } from '../components/ui/Icon';

type Role = 'CLIENT' | 'COLLECTOR' | 'ADMIN';
type Status = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
interface AdminUser { phone: string; name: string | null; role: Role; status: Status; mustChangePassword: boolean; createdAt: string; }

const ROLE_LABEL: Record<Role, string> = { CLIENT: 'Cliente', COLLECTOR: 'Cobrador', ADMIN: 'Admin' };
const ROLE_PILL: Record<Role, string> = { CLIENT: 'bg-[#00A2FD] text-white', COLLECTOR: 'bg-[#F5A623] text-white', ADMIN: 'bg-[#031636] text-white' };
const STATUS_DOT: Record<Status, string> = { ACTIVE: 'bg-green-500', INACTIVE: 'bg-gray-400', BLOCKED: 'bg-red-500' };

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ phone: string; tempPassword: string } | null>(null);

  const load = () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    const query = params.toString() ? `?${params.toString()}` : '';
    apiFetch<AdminUser[]>(`/admin/users${query}`).then(setUsers).catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar')).finally(() => setLoading(false));
  };
  useEffect(load, [roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const activos = users.filter((u) => u.status === 'ACTIVE').length;
    return { total, activos, inactivos: total - activos };
  }, [users]);

  const resetPassword = async (phone: string) => {
    setActionLoading(phone); setError(null); setResetResult(null);
    try { const res = await apiFetch<{ tempPassword: string }>(`/admin/users/${phone}/reset-password`, { method: 'POST' }); setResetResult({ phone, tempPassword: res.tempPassword }); load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo resetear'); } finally { setActionLoading(null); }
  };
  const changeRole = async (phone: string, role: 'CLIENT' | 'COLLECTOR') => {
    setActionLoading(phone); setError(null);
    try { await apiFetch(`/admin/users/${phone}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }); load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo cambiar rol'); } finally { setActionLoading(null); }
  };
  const toggleCollectorStatus = async (phone: string, active: boolean) => {
    setActionLoading(phone); setError(null);
    try { await apiFetch(`/admin/collectors/${phone}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }); load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo actualizar'); } finally { setActionLoading(null); }
  };

  return (
    <AdminShell active="usuarios" title="Usuarios">
      <div className="mx-auto max-w-5xl space-y-lg">
        <div className="rounded-xl bg-primary p-lg text-white shadow-level-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold">Usuarios</h2>
              <p className="font-body-sm text-body-sm text-white/70">Clientes, cobradores y admins — {stats.total} total · {stats.activos} activos</p>
            </div>
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-white/10 items-center justify-center"><Icon name="group" className="text-white" /></div>
          </div>
          <div className="mt-md flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-white text-primary font-bold text-xs">Total {stats.total}</span>
            <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs">Activos {stats.activos}</span>
            <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs">Inactivos {stats.inactivos}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Todos', value: '', count: users.length },
            { label: 'Clientes', value: 'CLIENT', count: users.filter(u=>u.role==='CLIENT').length },
            { label: 'Cobradores', value: 'COLLECTOR', count: users.filter(u=>u.role==='COLLECTOR').length },
            { label: 'Admins', value: 'ADMIN', count: users.filter(u=>u.role==='ADMIN').length },
          ].map((f) => (
            <button key={f.label} type="button" onClick={() => setRoleFilter(f.value)} className={`px-4 py-2 rounded-full font-label-md text-label-md border transition-colors flex items-center gap-2 ${roleFilter===f.value ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant hover:bg-surface-container-low'}`}>
              {f.label} <span className={`px-1.5 py-0.5 rounded-full text-xs ${roleFilter===f.value ? 'bg-white/20 text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>{f.count}</span>
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="rounded-full border border-outline-variant bg-white px-3 py-2 text-sm">
              <option value="">Todos estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option><option value="BLOCKED">Bloqueados</option>
            </select>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {resetResult && <Alert variant="success">Temporal para <strong>{resetResult.phone}</strong>: <strong>{resetResult.tempPassword}</strong> (cópiala, no se vuelve a mostrar)</Alert>}

        {loading ? <div className="flex justify-center py-12"><Spinner /></div> : users.length===0 ? <p className="py-8 text-center text-sm text-secondary">No hay usuarios con ese filtro.</p> : (
          <div className="flex flex-col gap-3">
            {users.map((u) => {
              const isSelf = u.phone===me?.phone;
              const initial = (u.name?.[0] ?? u.phone[0]).toUpperCase();
              const roleColor = ROLE_PILL[u.role];
              return (
                <div key={u.phone} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md shadow-level-2 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0">{initial}</div>
                      <div className="min-w-0">
                        <p className="font-body-md text-body-md font-semibold text-on-surface truncate">{u.name || u.phone}</p>
                        <p className="text-xs text-on-surface-variant truncate">{u.phone} · {u.mustChangePassword ? 'debe cambiar pass' : ROLE_LABEL[u.role]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${roleColor}`}>{ROLE_LABEL[u.role]}</span>
                      <span className="hidden sm:flex items-center gap-1 text-xs text-on-surface-variant"><span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[u.status]}`} />{u.status}</span>
                    </div>
                  </div>
                  {!isSelf && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/30">
                      <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>resetPassword(u.phone)} className="flex-1 min-w-[140px] border border-outline-variant"><Icon name="key" size={16} /> Reset pass</Button>
                      {u.role==='COLLECTOR' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>toggleCollectorStatus(u.phone, u.status!=='ACTIVE')} className="flex-1 min-w-[120px] border border-outline-variant">{u.status==='ACTIVE'?'Desactivar':'Activar'}</Button>}
                      {u.role==='CLIENT' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>changeRole(u.phone,'COLLECTOR')} className="flex-1 min-w-[140px] border border-outline-variant">→ Cobrador</Button>}
                      {u.role==='COLLECTOR' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>changeRole(u.phone,'CLIENT')} className="flex-1 min-w-[140px] border border-outline-variant">→ Cliente</Button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
