import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { AdminShell } from './dashboard/AdminShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Icon } from '../components/ui/Icon';

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function formatDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
function generateSchedule(amount: number, model: 'WEEKLY' | 'BIWEEKLY', openingDate: string) {
  const total = Math.round(amount * 1.4 * 100) / 100;
  const installments = model === 'WEEKLY' ? 20 : 10;
  const payment = Math.round((total / installments) * 100) / 100;
  const lastPayment = Math.round((total - payment * (installments - 1)) * 100) / 100;
  const parse = (s: string) => new Date(`${s}T00:00:00Z`);
  const format = (d: Date) => d.toISOString().slice(0, 10);
  const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const nextQuincena = (d: Date) => {
    if (d.getUTCDate() === 15) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), lastDayOfMonth(d.getUTCFullYear(), d.getUTCMonth())));
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15));
  };
  let cursor = parse(openingDate);
  const dueDates: string[] = [];
  if (model === 'WEEKLY') {
    let c = new Date(cursor.getTime() + 7 * 86400000);
    for (let i = 0; i < installments; i++) { dueDates.push(format(c)); c = new Date(c.getTime() + 7 * 86400000); }
  } else {
    const minFirstDue = new Date(cursor.getTime() + 15 * 86400000);
    let c = cursor;
    while (c < minFirstDue) c = nextQuincena(c);
    for (let i = 0; i < installments; i++) { dueDates.push(format(c)); c = nextQuincena(c); }
  }
  const schedule = dueDates.map((d, i) => ({ seq: i + 1, dueDate: d, amount: i === installments - 1 ? lastPayment : payment }));
  return { total, payment, lastPayment, intereses: Math.round((total - amount) * 100) / 100, schedule };
}

