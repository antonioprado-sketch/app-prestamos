import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';

interface BusinessRules {
  penaltyPerDay: number;
  yellowMaxDays: number;
  orangeMaxDays: number;
}

export function AdminConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<BusinessRules>({
    penaltyPerDay: 0,
    yellowMaxDays: 0,
    orangeMaxDays: 0,
  });

  useEffect(() => {
    apiFetch<BusinessRules>('/admin/configuration/business-rules')
      .then(setForm)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  const setField = (field: keyof BusinessRules) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setForm((f) => ({ ...f, [field]: Number.isFinite(value) ? value : 0 }));
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

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
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

            <Button type="submit" loading={saving} disabled={!!orderError} className="w-full">
              Guardar cambios
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
