import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { Icon } from '../components/ui/Icon';

interface BusinessRules {
  penaltyPerDay: number;
  yellowMaxDays: number;
  orangeMaxDays: number;
  greenMaxAmount: number | null;
  yellowMaxAmount: number;
  orangeMaxAmount: number;
  redMaxAmount: number;
}
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
}
const EMAIL_DEFAULTS: EmailConfig = { host: 'smtp.gmail.com', port: 465, secure: true, user: '', hasPassword: false };

export function AdminConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<BusinessRules>({ penaltyPerDay: 0, yellowMaxDays: 0, orangeMaxDays: 0, greenMaxAmount: null, yellowMaxAmount: 0, orangeMaxAmount: 0, redMaxAmount: 0 });
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(EMAIL_DEFAULTS);
  const [emailPass, setEmailPass] = useState('');
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testText, setTestText] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BusinessRules>('/admin/configuration/business-rules').then(setForm).catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración')).finally(() => setLoading(false));
    apiFetch<EmailConfig>('/admin/configuration/email').then(setEmailConfig).catch((err) => setEmailError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración de correo')).finally(() => setEmailLoading(false));
  }, []);

  const setField = (field: keyof BusinessRules) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setForm((f) => ({ ...f, [field]: Number.isFinite(value) ? value : 0 }));
    setSuccess(false);
  };
  const setGreenMax = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setForm((f) => ({ ...f, greenMaxAmount: raw === '' ? null : Number(raw) }));
    setSuccess(false);
  };
  const orderError = form.yellowMaxDays > 0 && form.orangeMaxDays > 0 && form.yellowMaxDays >= form.orangeMaxDays ? 'Los días de amarillo deben ser menores a los de naranja' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderError) return;
    setSaving(true); setError(null); setSuccess(false);
    try { const updated = await apiFetch<BusinessRules>('/admin/configuration/business-rules', { method: 'PUT', body: JSON.stringify(form) }); setForm(updated); setSuccess(true); } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración'); } finally { setSaving(false); }
  };
  const setEmailField = (field: 'host' | 'user') => (e: React.ChangeEvent<HTMLInputElement>) => { setEmailConfig((c) => ({ ...c, [field]: e.target.value })); setEmailSuccess(false); };
  const setEmailPort = (e: React.ChangeEvent<HTMLInputElement>) => { const value = Number(e.target.value); setEmailConfig((c) => ({ ...c, port: Number.isFinite(value) ? value : 0 })); setEmailSuccess(false); };
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setEmailSaving(true); setEmailError(null); setEmailSuccess(false);
    try {
      const body: Record<string, unknown> = { host: emailConfig.host, port: emailConfig.port, secure: emailConfig.secure, user: emailConfig.user };
      if (emailPass) body.pass = emailPass;
      const updated = await apiFetch<EmailConfig>('/admin/configuration/email', { method: 'PUT', body: JSON.stringify(body) });
      setEmailConfig(updated); setEmailPass(''); setEmailSuccess(true);
    } catch (err) { setEmailError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración de correo'); } finally { setEmailSaving(false); }
  };
  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setTestLoading(true); setTestError(null); setTestResult(null);
    try {
      const res = await apiFetch<{ simulated: boolean }>('/admin/configuration/email/test', { method: 'POST', body: JSON.stringify({ to: testTo, text: testText }) });
      setTestResult(res.simulated ? 'Simulado: no hay credenciales reales activas, se registró en el log del servidor.' : `Correo real enviado a ${testTo}.`);
    } catch (err) { setTestError(err instanceof ApiError ? err.message : 'No se pudo enviar el correo de prueba'); } finally { setTestLoading(false); }
  };

  return (
    <AdminShell active="configuracion" title="Configuración">
      <div className="mx-auto max-w-5xl space-y-lg">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary">Configuración</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Ajusta reglas de negocio y correo. Cambios aplican de inmediato.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg items-start">
          {/* Reglas de negocio */}
          <Card className="border border-outline-variant shadow-level-2">
            <div className="flex items-start gap-md mb-lg">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Icon name="tune" size={20} /></div>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Reglas de negocio</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Multa, umbrales de score y topes por color. Afectan a todos los préstamos activos.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
                {error && <Alert variant="error">{error}</Alert>}
                {success && <Alert variant="success">Configuración actualizada.</Alert>}

                <div className="rounded-xl bg-surface-container-low p-md border border-outline-variant/50">
                  <h3 className="font-label-md text-label-md text-on-surface flex items-center gap-2 mb-md"><Icon name="payments" size={16} className="text-primary" /> Multa por atraso</h3>
                  <Input label="Monto por día ($ MXN)" type="number" step="0.01" min="0.01" value={form.penaltyPerDay} onChange={setField('penaltyPerDay')} required />
                  <p className="mt-2 text-xs text-on-surface-variant">Se aplica por cada cuota vencida no pagada.</p>
                </div>

                <div className="rounded-xl bg-surface-container-low p-md border border-outline-variant/50">
                  <h3 className="font-label-md text-label-md text-on-surface flex items-center gap-2 mb-md"><Icon name="flag" size={16} className="text-primary" /> Umbrales de score</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <Input label="Máx. días amarillo" type="number" step="1" min="1" value={form.yellowMaxDays} onChange={setField('yellowMaxDays')} error={orderError ?? undefined} required />
                    <Input label="Máx. días naranja" type="number" step="1" min="1" value={form.orangeMaxDays} onChange={setField('orangeMaxDays')} required />
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">Más de {form.orangeMaxDays || '—'} días = <span className="text-error font-semibold">Rojo</span>.</p>
                  {orderError && <p className="mt-1 text-xs text-error">{orderError}</p>}
                </div>

                <div className="rounded-xl bg-surface-container-low p-md border border-outline-variant/50">
                  <h3 className="font-label-md text-label-md text-on-surface flex items-center gap-2 mb-md"><Icon name="account_balance_wallet" size={16} className="text-primary" /> Topes por color de score</h3>
                  <p className="mb-md text-xs text-on-surface-variant">Para clientes sin préstamo vigente ni límite aprobado. Verde vacío = sin tope.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <Input label="Verde (vacío = sin tope)" type="number" step="500" min="0.01" value={form.greenMaxAmount ?? ''} onChange={setGreenMax} />
                    <Input label="Amarillo" type="number" step="500" min="0.01" value={form.yellowMaxAmount} onChange={setField('yellowMaxAmount')} required />
                    <Input label="Naranja" type="number" step="500" min="0.01" value={form.orangeMaxAmount} onChange={setField('orangeMaxAmount')} required />
                    <Input label="Rojo" type="number" step="500" min="0.01" value={form.redMaxAmount} onChange={setField('redMaxAmount')} required />
                  </div>
                </div>

                <Button type="submit" loading={saving} disabled={!!orderError} className="w-full">Guardar reglas</Button>
              </form>
            )}
          </Card>

          {/* Correo */}
          <div className="flex flex-col gap-lg">
            <Card className="border border-outline-variant shadow-level-2">
              <div className="flex items-start gap-md mb-lg">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0"><Icon name="mail" size={20} /></div>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">Correo (SMTP)</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Para notificaciones. Se guarda cifrado; la contraseña no se vuelve a mostrar.</p>
                </div>
              </div>

              {emailLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-md">
                  {emailError && <Alert variant="error">{emailError}</Alert>}
                  {emailSuccess && <Alert variant="success">Credenciales guardadas.</Alert>}

                  <Input label="Servidor SMTP" value={emailConfig.host} onChange={setEmailField('host')} required />
                  <div className="grid grid-cols-2 gap-md">
                    <Input label="Puerto" type="number" step="1" min="1" value={emailConfig.port} onChange={setEmailPort} required />
                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 rounded-lg border border-outline-variant p-3 bg-surface-container-low cursor-pointer">
                        <input id="email-secure" type="checkbox" checked={emailConfig.secure} onChange={(e) => { setEmailConfig((c) => ({ ...c, secure: e.target.checked })); setEmailSuccess(false); }} className="h-4 w-4 accent-primary" />
                        <span className="text-sm text-on-surface">SSL (465)</span>
                      </label>
                      <span className="mt-1 text-[11px] text-on-surface-variant">Desmarca para STARTTLS (587)</span>
                    </div>
                  </div>
                  <Input label="Usuario / remitente" type="email" value={emailConfig.user} onChange={setEmailField('user')} required />
                  <Input label="Contraseña (App Password)" type="password" value={emailPass} onChange={(e) => { setEmailPass(e.target.value); setEmailSuccess(false); }} placeholder={emailConfig.hasPassword ? 'Ya guardada — vacío conserva' : ''} />
                  <p className={`text-xs ${emailConfig.hasPassword ? 'text-success' : 'text-on-surface-variant'}`}>{emailConfig.hasPassword ? '✓ Contraseña configurada' : 'Sin contraseña — correo simulado en log'}</p>

                  <Button type="submit" loading={emailSaving} className="w-full">Guardar credenciales</Button>
                </form>
              )}
            </Card>

            <Card className="border border-outline-variant shadow-level-2">
              <h3 className="font-label-md text-label-md text-on-surface flex items-center gap-2 mb-sm"><Icon name="send" size={16} className="text-primary" /> Probar envío</h3>
              <p className="mb-md text-xs text-on-surface-variant">Envía un correo real con las credenciales de arriba para validar.</p>
              <form onSubmit={handleTestEmail} className="flex flex-col gap-md">
                {testError && <Alert variant="error">{testError}</Alert>}
                {testResult && <Alert variant="success">{testResult}</Alert>}
                <Input label="Destinatario" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} required />
                <Input label="Mensaje" value={testText} onChange={(e) => setTestText(e.target.value)} required />
                <Button type="submit" variant="ghost" loading={testLoading} className="w-full border border-outline-variant">Enviar prueba</Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