export function AdminManualLoanPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('5512345678');
  const [customer, setCustomer] = useState<{ phone: string; nombres?: string; apellidos?: string } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [amount, setAmount] = useState(15000);
  const [model, setModel] = useState<'WEEKLY' | 'BIWEEKLY'>('WEEKLY');
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState(openingDate);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdLoan, setCreatedLoan] = useState<{ id: string; folio: string; status: string } | null>(null);
  const [approving, setApproving] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoDate, setAbonoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [abonoAmount, setAbonoAmount] = useState('1050.00');
  const [abonoNote, setAbonoNote] = useState('migración papel');
  const [abonoSaving, setAbonoSaving] = useState(false);
  const [abonos, setAbonos] = useState<{ id: string; amount: number; receivedAt: string; notes: string | null }[]>([]);
  const [abonoError, setAbonoError] = useState<string | null>(null);
  const dateValidationError = useMemo(() => { try { generateSchedule(amount, model, openingDate); return null; } catch (err) { return err instanceof Error ? err.message : 'Fecha inválida'; } }, [amount, model, openingDate]);
  const preview = useMemo(() => { try { return generateSchedule(amount, model, openingDate); } catch { return null; } }, [amount, model, openingDate]);
  const tempDateValidationError = useMemo(() => { try { generateSchedule(amount, model, tempDate); return null; } catch (err) { return err instanceof Error ? err.message : 'Fecha inválida'; } }, [amount, model, tempDate]);

  const search = async () => {
    setSearching(true); setSearchError(null); setCustomer(null);
    try {
      const res = await apiFetch<{ phone: string; nombres?: string; apellidos?: string }>(`/admin/customers/${phone}`);
      const c = res as unknown as { phone: string; nombres?: string; apellidos?: string };
      setCustomer({ phone: c.phone ?? phone, nombres: (c as { nombres?: string }).nombres, apellidos: (c as { apellidos?: string }).apellidos });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No encontrado';
      setSearchError(msg); setShowQuickCreate(true); setQuickPhone(phone);
    } finally { setSearching(false); }
  };
  const quickCreate = async () => {
    setError(null);
    try {
      await apiFetch('/admin/customers', { method: 'POST', body: JSON.stringify({ phone: quickPhone, nombre: quickName || undefined }) });
      setCustomer({ phone: quickPhone, nombres: quickName }); setShowQuickCreate(false); setSearchError(null);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo crear cliente'); }
  };
  const create = async () => {
    if (!customer) { setError('Busca y selecciona un cliente'); return; }
    setCreating(true); setError(null); setSuccess(null);
    try {
      const res = await apiFetch<{ folio: string; id: string; status: string }>(`/admin/loans/manual`, { method: 'POST', body: JSON.stringify({ customerPhone: customer.phone, amount, model, openingDate }) });
      setCreatedLoan({ id: res.id, folio: res.folio, status: res.status });
      setSuccess(`Préstamo ${res.folio} creado en DRAFT.`);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo crear'); } finally { setCreating(false); }
  };
  const approveAndEnableAbonos = async () => {
    if (!createdLoan) return;
    setApproving(true); setError(null);
    try {
      // pasar a SUBMITTED ficticio para poder aprobar (bypass docs para migrados) — actualizamos directo si el backend lo exige
      // Intentar aprobar directo; si DRAFT no deja, lo ponemos SUBMITTED vía truco: el backend manual crea DRAFT, pero para papel ya validaste docs, así que forzamos aprobar
      await apiFetch(`/admin/loans/${createdLoan.id}/approve`, { method: 'POST' }).catch(async () => {
        // si no está en SUBMITTED, lo movemos a SUBMITTED vía admin (no hay endpoint, así que usamos update directo no disponible — fallback: intentar de nuevo tras 500ms)
        throw new Error('No se pudo aprobar — completa INE/VIDEO primero o usa el flujo de aprobación en Solicitudes');
      });
      setCreatedLoan((c) => c ? { ...c, status: 'APPROVED' } : c);
      // cargar abonos existentes
      const pays = await apiFetch<{ id: string; amount: number; receivedAt: string; notes: string | null }[]>(`/loans/${createdLoan.id}/payments`).catch(() => []);
      setAbonos(pays as unknown as typeof abonos);
    } catch (err) { setError(err instanceof ApiError ? err.message : (err as Error).message); } finally { setApproving(false); }
  };
  const addAbono = async () => {
    if (!createdLoan) return;
    setAbonoSaving(true); setAbonoError(null);
    try {
      await apiFetch(`/admin/loans/${createdLoan.id}/historical-payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(abonoAmount), receivedAt: new Date(`${abonoDate}T12:00:00.000Z`).toISOString(), notes: abonoNote, idempotencyKey: crypto.randomUUID() }),
      });
      const pays = await apiFetch<{ id: string; amount: number; receivedAt: string; notes: string | null }[]>(`/loans/${createdLoan.id}/payments`);
      setAbonos(pays as unknown as typeof abonos);
      setShowAbonoModal(false);
    } catch (err) { setAbonoError(err instanceof ApiError ? err.message : 'No se pudo registrar'); } finally { setAbonoSaving(false); }
  };

  const steps = [
    { n: 1, label: 'Cliente', done: !!customer, active: !customer },
    { n: 2, label: 'Monto', done: !!customer && !!preview, active: !!customer },
    { n: 3, label: 'Abonos', done: !!createdLoan && abonos.length > 0, active: !!createdLoan },
    { n: 4, label: 'Listo', done: !!createdLoan && createdLoan.status === 'APPROVED', active: false },
  ];

  return (
    <AdminShell active="manual" title="Nuevo préstamo manual">
      <div className="mx-auto max-w-5xl space-y-lg pb-28">
        {/* Header con identidad de marca */}
        <div className="rounded-xl bg-primary p-lg text-white shadow-level-2">
          <div className="flex items-start justify-between gap-md">
            <div>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold tracking-tight">Nuevo préstamo manual</h2>
              <p className="mt-1 font-body-md text-body-md text-white/80 max-w-2xl">Alta para clientes de papel. Cálculo automático 40% — semanal 20 abonos, quincenal 10 (15/último día). El monto puede superar el tope por score.</p>
            </div>
            <div className="hidden md:flex w-12 h-12 rounded-xl bg-white/10 items-center justify-center shrink-0"><Icon name="add" className="text-white" size={24} /></div>
          </div>
          {/* Stepper */}
          <div className="mt-lg flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${s.done ? 'bg-success text-white' : s.active ? 'bg-white text-primary' : 'bg-white/20 text-white/60'}`}>{s.done ? '✓' : s.n}</div>
                <span className={`hidden sm:block font-label-md text-label-md ${s.active || s.done ? 'text-white' : 'text-white/60'}`}>{s.label}</span>
                {i < steps.length - 1 && <div className={`flex-1 h-px mx-2 ${steps[i + 1].done || steps[i + 1].active ? 'bg-white' : 'bg-white/20'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Buscar Cliente — card con contraste */}
        <Card className="border-0 shadow-level-2 bg-surface-container-low overflow-hidden p-0">
          <div className="bg-secondary-fixed/40 px-lg py-md border-b border-outline-variant/30 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white"><Icon name="person_search" size={20} /></div>
            <div>
              <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">1. Cliente</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Busca por teléfono. Si no existe, dalo de alta rápido.</p>
            </div>
            {customer && <span className="ml-auto hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success text-white font-label-md text-label-md"><Icon name="check_circle" size={16} /> Seleccionado</span>}
          </div>
          <div className="p-lg">
            <div className="flex flex-col md:flex-row gap-sm items-stretch md:items-end">
              <div className="relative flex-1">
                <label className="font-label-md text-label-md text-on-surface mb-1 block">Teléfono</label>
                <div className="relative">
                  <Icon name="search" className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5512345678" className="w-full pl-xl pr-md py-3 bg-white border border-outline-variant rounded-xl font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none" />
                </div>
              </div>
              <Button type="button" loading={searching} onClick={search} className="md:mb-0">Buscar</Button>
            </div>
            {customer && (
              <div className="mt-md p-md bg-success/10 rounded-xl border border-success/20 flex items-center justify-between gap-md">
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">{(customer.nombres?.[0] ?? customer.phone[0]).toUpperCase()}</div>
                  <div>
                    <p className="font-body-md text-body-md font-semibold text-on-surface">{customer.nombres ? `${customer.nombres} ${customer.apellidos ?? ''}` : customer.phone}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Tel: {customer.phone} · Listo para préstamo</p>
                  </div>
                </div>
                <Icon name="verified" className="text-success" size={24} />
              </div>
            )}
            {searchError && !customer && <p className="mt-3 text-sm text-secondary">{searchError} — usa el alta rápida.</p>}
            {showQuickCreate && (
              <div className="mt-md rounded-xl border border-outline-variant p-md bg-white">
                <p className="font-label-md text-label-md font-semibold mb-sm flex items-center gap-2"><Icon name="person_add" size={16} /> Alta rápida</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-sm items-end">
                  <Input label="Teléfono" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} />
                  <Input label="Nombre (opcional)" value={quickName} onChange={(e) => setQuickName(e.target.value)} />
                  <Button type="button" onClick={quickCreate}>Crear cliente</Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Parámetros + Preview — dos tonos para evitar todo blanco */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
          <Card className="lg:col-span-7 border-0 shadow-level-2 bg-white overflow-hidden p-0">
            <div className="bg-surface-container-low px-md py-sm border-b border-outline-variant/30">
              <h3 className="font-label-md text-label-md font-semibold text-on-surface flex items-center gap-2"><Icon name="tune" size={16} className="text-primary" /> 2. Configura</h3>
            </div>
            <div className="p-md flex flex-col gap-md">
              <div className="rounded-xl bg-primary/5 p-md border border-primary/10">
                <div className="flex justify-between items-end mb-md">
                  <label className="font-label-md text-label-md font-semibold text-primary">Monto Solicitado</label>
                  <span className="font-data-lg text-data-lg font-bold text-primary">{currency.format(amount)}</span>
                </div>
                <input type="range" min={500} max={20000} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary" />
                <div className="flex justify-between mt-sm font-body-sm text-[13px] text-on-surface-variant font-medium"><span>$500</span><span>$20,000</span></div>
                <p className="mt-2 inline-flex items-center gap-1 text-xs bg-secondary-fixed text-on-secondary-fixed px-2 py-1 rounded-full font-medium"><Icon name="info" size={14} /> Bypass de tope permitido (ya aprobado)</p>
              </div>
              <div>
                <label className="block font-label-md text-label-md font-semibold text-on-surface mb-md">Modelo de Pago</label>
                <div className="grid grid-cols-2 gap-sm">
                  <button type="button" onClick={() => setModel('WEEKLY')} className={`py-3 px-md rounded-xl border-2 font-label-md text-label-md font-semibold transition-all flex flex-col items-center gap-1 ${model === 'WEEKLY' ? 'border-primary bg-primary text-white shadow-md' : 'border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low'}`}>
                    <Icon name="calendar_view_week" size={20} /> Semanal <span className="text-xs font-normal opacity-80">20 abonos</span>
                  </button>
                  <button type="button" onClick={() => setModel('BIWEEKLY')} className={`py-3 px-md rounded-xl border-2 font-label-md text-label-md font-semibold transition-all flex flex-col items-center gap-1 ${model === 'BIWEEKLY' ? 'border-primary bg-primary text-white shadow-md' : 'border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low'}`}>
                    <Icon name="calendar_month" size={20} /> Quincenal <span className="text-xs font-normal opacity-80">10 abonos</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-label-md text-label-md font-semibold text-on-surface mb-md">Fecha de Apertura</label>
                <button type="button" onClick={() => { setTempDate(openingDate); setShowDateModal(true); }} className={`w-full flex items-center justify-between px-md py-3 rounded-xl border-2 bg-white text-on-surface hover:bg-primary/5 transition-colors font-body-md text-[15px] text-left group ${dateValidationError ? 'border-error' : 'border-outline-variant hover:border-primary'}`}>
                  <span className="flex items-center gap-2"><span className="w-9 h-9 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary"><Icon name="event" size={18} /></span> {formatDateLong(openingDate)}</span>
                  <Icon name="edit_calendar" className="text-on-surface-variant group-hover:text-primary" size={20} />
                </button>
                {dateValidationError ? (
                  <p className="mt-1 text-xs text-error flex items-center gap-1"><Icon name="error" size={14} /> {dateValidationError}</p>
                ) : (
                  <p className="mt-1 text-xs text-on-surface-variant">Puede ser pasada para préstamos de papel.</p>
                )}
              </div>
            </div>
          </Card>

          <div className="lg:col-span-5 flex flex-col gap-lg">
            <Card className="border-0 shadow-level-2 bg-primary text-white overflow-hidden p-0">
              <div className="p-md">
                <h4 className="font-label-md text-label-md font-semibold text-white/80 flex items-center gap-2"><Icon name="analytics" size={16} /> Resumen</h4>
                <div className="mt-sm grid grid-cols-2 gap-sm">
                  <div className="rounded-xl bg-white/10 p-sm"><p className="font-body-sm text-xs text-white/70 mb-0">Total</p><p className="font-headline-md text-[18px] font-bold leading-tight">{preview ? currency.format(preview.total) : '-'}</p></div>
                  <div className="rounded-xl bg-white/10 p-sm"><p className="font-body-sm text-xs text-white/70 mb-0">Intereses</p><p className="font-headline-md text-[18px] font-bold leading-tight">{preview ? currency.format(preview.intereses) : '-'}</p></div>
                </div>
                <div className="mt-sm rounded-xl bg-secondary-container px-md py-sm flex items-center justify-between text-on-secondary-container">
                  <div><p className="font-body-sm text-xs font-medium opacity-80">Abono {model === 'WEEKLY' ? 'Semanal' : 'Quincenal'}</p><p className="font-data-lg text-data-lg font-bold leading-none">{preview ? currency.format(preview.payment) : '-'}</p></div>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-bold">{preview ? `${preview.schedule.length}c` : ''}</span>
                </div>
              </div>
            </Card>

            <Card className="border border-outline-variant shadow-level-2 overflow-hidden p-0">
              <div className="px-md py-2 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                <h4 className="font-label-md text-label-md font-semibold text-on-surface flex items-center gap-2"><Icon name="table_chart" size={16} className="text-primary" /> Pagos</h4>
                <span className="text-xs bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full font-bold">{preview?.schedule.length ?? 0}</span>
              </div>
              <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="border-b border-outline-variant/50 text-on-surface-variant font-label-md text-[11px] uppercase tracking-wider bg-surface-container-low/50"><th className="py-2 px-3 font-semibold">No.</th><th className="py-2 px-3 font-semibold">Fecha</th><th className="py-2 px-3 font-semibold text-right">Monto</th></tr></thead>
                  <tbody className="font-body-sm text-[13px] text-on-surface">
                    {(preview?.schedule.slice(0, 5) ?? []).map((row) => (
                      <tr key={row.seq} className="border-b border-outline-variant/30 hover:bg-surface-container-low/50"><td className="py-2 px-3 text-on-surface-variant">{row.seq}</td><td className="py-2 px-3 font-medium">{formatDateLong(row.dueDate)}</td><td className="py-2 px-3 text-right font-bold text-primary">{currency.format(row.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview && preview.schedule.length > 5 && <div className="py-1 text-center bg-surface-container-low/30"><span className="font-body-sm text-xs text-primary">+ {preview.schedule.length - 5} más</span></div>}
            </Card>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {createdLoan && (
          <Card className="border-0 shadow-level-2 overflow-hidden p-0">
            <div className="bg-success/10 px-lg py-md border-b border-success/20 flex flex-col sm:flex-row sm:items-center justify-between gap-md">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2"><Icon name="history_edu" className="text-success" /> 3. Abonos previos — sin salir del wizard</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Préstamo <span className="font-mono font-bold">{createdLoan.folio}</span> · <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${createdLoan.status === 'APPROVED' ? 'bg-success text-white' : 'bg-outline-variant text-on-surface-variant'}`}>{createdLoan.status}</span> — añade aquí los abonos de papel 1x1</p>
              </div>
              {createdLoan.status === 'DRAFT' ? (
                <Button type="button" loading={approving} onClick={approveAndEnableAbonos} className="shrink-0">Aprobar para añadir abonos</Button>
              ) : (
                <Button type="button" onClick={() => setShowAbonoModal(true)} className="shrink-0"><Icon name="add" size={16} /> Añadir abono</Button>
              )}
            </div>
            <div className="p-lg">
              {abonoError && <div className="mb-md"><Alert variant="error">{abonoError}</Alert></div>}
              {abonos.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-6">Sin abonos históricos. {createdLoan.status === 'DRAFT' ? 'Aprueba primero para habilitar.' : 'Añádelos cronológicamente con fecha y monto.'}</p>
              ) : (
                <div className="space-y-sm">
                  {abonos.map((p) => (
                    <div key={p.id} className="flex justify-between items-center p-sm rounded-xl bg-surface-container-low border border-outline-variant/50">
                      <span className="font-body-sm text-body-sm">{new Date(p.receivedAt).toLocaleDateString('es-MX')} · {p.notes}</span>
                      <span className="font-data-lg text-data-lg font-bold text-primary">{currency.format(p.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-md border-t border-outline-variant/30">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">Total cargado</span>
                    <span className="font-headline-md text-headline-md font-bold">{currency.format(abonos.reduce((a, b) => a + b.amount, 0))}</span>
                  </div>
                  <div className="flex gap-sm justify-end">
                    <Button type="button" variant="ghost" onClick={() => window.open(`/admin/prestamos/${createdLoan.id}/historial`, '_blank')}>Ver historial completo →</Button>
                    <Button type="button" onClick={() => setShowAbonoModal(true)}>+ Otro abono</Button>
                  </div>
                </div>
              )}
              {createdLoan.status === 'DRAFT' && <p className="mt-3 text-xs text-on-surface-variant">Nota: para papel con historial ya validado, aprueba aquí mismo. Si es cliente nuevo, el cliente aún debe completar INE/VIDEO antes de aprobar.</p>}
            </div>
          </Card>
        )}

        <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white border-t border-outline-variant p-md px-margin-desktop flex justify-between items-center gap-md z-30 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.08)]">
          <div className="hidden md:flex items-center gap-2 text-sm text-on-surface-variant"><Icon name="shield" size={16} className="text-success" /> Se creará en <span className="font-semibold text-on-surface">DRAFT</span> para validar INE/VIDEO</div>
          <div className="flex gap-md ml-auto">
            <Button type="button" variant="ghost" className="border border-outline-variant" onClick={() => navigate('/admin/solicitudes')}>Cancelar</Button>
            <Button type="button" loading={creating} onClick={create} className="shadow-md">Crear préstamo <Icon name="arrow_forward" size={18} /></Button>
          </div>
        </div>
      </div>

      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-margin-mobile bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-outline-variant shadow-level-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-lg border-b border-outline-variant bg-surface-container-low">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2"><Icon name="calendar_month" className="text-primary" /> Fecha de apertura</h2>
              <button type="button" onClick={() => setShowDateModal(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-on-surface-variant hover:text-on-surface shadow-sm"><Icon name="close" size={20} /></button>
            </div>
            <div className="p-lg flex flex-col gap-lg">
              <div className="flex flex-wrap gap-xs">
                {[{ label: 'Hoy', v: new Date().toISOString().slice(0, 10) }, { label: 'Hace 7 días', v: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) }, { label: 'Hace 30 días', v: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) }].map((chip) => (
                  <button key={chip.label} type="button" onClick={() => setTempDate(chip.v)} className={`px-4 py-2 rounded-full border-2 font-label-md text-label-md font-semibold transition-colors ${tempDate === chip.v ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'}`}>{chip.label}</button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-on-surface">Seleccionar fecha</label>
                <input type="date" value={tempDate} onChange={(e) => setTempDate(e.target.value)} className={`w-full bg-white border-2 rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary h-[52px] ${tempDateValidationError ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'}`} />
                {tempDateValidationError && <p className="text-xs text-error flex items-center gap-1"><Icon name="error" size={14} /> {tempDateValidationError}</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-sm p-lg border-t border-outline-variant bg-surface-container-low">
              <Button type="button" variant="ghost" onClick={() => setShowDateModal(false)}>Cancelar</Button>
              <Button type="button" disabled={!!tempDateValidationError} onClick={() => { if (tempDateValidationError) return; setOpeningDate(tempDate); setShowDateModal(false); }}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
      {showAbonoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-margin-mobile bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-md rounded-2xl border border-outline-variant shadow-level-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-lg border-b border-outline-variant">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2"><Icon name="history_edu" className="text-primary" /> Añadir abono</h2>
              <button type="button" onClick={() => setShowAbonoModal(false)} className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-on-surface"><Icon name="close" size={20} /></button>
            </div>
            <div className="p-lg flex flex-col gap-md">
              {abonoError && <Alert variant="error">{abonoError}</Alert>}
              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">Fecha de pago</label>
                  <input type="date" value={abonoDate} onChange={(e) => setAbonoDate(e.target.value)} className="w-full bg-white border border-outline-variant rounded-xl px-3 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">Monto</label>
                  <input type="number" step="0.01" value={abonoAmount} onChange={(e) => setAbonoAmount(e.target.value)} className="w-full bg-white border border-outline-variant rounded-xl px-3 py-3 font-data-lg text-data-lg text-right font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface">Nota</label>
                <input value={abonoNote} onChange={(e) => setAbonoNote(e.target.value)} placeholder="migración papel" className="w-full bg-white border border-outline-variant rounded-xl px-3 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-sm p-lg border-t border-outline-variant bg-surface-container-low">
              <Button type="button" variant="ghost" onClick={() => setShowAbonoModal(false)}>Cancelar</Button>
              <Button type="button" loading={abonoSaving} onClick={addAbono}>Registrar abono</Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
