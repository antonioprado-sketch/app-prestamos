import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AdminShell } from './dashboard/AdminShell';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';

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

const EMAIL_DEFAULTS: EmailConfig = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: '',
  hasPassword: false,
};

export function AdminConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<BusinessRules>({
    penaltyPerDay: 0,
    yellowMaxDays: 0,
    orangeMaxDays: 0,
    greenMaxAmount: null,
    yellowMaxAmount: 0,
    orangeMaxAmount: 0,
    redMaxAmount: 0,
  });

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
    apiFetch<BusinessRules>('/admin/configuration/business-rules')
      .then(setForm)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración'))
      .finally(() => setLoading(false));

    apiFetch<EmailConfig>('/admin/configuration/email')
      .then(setEmailConfig)
      .catch((err) => setEmailError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración de correo'))
      .finally(() => setEmailLoading(false));
  }, []);

  const setField = (field: keyof BusinessRules) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setForm((f) => ({ ...f, [field]: Number.isFinite(value) ? value : 0 }));
    setSuccess(false);
  };

  const setGreenMax = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setForm((f) => ({
      ...f,
      greenMaxAmount: raw === '' ? null : Number(raw),
    }));
    setSuccess(false);
  };

  const orderError =
    form.yellowMaxDays > 0 && form.orangeMaxDays > 0 && form.yellowMaxDays >= form.orangeMaxDays
      ? 'Los días de amarillo deben ser menores a los de naranja'
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderError) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await apiFetch<BusinessRules>('/admin/configuration/business-rules', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setForm(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const setEmailField =
    (field: 'host' | 'user') => (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmailConfig((c) => ({ ...c, [field]: e.target.value }));
      setEmailSuccess(false);
    };

  const setEmailPort = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setEmailConfig((c) => ({ ...c, port: Number.isFinite(value) ? value : 0 }));
    setEmailSuccess(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    setEmailError(null);
    setEmailSuccess(false);
    try {
      const body: Record<string, unknown> = {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        user: emailConfig.user,
      };
      if (emailPass) body.pass = emailPass;
      const updated = await apiFetch<EmailConfig>('/admin/configuration/email', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setEmailConfig(updated);
      setEmailPass('');
      setEmailSuccess(true);
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración de correo');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await apiFetch<{ simulated: boolean }>('/admin/configuration/email/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo, text: testText }),
      });
      setTestResult(
        res.simulated
          ? 'Simulado: no hay credenciales reales activas, se registró en el log del servidor en vez de enviarse de verdad.'
          : `Correo real enviado a ${testTo}.`,
      );
    } catch (err) {
      setTestError(err instanceof ApiError ? err.message : 'No se pudo enviar el correo de prueba');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <AdminShell active="configuracion" title="Reglas de negocio">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Reglas de negocio</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Multa por atraso y umbrales de score. Los cambios aplican de inmediato a todos los préstamos.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">Configuración actualizada.</Alert>}

            <Input
              label="Multa por día de atraso ($ MXN)"
              type="number"
              step="0.01"
              min="0.01"
              value={form.penaltyPerDay}
              onChange={setField('penaltyPerDay')}
              required
            />
            <Input
              label="Días de atraso máximos para score amarillo"
              type="number"
              step="1"
              min="1"
              value={form.yellowMaxDays}
              onChange={setField('yellowMaxDays')}
              error={orderError ?? undefined}
              required
            />
            <Input
              label="Días de atraso máximos para score naranja"
              type="number"
              step="1"
              min="1"
              value={form.orangeMaxDays}
              onChange={setField('orangeMaxDays')}
              required
            />
            <p className="text-xs text-secondary">
              Más de {form.orangeMaxDays || '—'} días de atraso se marca en rojo.
            </p>

            <div className="border-t border-gray-100 pt-3">
              <h2 className="mb-1 text-sm font-semibold text-secondary">
                Tope de préstamo por color de score
              </h2>
              <p className="mb-3 text-xs text-secondary">
                Aplica a clientes ya registrados, sin préstamo vigente ni límite aprobado. El
                tope verde vacío significa sin tope.
              </p>
            </div>
            <Input
              label="Tope verde ($ MXN, vacío = sin tope)"
              type="number"
              step="500"
              min="0.01"
              value={form.greenMaxAmount ?? ''}
              onChange={setGreenMax}
            />
            <Input
              label="Tope amarillo ($ MXN)"
              type="number"
              step="500"
              min="0.01"
              value={form.yellowMaxAmount}
              onChange={setField('yellowMaxAmount')}
              required
            />
            <Input
              label="Tope naranja ($ MXN)"
              type="number"
              step="500"
              min="0.01"
              value={form.orangeMaxAmount}
              onChange={setField('orangeMaxAmount')}
              required
            />
            <Input
              label="Tope rojo ($ MXN)"
              type="number"
              step="500"
              min="0.01"
              value={form.redMaxAmount}
              onChange={setField('redMaxAmount')}
              required
            />

            <Button type="submit" loading={saving} disabled={!!orderError} className="w-full">
              Guardar cambios
            </Button>
          </form>
        )}
      </Card>

      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Correo (SMTP)</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Credenciales para notificaciones por correo (ej. recuperar contraseña). Se guardan
          cifradas — la contraseña nunca se vuelve a mostrar una vez guardada.
        </p>

        {emailLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              {emailError && <Alert variant="error">{emailError}</Alert>}
              {emailSuccess && <Alert variant="success">Configuración de correo actualizada.</Alert>}

              <Input
                label="Servidor SMTP"
                value={emailConfig.host}
                onChange={setEmailField('host')}
                required
              />
              <Input
                label="Puerto"
                type="number"
                step="1"
                min="1"
                value={emailConfig.port}
                onChange={setEmailPort}
                required
              />
              <div className="flex items-center gap-2">
                <input
                  id="email-secure"
                  type="checkbox"
                  checked={emailConfig.secure}
                  onChange={(e) => {
                    setEmailConfig((c) => ({ ...c, secure: e.target.checked }));
                    setEmailSuccess(false);
                  }}
                  className="h-4 w-4"
                />
                <label htmlFor="email-secure" className="text-sm text-secondary">
                  Conexión segura (SSL, puerto 465). Desmarca para STARTTLS (puerto 587).
                </label>
              </div>
              <Input
                label="Usuario / correo remitente"
                type="email"
                value={emailConfig.user}
                onChange={setEmailField('user')}
                required
              />
              <Input
                label="Contraseña (App Password de Gmail)"
                type="password"
                value={emailPass}
                onChange={(e) => {
                  setEmailPass(e.target.value);
                  setEmailSuccess(false);
                }}
                placeholder={emailConfig.hasPassword ? 'Ya guardada — deja vacío para conservarla' : ''}
              />
              <p className="text-xs text-secondary">
                {emailConfig.hasPassword
                  ? 'Contraseña configurada.'
                  : 'Sin contraseña configurada — el correo se simula (queda en el log) hasta que guardes una.'}
              </p>

              <Button type="submit" loading={emailSaving} className="w-full">
                Guardar credenciales
              </Button>
            </form>

            <div className="mt-6 border-t border-gray-200 pt-4">
              <h2 className="mb-1 text-sm font-semibold text-secondary">Enviar correo de prueba</h2>
              <p className="mb-3 text-xs text-secondary">
                Manda un correo real con las credenciales guardadas arriba, para validar que
                funcionan antes de depender de ellas.
              </p>
              <form onSubmit={handleTestEmail} className="flex flex-col gap-3">
                {testError && <Alert variant="error">{testError}</Alert>}
                {testResult && <Alert variant="success">{testResult}</Alert>}
                <Input
                  label="Correo destinatario"
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  required
                />
                <Input
                  label="Texto del mensaje"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  required
                />
                <Button type="submit" variant="ghost" loading={testLoading} className="w-full">
                  Enviar prueba
                </Button>
              </form>
            </div>
          </>
        )}
      </Card>
      </div>
    </AdminShell>
  );
}
