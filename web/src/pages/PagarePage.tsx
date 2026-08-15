import { useEffect, useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

interface LoanSummary {
  id: string;
  status: string;
}

interface SignPagareResult {
  documentId: string;
  status: string;
}

const TERMINAL_STATUSES = ['LIQUIDATED', 'CANCELLED', 'REJECTED'];

export function PagarePage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);

  const [loan, setLoan] = useState<LoanSummary | null>(null);
  const [loadingLoan, setLoadingLoan] = useState(true);
  const [fullName, setFullName] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SignPagareResult | null>(null);

  useEffect(() => {
    apiFetch<LoanSummary[]>('/loans')
      .then((loans) => {
        const active = loans.find((l) => !TERMINAL_STATUSES.includes(l.status));
        setLoan(active ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoadingLoan(false));
  }, []);

  const getContext = () => canvasRef.current?.getContext('2d') ?? null;

  const pointerPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = getContext();
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1B2A4A';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokeRef.current = true;
    setHasSignature(true);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
    setHasSignature(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loan) return;
    if (!hasSignature) {
      setError('Dibuja tu firma antes de continuar');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    try {
      const signature = canvas.toDataURL('image/png');
      const res = await apiFetch<SignPagareResult>(`/loans/${loan.id}/pagare`, {
        method: 'POST',
        body: JSON.stringify({ signature, fullName }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo firmar el pagaré');
    } finally {
      setLoading(false);
    }
  };

  if (loadingLoan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Spinner />
      </main>
    );
  }

  if (!loan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <Alert variant="warning">No tienes una solicitud en curso para firmar.</Alert>
          <Link to="/calculadora" className="mt-4 inline-block text-primary">
            Ir a la calculadora
          </Link>
        </Card>
      </main>
    );
  }

  if (result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <Alert variant="success">Tu solicitud está siendo procesada.</Alert>
          <p className="mt-2 text-sm text-secondary">El pagaré quedó firmado y guardado.</p>
          <Button type="button" className="mt-4 w-full" onClick={() => navigate('/calculadora')}>
            Volver a mi solicitud
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Firma tu pagaré</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Dibuja tu firma y confirma tu nombre completo
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}

          <Input
            label="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-secondary">Firma</span>
            <canvas
              ref={canvasRef}
              width={320}
              height={140}
              className="touch-none rounded-xl border border-gray-300 bg-white"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />
            <Button type="button" variant="ghost" onClick={clearSignature}>
              Borrar firma
            </Button>
          </div>

          <p className="text-xs text-secondary">
            Al firmar aceptas obligarte incondicionalmente a pagar el monto total conforme al
            calendario de pagos.
          </p>

          <Button type="submit" loading={loading}>
            Firmar y enviar solicitud
          </Button>
        </form>
      </Card>
    </main>
  );
}
