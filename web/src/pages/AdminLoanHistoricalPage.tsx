import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { AdminShell } from './dashboard/AdminShell';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function fmtDate(iso: string) {
  try { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))); } catch { return iso; }
}
function fmtDateTime(iso: string) { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }

export function AdminLoanHistoricalPage() {
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<{ id: string; folio: string; status: string; openingDate: string; schedule: { seq: number; dueDate: string; amount: number; status: string; paidAmount: number }[] } | null>(null);
  const [payments, setPayments] = useState<{ id: string; amount: number; receivedAt: string; notes: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('500.00');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('migración papel');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const l = await apiFetch<{ id: string; folio: string; status: string; openingDate: string; schedule: { seq: number; dueDate: string; amount: number; status: string; paidAmount: number }[] }>(`/admin/loans/${id}`);
      setLoan(l);
      const pays = await apiFetch<{ id: string; amount: number; receivedAt: string; notes: string | null }[]>(`/loans/${id}/payments`).catch(() => []);
      setPayments(pays as unknown as typeof payments);
      const unpaid = l.schedule.find((s) => s.status !== 'PAID');
      if (unpaid) setAmount((unpaid.amount - unpaid.paidAmount).toFixed(2));
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo cargar'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const submit = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/loans/${id}/historical-payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), receivedAt: new Date(`${date}T12:00:00.000Z`).toISOString(), notes: note, idempotencyKey: crypto.randomUUID() }),
      });
      setShowModal(false);
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo registrar'); }
    finally { setSaving(false); }
  };

  if (loading) return <AdminShell active="solicitudes" title="Historial papel"><div className="flex justify-center py-12"><Spinner /></div></AdminShell>;
  if (!loan) return <AdminShell active="solicitudes" title="Historial papel"><Alert variant="error">{error ?? 'No encontrado'}</Alert></AdminShell>;

  const totalCargado = payments.reduce((a, p) => a + p.amount, 0);

  return (
    <AdminShell active="solicitudes" title="Historial papel">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
          <div>
            <div className="flex items-center gap-sm mb-xs">
              <Link to={`/admin/solicitudes`} className="text-on-surface-variant hover:text-primary font-body-sm text-body-sm flex items-center gap-1"><Icon name="arrow_back" size={16} /> Volver a Detalle</Link>
              <span className="text-outline-variant text-sm">/</span>
              <span className="text-on-surface-variant font-body-sm text-body-sm">Préstamo #{loan.folio}</span>
            </div>
            <div className="flex items-center gap-md flex-wrap">
              <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-sm">Historial papel <span className="text-on-surface-variant font-headline-md text-headline-md font-normal">— abonos ya dados</span></h2>
              <span className="bg-secondary-container text-on-secondary-container font-label-md text-label-md px-3 py-1 rounded-full border border-secondary/20 flex items-center gap-1 shadow-sm"><span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />{loan.status}</span>
            </div>
          </div>
          <Button type="button" onClick={() => setShowModal(true)}><Icon name="history_edu" size={20} /> Añadir abono histórico</Button>
        </div>

        {error && <div className="mb-md"><Alert variant="error">{error}</Alert></div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
          <div className="lg:col-span-8 flex flex-col gap-lg">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden flex flex-col shadow-sm">
              <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <div><h3 className="font-headline-md text-headline-md text-on-surface">Plan de Pagos Original</h3><p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Cuotas programadas vs estado actual</p></div>
                <Icon name="calendar_month" className="text-outline" />
              </div>
              <div className="overflow-x-auto flex-grow max-h-[420px] overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-surface-container-high sticky top-0 z-10"><tr><th className="p-sm font-label-md text-label-md text-on-surface border-b border-outline-variant">Seq</th><th className="p-sm font-label-md text-label-md text-on-surface border-b border-outline-variant">Fecha Esperada</th><th className="p-sm font-label-md text-label-md text-on-surface border-b border-outline-variant text-right">Abono Esperado</th><th className="p-sm font-label-md text-label-md text-on-surface border-b border-outline-variant">Estado</th></tr></thead>
                  <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
                    {loan.schedule.map((row) => (
                      <tr key={row.seq} className={`hover:bg-surface-container-low ${row.status === 'OVERDUE' ? 'bg-error-container/10' : ''}`}>
                        <td className="p-sm font-body-sm text-body-sm text-on-surface-variant">{String(row.seq).padStart(2, '0')}</td>
                        <td className={`p-sm font-body-sm text-body-sm ${row.status === 'OVERDUE' ? 'text-error font-medium' : 'text-on-surface'}`}>{fmtDate(row.dueDate)}</td>
                        <td className="p-sm font-body-sm text-body-sm text-on-surface text-right font-medium">{currency.format(row.amount)}</td>
                        <td className="p-sm">
                          {row.status === 'PAID' && <span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface font-label-md text-label-md px-2 py-0.5 rounded-full border border-outline-variant/50 text-[12px]"><Icon name="check_circle" size={14} /> PAGADO</span>}
                          {row.status === 'OVERDUE' && <span className="inline-flex items-center gap-1 bg-error-container text-on-error-container font-label-md text-label-md px-2 py-0.5 rounded-full border border-error/20 text-[12px]"><Icon name="error" size={14} /> VENCIDO</span>}
                          {row.status === 'PENDING' && <span className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant font-label-md text-label-md px-2 py-0.5 rounded-full border border-outline-variant/50 text-[12px]">PENDIENTE</span>}
                          {row.status === 'PARTIAL' && <span className="inline-flex items-center gap-1 bg-warning/10 text-warning font-label-md text-label-md px-2 py-0.5 rounded-full text-[12px]">PARCIAL</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-lg">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-lg border-b border-outline-variant"><h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2"><Icon name="receipt_long" className="text-secondary" /> Pagos Históricos Cargados</h3><p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Registros migrados de papel</p></div>
              <div className="p-md flex-grow overflow-y-auto space-y-md max-h-[420px]">
                {payments.length === 0 ? <p className="text-sm text-on-surface-variant text-center py-8">Sin abonos históricos. Cárgalos uno por uno en orden cronológico.</p> : payments.map((p) => (
                  <div key={p.id} className="bg-surface rounded border border-outline-variant p-md relative overflow-hidden group hover:border-secondary transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2"><Icon name="event" size={18} className="text-on-surface-variant" /><span className="font-label-md text-label-md text-on-surface">{fmtDateTime(p.receivedAt)}</span></div>
                      <span className="font-data-lg text-data-lg text-primary">{currency.format(p.amount)}</span>
                    </div>
                    {p.notes && <div className="bg-surface-container-low rounded p-2 mt-2 border border-outline-variant flex items-start gap-2"><Icon name="sticky_note_2" size={16} className="text-on-surface-variant mt-0.5" /><p className="font-body-sm text-body-sm text-on-surface-variant italic">"{p.notes}"</p></div>}
                  </div>
                ))}
              </div>
              <div className="p-md border-t border-outline-variant bg-surface-container-lowest mt-auto">
                <div className="flex justify-between items-center"><span className="font-body-sm text-body-sm text-on-surface-variant">Total Cargado</span><span className="font-headline-md text-headline-md text-on-surface">{currency.format(totalCargado)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-margin-mobile bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-xl border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2"><Icon name="history_edu" className="text-primary" /> Añadir abono histórico</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-error p-1 rounded"><Icon name="close" /></button>
            </div>
            <div className="p-lg flex-grow overflow-y-auto">
              <div className="bg-secondary-fixed/30 border border-secondary/20 rounded p-md mb-lg flex gap-3 items-start"><Icon name="info" className="text-secondary mt-0.5" /><p className="font-body-sm text-body-sm text-on-surface-variant">Este registro afectará el saldo pero no genera recibos formales ni notificaciones al cliente. Úselo solo para conciliar registros en papel.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">Fecha de pago</label>
                  <div className="relative">
                    <Icon name="calendar_today" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded py-2 pl-10 pr-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-headline-md text-headline-md text-on-surface-variant">$</span>
                    <input type="number" step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded py-2 pl-8 pr-3 font-data-lg text-data-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-right font-medium" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-lg">
                <label className="font-label-md text-label-md text-on-surface flex justify-between">Nota interna <span className="text-on-surface-variant font-normal text-xs">Requerido</span></label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full bg-surface-container-low border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="px-lg py-md border-t border-outline-variant bg-surface-container-low flex justify-end gap-md">
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="button" loading={saving} onClick={submit}><Icon name="save" size={18} /> Registrar abono</Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
