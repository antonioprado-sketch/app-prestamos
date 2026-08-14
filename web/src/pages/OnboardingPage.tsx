import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';

interface CustomerForm {
  nombres: string;
  apellidos: string;
  aval: string;
  avalPhone: string;
  calle: string;
  numero: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencias: string;
}

const EMPTY_FORM: CustomerForm = {
  nombres: '',
  apellidos: '',
  aval: '',
  avalPhone: '',
  calle: '',
  numero: '',
  colonia: '',
  cp: '',
  ciudad: '',
  estado: '',
  referencias: '',
};

export function OnboardingPage() {
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const setField = (field: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/customers/me', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar tus datos');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <Alert variant="success">Tus datos se guardaron correctamente.</Alert>
          <Link to="/calculadora" className="mt-4 inline-block text-primary">
            Volver a mi solicitud
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Completa tus datos</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Necesitamos esta información para procesar tu solicitud
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}

          <Input label="Nombres" maxLength={25} value={form.nombres} onChange={setField('nombres')} required />
          <Input
            label="Apellidos"
            maxLength={35}
            value={form.apellidos}
            onChange={setField('apellidos')}
            required
          />

          <Input
            label="Nombre del aval"
            maxLength={70}
            value={form.aval}
            onChange={setField('aval')}
            required
          />
          <Input
            label="Teléfono del aval"
            type="tel"
            inputMode="numeric"
            value={form.avalPhone}
            onChange={setField('avalPhone')}
            required
          />

          <Input label="Calle" value={form.calle} onChange={setField('calle')} required />
          <Input label="Número" value={form.numero} onChange={setField('numero')} required />
          <Input label="Colonia" value={form.colonia} onChange={setField('colonia')} required />
          <Input
            label="Código postal"
            inputMode="numeric"
            value={form.cp}
            onChange={setField('cp')}
            required
          />
          <Input label="Ciudad" value={form.ciudad} onChange={setField('ciudad')} required />
          <Input label="Estado" value={form.estado} onChange={setField('estado')} required />
          <Input
            label="Referencias del domicilio"
            maxLength={255}
            value={form.referencias}
            onChange={setField('referencias')}
            required
          />

          <Button type="submit" loading={loading}>
            Guardar
          </Button>
        </form>
      </Card>
    </main>
  );
}
