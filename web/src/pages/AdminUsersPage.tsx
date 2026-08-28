import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Icon } from '../components/ui/Icon';
import { PasswordRules, isPasswordValid } from '../components/PasswordRules';

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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ phone: string; tempPassword: string; emailSent: boolean } | null>(null);
  const [resetModalPhone, setResetModalPhone] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteModalPhone, setDeleteModalPhone] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    const query = params.toString() ? `?${params.toString()}` : '';
    apiFetch<AdminUser[]>(`/admin/users${query}`).then(setUsers).catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar')).finally(() => setLoading(false));
  };
  useEffect(load, [roleFilter, statusFilter, debouncedSearch]);

  const stats = useMemo(() => {
    const total = users.length;
    const activos = users.filter((u) => u.status === 'ACTIVE').length;
    return { total, activos, inactivos: total - activos };
  }, [users]);

  const openResetModal = (phone: string) => {
    setResetModalPhone(phone);
    setNewPassword('');
    setConfirmPassword('');
    setResetError(null);
    setResetResult(null);
  };

  const resetPassword = async () => {
    if (!resetModalPhone) return;
    if (!isPasswordValid(newPassword, confirmPassword)) {
      setResetError('La contraseña no cumple todas las reglas');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Las contraseñas no coinciden');
      return;
    }
    setActionLoading(resetModalPhone);
    setError(null);
    setResetError(null);
    try {
      const res = await apiFetch<{ tempPassword: string; emailSent: boolean }>(`/admin/users/${resetModalPhone}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      setResetResult({ phone: resetModalPhone, tempPassword: res.tempPassword, emailSent: res.emailSent });
      setResetModalPhone(null);
      load();
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : 'No se pudo resetear');
    } finally {
      setActionLoading(null);
    }
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

  const openDeleteModal = (phone: string) => {
    setDeleteModalPhone(phone);
    setDeleteConfirm('');
    setDeleteError(null);
  };

  const deleteUser = async () => {
    if (!deleteModalPhone) return;
    if (deleteConfirm !== deleteModalPhone) {
      setDeleteError('Escribe el teléfono exacto para confirmar');
      return;
    }
    setActionLoading(deleteModalPhone);
    setError(null);
    setDeleteError(null);
    try {
      await apiFetch(`/admin/users/${deleteModalPhone}`, { method: 'DELETE' });
      setDeleteModalPhone(null);
      setDeleteConfirm('');
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'No se pudo eliminar');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AdminShell active="usuarios" title="Usuarios">
      <div className="mx-auto max-w-5xl space-y-lg">
        <div className="rounded-xl bg-primary p-md text-white shadow-level-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold">Usuarios</h2>
              <p className="font-body-sm text-body-sm text-white/70">{stats.total} total · {stats.activos} activos · {stats.inactivos} inactivos</p>
            </div>
            <div className="hidden md:flex w-9 h-9 rounded-xl bg-white/10 items-center justify-center shrink-0"><Icon name="group" className="text-white" size={18} /></div>
          </div>
        </div>

        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por teléfono o nombre… ej. 5588 o Juan"
              className="w-full rounded-full border border-outline-variant bg-white pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-container text-on-surface-variant text-xs">
                ✕
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-on-surface-variant">{loading ? 'Buscando…' : `${users.length} resultados`}{debouncedSearch ? ` para "${debouncedSearch}"` : ''}</span>
            {debouncedSearch && (
              <button type="button" onClick={() => setSearch('')} className="font-body-sm text-body-sm text-primary">
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Todos', value: '', count: users.length },
            { label: 'Clientes', value: 'CLIENT', count: users.filter(u=>u.role==='CLIENT').length },
            { label: 'Cobradores', value: 'COLLECTOR', count: users.filter(u=>u.role==='COLLECTOR').length },
            { label: 'Admins', value: 'ADMIN', count: users.filter(u=>u.role==='ADMIN').length },
          ].map((f) => (
            <button key={f.label} type="button" onClick={() => setRoleFilter(f.value)} className={`px-3 py-1.5 rounded-full font-label-md text-[12px] border transition-colors flex items-center gap-1.5 ${roleFilter===f.value ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant hover:bg-surface-container-low'}`}>
              {f.label} <span className={`px-1 py-0.5 rounded-full text-[11px] ${roleFilter===f.value ? 'bg-white/20 text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>{f.count}</span>
            </button>
          ))}
          <div className="ml-auto">
            <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="rounded-full border border-outline-variant bg-white px-3 py-1.5 text-sm">
              <option value="">Todos estados</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option><option value="BLOCKED">Bloqueados</option>
            </select>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {resetResult && (
          <Alert variant="success">
            Contraseña para <strong>{resetResult.phone}</strong> reseteada a <strong>{resetResult.tempPassword}</strong>
            {resetResult.emailSent ? ' — correo enviado al registrado.' : ' — sin correo registrado, cópiala manualmente.'}
          </Alert>
        )}

        {loading ? <div className="flex justify-center py-12"><Spinner /></div> : users.length===0 ? <p className="py-8 text-center text-sm text-secondary">No hay usuarios con ese filtro.</p> : (
          <>
            <div className="hidden md:block overflow-hidden rounded-xl border border-outline-variant bg-white shadow-level-2">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2 text-left">Usuario</th>
                    <th className="px-3 py-2 text-left">Rol</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.phone===me?.phone;
                    const initial = (u.name?.[0] ?? u.phone[0]).toUpperCase();
                    const roleColor = ROLE_PILL[u.role];
                    return (
                      <tr key={u.phone} className="border-t border-outline-variant/20 hover:bg-surface-container-low">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{initial}</div>
                            <div className="min-w-0">
                              <div className="font-semibold text-on-surface text-xs truncate">{u.name || u.phone}</div>
                              <div className="text-[11px] text-on-surface-variant truncate">{u.phone}{u.mustChangePassword ? ' · debe cambiar pass' : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${roleColor}`}>{ROLE_LABEL[u.role]}</span></td>
                        <td className="px-3 py-2"><span className="flex items-center gap-1 text-xs text-on-surface-variant"><span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[u.status]}`} />{u.status}</span></td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {!isSelf ? (
                              <>
                                <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>openResetModal(u.phone)} className="h-7 px-2 text-xs border border-outline-variant"><Icon name="key" size={12} /></Button>
                                {u.role==='CLIENT' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>changeRole(u.phone,'COLLECTOR')} className="h-7 px-2 text-xs border border-outline-variant">→C</Button>}
                                {u.role==='COLLECTOR' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>changeRole(u.phone,'CLIENT')} className="h-7 px-2 text-xs border border-outline-variant">→Cl</Button>}
                                {u.role==='COLLECTOR' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>toggleCollectorStatus(u.phone, u.status!=='ACTIVE')} className="h-7 px-2 text-xs border border-outline-variant">{u.status==='ACTIVE'?'Off':'On'}</Button>}
                                <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>openDeleteModal(u.phone)} className="h-7 px-2 text-xs border border-error text-error hover:bg-error-container/20"><Icon name="delete" size={12} /></Button>
                              </>
                            ) : (
                              <span className="text-[11px] text-on-surface-variant">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 md:hidden">
            {users.map((u) => {
              const isSelf = u.phone===me?.phone;
              const initial = (u.name?.[0] ?? u.phone[0]).toUpperCase();
              const roleColor = ROLE_PILL[u.role];
              return (
                <div key={u.phone} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 shadow-level-2 flex flex-col gap-2">
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
                      <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>openResetModal(u.phone)} className="flex-1 min-w-[140px] border border-outline-variant"><Icon name="key" size={16} /> Reset pass</Button>
                      {u.role==='COLLECTOR' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>toggleCollectorStatus(u.phone, u.status!=='ACTIVE')} className="flex-1 min-w-[120px] border border-outline-variant">{u.status==='ACTIVE'?'Desactivar':'Activar'}</Button>}
                      {u.role==='CLIENT' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>changeRole(u.phone,'COLLECTOR')} className="flex-1 min-w-[140px] border border-outline-variant">→ Cobrador</Button>}
                      {u.role==='COLLECTOR' && <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>changeRole(u.phone,'CLIENT')} className="flex-1 min-w-[140px] border border-outline-variant">→ Cliente</Button>}
                      <Button type="button" variant="ghost" loading={actionLoading===u.phone} onClick={()=>openDeleteModal(u.phone)} className="flex-1 min-w-[140px] border border-error text-error hover:bg-error-container/20"><Icon name="delete" size={16} /> Eliminar</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
        {resetModalPhone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h3 className="font-headline-md text-headline-md font-bold text-primary">Reset para {resetModalPhone}</h3>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Escribe la nueva contraseña manualmente — debe cumplir todas las reglas y se enviará al correo registrado.</p>
              <div className="mt-4 flex flex-col gap-3">
                {resetError && <Alert variant="error">{resetError}</Alert>}
                <Input label="Nueva contraseña *" type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required />
                <Input label="Confirmar contraseña *" type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required />
                <PasswordRules password={newPassword} confirm={confirmPassword} />
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={()=>setResetModalPhone(null)} className="border border-outline-variant">Cancelar</Button>
                <Button type="button" loading={actionLoading===resetModalPhone} disabled={!isPasswordValid(newPassword, confirmPassword)} onClick={resetPassword}>Guardar y enviar por correo</Button>
              </div>
            </div>
          </div>
        )}
        {deleteModalPhone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border-2 border-error">
              <h3 className="font-headline-md text-headline-md font-bold text-error">¿Eliminar definitivamente a {deleteModalPhone}?</h3>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Se borrará el usuario, su cliente, préstamos, pagos y documentos (cascada). Esta acción no se puede deshacer. Escribe el teléfono para confirmar.</p>
              {deleteError && <div className="mt-3"><Alert variant="error">{deleteError}</Alert></div>}
              <Input label={`Escribe ${deleteModalPhone} para habilitar`} value={deleteConfirm} onChange={(e)=>{ setDeleteConfirm(e.target.value); if (deleteError) setDeleteError(null); }} placeholder={deleteModalPhone ?? ''} className="mt-3" />
              <div className="mt-4 flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={()=>setDeleteModalPhone(null)} className="border border-outline-variant">Cancelar</Button>
                <Button type="button" variant="danger" loading={actionLoading===deleteModalPhone} disabled={deleteConfirm !== deleteModalPhone} onClick={deleteUser} className="disabled:opacity-40">Eliminar definitivamente</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
