import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { formatShortDate } from '../lib/dates';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Input } from '../components/ui/Input';
import { Icon } from '../components/ui/Icon';

interface BlacklistEntry { phone: string; reason: string; createdBy: string; createdAt: string; }

export function AdminBlacklistPage() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [blPhone, setBlPhone] = useState('');
  const [blReason, setBlReason] = useState('');
  const [blLoading, setBlLoading] = useState(false);
  const [blError, setBlError] = useState<string | null>(null);
  const [blRemoving, setBlRemoving] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    apiFetch<BlacklistEntry[]>('/admin/blacklist').then(setBlacklist).catch(() => undefined).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const addToBlacklist = async (e: FormEvent) => {
    e.preventDefault(); setBlError(null); setBlLoading(true);
    try {
      const entry = await apiFetch<BlacklistEntry>('/admin/blacklist', { method: 'POST', body: JSON.stringify({ phone: blPhone, reason: blReason }) });
      setBlacklist((prev) => [entry, ...prev]); setBlPhone(''); setBlReason('');
    } catch (err) { setBlError(err instanceof ApiError ? err.message : 'No se pudo agregar'); } finally { setBlLoading(false); }
  };
  const removeFromBlacklist = async (phone: string) => {
    setBlRemoving(phone); setBlError(null);
    try { await apiFetch(`/admin/blacklist/${phone}`, { method: 'DELETE' }); setBlacklist((prev) => prev.filter((b) => b.phone !== phone)); }
    catch (err) { setBlError(err instanceof ApiError ? err.message : 'No se pudo quitar'); } finally { setBlRemoving(null); }
  };

  const filtered = blacklist.filter((b) => !search || b.phone.includes(search) || b.reason.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminShell active="blacklist" title="Lista negra">
      <div className="mx-auto max-w-5xl space-y-lg">
        <div className="rounded-xl bg-primary p-lg text-white shadow-level-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold">Lista negra</h2>
              <p className="font-body-sm text-body-sm text-white/70 mt-1">Teléfonos vetados — no pueden registrarse ni pedir préstamos. {blacklist.length} total.</p>
            </div>
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-white/10 items-center justify-center"><Icon name="block" className="text-white" /></div>
          </div>
          <div className="mt-md relative">
            <Icon name="search" className="absolute left-sm top-1/2 -translate-y-1/2 text-white/60" size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por teléfono o motivo..." className="w-full pl-xl pr-md py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30" />
          </div>
        </div>

        <Card className="border-0 shadow-level-2 overflow-hidden p-0">
          <div className="p-lg border-b border-outline-variant/30">
            <h3 className="font-headline-md text-headline-md font-semibold">Agregar a lista negra</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Bloquea un número aunque no sea cliente aún.</p>
          </div>
          <form onSubmit={addToBlacklist} className="p-lg flex flex-col gap-md">
            {blError && <Alert variant="error">{blError}</Alert>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Input label="Teléfono (10 dígitos)" value={blPhone} onChange={(e) => setBlPhone(e.target.value)} required pattern="[0-9]{10}" title="Debe tener 10 dígitos" />
              <Input label="Motivo" value={blReason} onChange={(e) => setBlReason(e.target.value)} required maxLength={255} placeholder="Ej. Fraude detectado" />
            </div>
            <Button type="submit" loading={blLoading} className="self-start">Agregar a lista negra</Button>
          </form>
        </Card>

        <Card className="border-0 shadow-level-2 overflow-hidden p-0">
          <div className="p-lg border-b border-outline-variant/30 flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md font-semibold">Vetados ({filtered.length})</h3>
            {search && <span className="text-xs text-on-surface-variant">Filtrado por "{search}"</span>}
          </div>
          {loading ? <div className="flex justify-center py-12"><Spinner /></div> : filtered.length === 0 ? <p className="py-12 text-center text-sm text-on-surface-variant">No hay teléfonos bloqueados.</p> : (
            <div className="divide-y divide-outline-variant/30">
              {filtered.map((entry) => (
                <div key={entry.phone} className="flex items-center justify-between gap-4 p-md hover:bg-surface-container-low/50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-body-md text-body-md font-semibold text-on-surface">{entry.phone}</p>
                    <p className="text-xs text-on-surface-variant truncate">{entry.reason} · por {entry.createdBy} el {formatShortDate(entry.createdAt)}</p>
                  </div>
                  <Button type="button" variant="ghost" loading={blRemoving === entry.phone} onClick={() => removeFromBlacklist(entry.phone)} className="shrink-0 border border-outline-variant">Quitar</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
