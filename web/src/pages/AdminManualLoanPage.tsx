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

  const preview = useMemo(() => {
    try { return generateSchedule(amount, model, openingDate); } catch { return null; }
  }, [amount, model, openingDate]);

  const search = async () => {
    setSearching(true);
    setSearchError(null);
    setCustomer(null);
    try {
      const res = await apiFetch<{ phone: string; nombres?: string; apellidos?: string }>(`/admin/customers/${phone}`);
      const c = res as unknown as { phone: string; nombres?: string; apellidos?: string };
      setCustomer({ phone: c.phone ?? phone, nombres: (c as { nombres?: string }).nombres, apellidos: (c as { apellidos?: string }).apellidos });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No encontrado';
      setSearchError(msg);
      setShowQuickCreate(true);
      setQuickPhone(phone);
    } finally { setSearching(false); }
  };

  const quickCreate = async () => {
    setError(null);
    try {
      await apiFetch('/admin/customers', { method: 'POST', body: JSON.stringify({ phone: quickPhone }) });
      setCustomer({ phone: quickPhone, nombres: quickName });
      setShowQuickCreate(false);
      setSearchError(null);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo crear cliente'); }
  };

  const create = async () => {
    if (!customer) { setError('Busca y selecciona un cliente'); return; }
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ folio: string; id: string }>(`/admin/loans/manual`, {
        method: 'POST',
        body: JSON.stringify({ customerPhone: customer.phone, amount, model, openingDate }),
      });
      setSuccess(`Préstamo ${res.folio} creado en DRAFT. El cliente debe completar INE/VIDEO y pagaré.`);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo crear'); }
    finally { setCreating(false); }
  };

  return (
    <AdminShell active="manual" title="Nuevo préstamo manual">
      <div className="mx-auto max-w-5xl space-y-lg pb-24">
        <div className="mb-lg">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface font-bold tracking-tight">Nuevo préstamo manual</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Da de alta un préstamo de papel. El cálculo respeta tus reglas (40% / semanal 20 / quincenal 10).</p>
        </div>

        {/* Buscar Cliente */}
        <Card className="border border-outline-variant">
          <h3 className="font-headline-md text-headline-md font-semibold text-on-surface mb-md">Buscar Cliente</h3>
          <div className="flex flex-col md:flex-row gap-sm items-start md:items-center">
            <div className="relative w-full md:w-2/3">
              <Icon name="search" className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono o Identificación..."
                className="w-full pl-xl pr-md py-[10px] bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
              />
            </div>
            <Button type="button" variant="ghost" className="w-full md:w-auto border border-outline-variant bg-surface-container-lowest" loading={searching} onClick={search}>Buscar</Button>
          </div>
          {customer && (
            <div className="mt-lg p-md bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-bold">{(customer.nombres?.[0] ?? customer.phone[0]).toUpperCase()}</div>
                <div>
                  <p className="font-headline-md text-headline-md text-on-surface text-base font-semibold">{customer.nombres ? `${customer.nombres} ${customer.apellidos ?? ''}` : customer.phone}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Tel: {customer.phone}</p>
                </div>
              </div>
              <span className="px-sm py-1 bg-secondary/10 text-secondary rounded-full font-label-md text-[12px] font-semibold">Seleccionado</span>
            </div>
          )}
          {searchError && !customer && <p className="mt-3 text-sm text-secondary">{searchError} — puedes dar de alta rápido abajo.</p>}
          {showQuickCreate && (
            <div className="mt-md rounded-lg border border-outline-variant p-md bg-surface-container-low">
              <p className="font-label-md text-label-md font-semibold mb-sm">Alta rápida</p>
              <div className="flex flex-col md:flex-row gap-sm">
                <Input label="Teléfono" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} />
                <Input label="Nombre (opcional)" value={quickName} onChange={(e) => setQuickName(e.target.value)} />
                <Button type="button" onClick={quickCreate}>Crear cliente</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Parametros + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
          <Card className="lg:col-span-7 border border-outline-variant flex flex-col gap-xl">
            <div>
              <div className="flex justify-between items-end mb-md">
                <label className="font-label-md text-label-md font-semibold text-on-surface">Monto Solicitado</label>
                <span className="font-data-lg text-data-lg font-bold text-on-surface">{currency.format(amount)}</span>
              </div>
              <input type="range" min={500} max={20000} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary" />
              <div className="flex justify-between mt-sm font-body-sm text-[13px] text-on-surface-variant font-medium"><span>$500</span><span>$20,000</span></div>
              <p className="mt-1 text-xs text-on-surface-variant">Bypass de tope: el admin puede crear aunque supere el tope por score (ya aprobado).</p>
            </div>
            <div>
              <label className="block font-label-md text-label-md font-semibold text-on-surface mb-md">Modelo de Pago</label>
              <div className="flex gap-sm">
                <button type="button" onClick={() => setModel('WEEKLY')} className={`flex-1 py-3 px-md rounded-lg border-2 font-label-md text-label-md font-semibold transition-colors ${model === 'WEEKLY' ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'}`}>Semanal (20)</button>
                <button type="button" onClick={() => setModel('BIWEEKLY')} className={`flex-1 py-3 px-md rounded-lg border font-label-md text-label-md font-semibold transition-colors ${model === 'BIWEEKLY' ? 'border-2 border-primary bg-primary/5 text-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'}`}>Quincenal (10)</button>
              </div>
            </div>
            <div>
              <label className="block font-label-md text-label-md font-semibold text-on-surface mb-md">Fecha de Apertura</label>
              <button type="button" onClick={() => { setTempDate(openingDate); setShowDateModal(true); }} className="w-full flex items-center justify-between px-md py-3 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low transition-colors font-body-md text-[15px] text-left">
                {formatDateLong(openingDate)}
                <Icon name="calendar_today" className="text-on-surface-variant" size={20} />
              </button>
              <p className="mt-1 text-xs text-on-surface-variant">Puede ser pasada (préstamo de papel).</p>
            </div>
          </Card>

          <div className="lg:col-span-5 flex flex-col gap-lg">
            <Card className="border border-outline-variant grid grid-cols-2 gap-y-lg gap-x-sm">
              <div className="col-span-2 border-b border-outline-variant/50 pb-sm mb-xs"><h4 className="font-label-md text-label-md font-semibold text-on-surface">Resumen de Operación</h4></div>
              <div><p className="font-body-sm text-[13px] font-medium text-on-surface-variant mb-1">Total a pagar</p><p className="font-headline-md text-[22px] font-bold text-on-surface">{preview ? currency.format(preview.total) : '-'}</p></div>
              <div><p className="font-body-sm text-[13px] font-medium text-on-surface-variant mb-1">Intereses</p><p className="font-headline-md text-[22px] font-bold text-on-surface">{preview ? currency.format(preview.intereses) : '-'}</p></div>
              <div className="col-span-2 bg-surface p-md rounded-lg mt-sm border border-outline-variant/50 flex flex-col items-center justify-center">
                <p className="font-body-sm text-[13px] font-medium text-on-surface-variant mb-1">Abono {model === 'WEEKLY' ? 'Semanal' : 'Quincenal'}</p>
                <p className="font-data-lg text-data-lg font-bold text-on-surface">{preview ? currency.format(preview.payment) : '-'}</p>
              </div>
            </Card>

            <Card className="border border-outline-variant overflow-hidden flex-1 flex flex-col p-0">
              <div className="px-md py-sm border-b border-outline-variant flex justify-between items-center">
                <h4 className="font-label-md text-[14px] font-semibold text-on-surface">Tabla de Pagos (Prevista)</h4>
                <Icon name="table_chart" className="text-on-surface-variant" size={18} />
              </div>
              <div className="overflow-x-auto flex-1 p-0 max-h-[280px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="border-b border-outline-variant/50 text-on-surface-variant font-label-md text-[12px] uppercase tracking-wider bg-surface/50"><th className="py-3 px-4 font-semibold">No.</th><th className="py-3 px-4 font-semibold">Fecha Venc.</th><th className="py-3 px-4 font-semibold text-right">Monto</th></tr></thead>
                  <tbody className="font-body-sm text-[14px] text-on-surface">
                    {(preview?.schedule.slice(0, 3) ?? []).map((row) => (
                      <tr key={row.seq} className="border-b border-outline-variant/50 hover:bg-surface/50"><td className="py-3 px-4 text-on-surface-variant">{row.seq}</td><td className="py-3 px-4 font-medium">{formatDateLong(row.dueDate)}</td><td className="py-3 px-4 text-right font-medium">{currency.format(row.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-sm text-center border-t border-outline-variant/50 bg-surface/30"><span className="font-label-md text-[13px] font-semibold text-primary">{preview ? `${preview.schedule.length} cuotas` : ''}</span></div>
            </Card>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-surface-container-lowest border-t border-outline-variant p-md px-margin-desktop flex justify-end gap-md z-30 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <Button type="button" variant="ghost" className="border border-outline-variant" onClick={() => navigate('/admin/solicitudes')}>Cancelar</Button>
          <Button type="button" loading={creating} onClick={create} className="flex items-center gap-sm">Crear préstamo (DRAFT) <Icon name="save" size={18} /></Button>
        </div>
      </div>

      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-margin-mobile bg-black/60" role="dialog" aria-modal="true">
          <div className="bg-surface-container-lowest w-full max-w-sm rounded-lg border border-outline-variant shadow-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-md border-b border-outline-variant">
              <h2 className="font-headline-md text-headline-md text-on-surface">Fecha de apertura</h2>
              <button type="button" onClick={() => setShowDateModal(false)} className="text-on-surface-variant hover:text-on-surface p-xs rounded-full"><Icon name="close" size={20} /></button>
            </div>
            <div className="p-md flex flex-col gap-lg">
              <div className="flex flex-wrap gap-xs">
                {[{ label: 'Hoy', v: new Date().toISOString().slice(0, 10) }, { label: 'Hace 7 días', v: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) }, { label: 'Hace 30 días', v: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) }].map((chip) => (
                  <button key={chip.label} type="button" onClick={() => setTempDate(chip.v)} className={`px-sm py-xs rounded-full border font-label-md text-label-md transition-colors ${tempDate === chip.v ? 'border-secondary-container bg-secondary-container text-on-secondary-container' : 'border-outline bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'}`}>{chip.label}</button>
                ))}
              </div>
              <div className="flex flex-col gap-base">
                <label className="font-label-md text-label-md text-on-surface">Seleccionar fecha</label>
                <input type="date" value={tempDate} onChange={(e) => setTempDate(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded px-sm py-sm font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary h-[48px]" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-sm p-md border-t border-outline-variant bg-surface-bright">
              <Button type="button" variant="ghost" onClick={() => setShowDateModal(false)}>Cancelar</Button>
              <Button type="button" onClick={() => { setOpeningDate(tempDate); setShowDateModal(false); }}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
