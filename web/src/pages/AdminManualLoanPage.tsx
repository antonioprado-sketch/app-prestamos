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
  const preview = useMemo(() => { try { return generateSchedule(amount, model, openingDate); } catch { return null; } }, [amount, model, openingDate]);

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
      await apiFetch('/admin/customers', { method: 'POST', body: JSON.stringify({ phone: quickPhone }) });
      setCustomer({ phone: quickPhone, nombres: quickName }); setShowQuickCreate(false); setSearchError(null);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo crear cliente'); }
  };
  const create = async () => {
    if (!customer) { setError('Busca y selecciona un cliente'); return; }
    setCreating(true); setError(null); setSuccess(null);
    try {
      const res = await apiFetch<{ folio: string; id: string }>(`/admin/loans/manual`, { method: 'POST', body: JSON.stringify({ customerPhone: customer.phone, amount, model, openingDate }) });
      setSuccess(`Préstamo ${res.folio} creado en DRAFT. El cliente debe completar INE/VIDEO y pagaré.`);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo crear'); } finally { setCreating(false); }
  };

  const steps = [
    { n: 1, label: 'Cliente', done: !!customer, active: !customer },
    { n: 2, label: 'Monto y plazo', done: false, active: !!customer },
    { n: 3, label: 'Confirmar', done: false, active: false },
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
          <Card className="lg:col-span-7 border-0 shadow-level-2 bg-white overflow-hidden p-0">
            <div className="bg-surface-container-low px-lg py-md border-b border-outline-variant/30">
              <h3 className="font-label-md text-label-md font-semibold text-on-surface flex items-center gap-2"><Icon name="tune" size={18} className="text-primary" /> 2. Configura el préstamo</h3>
            </div>
            <div className="p-lg flex flex-col gap-xl">
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
                <button type="button" onClick={() => { setTempDate(openingDate); setShowDateModal(true); }} className="w-full flex items-center justify-between px-md py-3 rounded-xl border-2 border-outline-variant bg-white text-on-surface hover:border-primary hover:bg-primary/5 transition-colors font-body-md text-[15px] text-left group">
                  <span className="flex items-center gap-2"><span className="w-9 h-9 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary"><Icon name="event" size={18} /></span> {formatDateLong(openingDate)}</span>
                  <Icon name="edit_calendar" className="text-on-surface-variant group-hover:text-primary" size={20} />
                </button>
                <p className="mt-1 text-xs text-on-surface-variant">Puede ser pasada para préstamos de papel.</p>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-5 flex flex-col gap-lg">
            <Card className="border-0 shadow-level-2 bg-primary text-white overflow-hidden p-0">
              <div className="p-lg">
                <h4 className="font-label-md text-label-md font-semibold text-white/80 flex items-center gap-2"><Icon name="analytics" size={16} /> Resumen de Operación</h4>
                <div className="mt-md grid grid-cols-2 gap-md">
                  <div className="rounded-xl bg-white/10 p-md backdrop-blur"><p className="font-body-sm text-[13px] text-white/70 mb-1">Total a pagar</p><p className="font-headline-md text-[22px] font-bold">{preview ? currency.format(preview.total) : '-'}</p></div>
                  <div className="rounded-xl bg-white/10 p-md backdrop-blur"><p className="font-body-sm text-[13px] text-white/70 mb-1">Intereses (40%)</p><p className="font-headline-md text-[22px] font-bold">{preview ? currency.format(preview.intereses) : '-'}</p></div>
                </div>
                <div className="mt-md rounded-xl bg-secondary-container p-md flex flex-col items-center justify-center text-on-secondary-container">
                  <p className="font-body-sm text-[13px] font-medium opacity-80">Abono {model === 'WEEKLY' ? 'Semanal' : 'Quincenal'}</p>
                  <p className="font-data-lg text-data-lg font-bold">{preview ? currency.format(preview.payment) : '-'}</p>
                  <p className="text-xs opacity-70">{preview ? `${preview.schedule.length} cuotas` : ''}</p>
                </div>
              </div>
            </Card>

            <Card className="border border-outline-variant shadow-level-2 overflow-hidden p-0">
              <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                <h4 className="font-label-md text-[14px] font-semibold text-on-surface flex items-center gap-2"><Icon name="table_chart" size={18} className="text-primary" /> Tabla de Pagos (prevista)</h4>
                <span className="text-xs bg-secondary-fixed text-on-secondary-fixed px-2 py-1 rounded-full font-bold">{preview?.schedule.length ?? 0}</span>
              </div>
              <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="border-b border-outline-variant/50 text-on-surface-variant font-label-md text-[12px] uppercase tracking-wider bg-surface-container-low/50"><th className="py-3 px-4 font-semibold">No.</th><th className="py-3 px-4 font-semibold">Fecha</th><th className="py-3 px-4 font-semibold text-right">Monto</th></tr></thead>
                  <tbody className="font-body-sm text-[14px] text-on-surface">
                    {(preview?.schedule.slice(0, 5) ?? []).map((row) => (
                      <tr key={row.seq} className="border-b border-outline-variant/30 hover:bg-surface-container-low/50"><td className="py-3 px-4 text-on-surface-variant">{row.seq}</td><td className="py-3 px-4 font-medium">{formatDateLong(row.dueDate)}</td><td className="py-3 px-4 text-right font-bold text-primary">{currency.format(row.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-sm text-center bg-surface-container-low/30"><span className="font-body-sm text-body-sm text-primary">+ {preview ? Math.max(0, preview.schedule.length - 5) : 0} cuotas más</span></div>
            </Card>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

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
                <input type="date" value={tempDate} onChange={(e) => setTempDate(e.target.value)} className="w-full bg-white border-2 border-outline-variant rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary h-[52px]" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-sm p-lg border-t border-outline-variant bg-surface-container-low">
              <Button type="button" variant="ghost" onClick={() => setShowDateModal(false)}>Cancelar</Button>
              <Button type="button" onClick={() => { setOpeningDate(tempDate); setShowDateModal(false); }}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
