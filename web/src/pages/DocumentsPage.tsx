import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';

type DocumentType = 'INE_FRONT' | 'INE_BACK' | 'ADDRESS_PROOF';

interface DocumentSummary {
  id: string;
  type: DocumentType;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

const SLOTS: { type: DocumentType; label: string; accept: string; hint: string }[] = [
  { type: 'INE_FRONT', label: 'INE — frente', accept: 'image/jpeg,image/png', hint: 'JPG o PNG, máx. 5MB' },
  { type: 'INE_BACK', label: 'INE — reverso', accept: 'image/jpeg,image/png', hint: 'JPG o PNG, máx. 5MB' },
  {
    type: 'ADDRESS_PROOF',
    label: 'Comprobante de domicilio',
    accept: 'image/jpeg,image/png,application/pdf',
    hint: 'JPG, PNG o PDF, máx. 5MB, no mayor a 3 meses',
  },
];

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    INE_FRONT: null,
    INE_BACK: null,
    ADDRESS_PROOF: null,
  });

  const load = () => {
    setLoadingList(true);
    apiFetch<DocumentSummary[]>('/documents')
      .then(setDocuments)
      .catch(() => undefined)
      .finally(() => setLoadingList(false));
  };

  useEffect(load, []);

  const uploadedFor = (type: DocumentType) => documents.find((d) => d.type === type);

  const onFileChange = (type: DocumentType) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploadingType(type);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('file', file);
      await apiFetch('/documents', { method: 'POST', body: form });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el archivo');
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-center text-xl font-bold text-secondary">Tus documentos</h1>
        <p className="mb-6 text-center text-sm text-secondary">
          Sube tu identificación oficial y tu comprobante
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        {loadingList ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {SLOTS.map((slot) => {
              const uploaded = uploadedFor(slot.type);
              const isUploading = uploadingType === slot.type;
              return (
                <div key={slot.type} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary">{slot.label}</span>
                    {uploaded && (
                      <span className="text-xs font-semibold text-primary">Subido ✓</span>
                    )}
                  </div>
                  <p className="text-xs text-secondary">{slot.hint}</p>
                  <input
                    type="file"
                    accept={slot.accept}
                    className="hidden"
                    disabled={isUploading}
                    ref={(el) => {
                      inputRefs.current[slot.type] = el;
                    }}
                    onChange={onFileChange(slot.type)}
                  />
                  <Button
                    type="button"
                    variant={uploaded ? 'ghost' : 'primary'}
                    loading={isUploading}
                    className="w-full"
                    onClick={() => inputRefs.current[slot.type]?.click()}
                  >
                    {uploaded ? 'Reemplazar' : 'Subir archivo'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Link to="/video" className="mt-6 block text-center text-primary">
          Continuar con el video de identidad
        </Link>
        <Link to="/calculadora" className="mt-2 block text-center text-sm text-secondary">
          Volver a mi solicitud
        </Link>
      </Card>
    </main>
  );
}
