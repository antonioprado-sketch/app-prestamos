import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Icon } from '../components/ui/Icon';
import { CameraCapture } from '../components/CameraCapture';

type DocumentType = 'INE_FRONT' | 'INE_BACK' | 'ADDRESS_PROOF';

interface DocumentSummary {
  id: string;
  type: DocumentType;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

const SLOTS: { type: DocumentType; label: string; hint: string; icon: string }[] = [
  {
    type: 'INE_FRONT',
    label: 'INE Frente',
    hint: 'Asegúrate que los datos sean legibles.',
    icon: 'id_card',
  },
  {
    type: 'INE_BACK',
    label: 'INE Reverso',
    hint: 'Código de barras claramente visible.',
    icon: 'credit_card',
  },
  {
    type: 'ADDRESS_PROOF',
    label: 'Comprobante de domicilio',
    hint: 'No mayor a 3 meses de antigüedad.',
    icon: 'home_pin',
  },
];

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [captureType, setCaptureType] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoadingList(true);
    apiFetch<DocumentSummary[]>('/documents')
      .then(setDocuments)
      .catch(() => undefined)
      .finally(() => setLoadingList(false));
  };

  useEffect(load, []);

  const uploadedFor = (type: DocumentType) => documents.find((d) => d.type === type);

  const viewDocument = async (id: string) => {
    try {
      const res = await apiFetch<{ url: string }>(`/documents/${id}/signed-url`);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el documento');
    }
  };

  const onCaptured = (type: DocumentType) => async (blob: Blob) => {
    setCaptureType(null);
    setError(null);
    setUploadingType(type);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('file', blob, 'documento.jpg');
      await apiFetch('/documents', { method: 'POST', body: form });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto');
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-background pb-margin-mobile pt-16">
      <div className="w-full max-w-2xl px-margin-mobile">
        <div className="mb-xl text-center">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">
            Identidad y Domicilio
          </h1>
          <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
            Para asegurar tu cuenta, necesitamos verificar tu identidad. Sube fotos claras y
            legibles de tus documentos.
          </p>
        </div>

        {error && (
          <div className="mb-md">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {loadingList ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-md">
            {SLOTS.map((slot) => {
              const uploaded = uploadedFor(slot.type);
              const isUploading = uploadingType === slot.type;
              return (
                <div
                  key={slot.type}
                  className={`rounded-xl bg-surface-container-lowest p-md shadow-level-2 ${
                    uploaded ? '' : 'border-l-2 border-secondary'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="mb-sm flex items-center gap-sm">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          uploaded ? 'bg-success/10 text-success' : 'bg-surface-container-high text-primary'
                        }`}
                      >
                        <Icon name={slot.icon} />
                      </div>
                      <div>
                        <h3 className="font-headline-md text-headline-md text-primary">{slot.label}</h3>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{slot.hint}</p>
                      </div>
                    </div>
                    <span
                      className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-label-md text-label-md ${
                        uploaded ? 'bg-success/10 text-success' : 'bg-surface-container text-on-surface-variant opacity-70'
                      }`}
                    >
                      <Icon name={uploaded ? 'check_circle' : 'pending'} size={16} />
                      {uploaded ? 'Validado' : 'Pendiente'}
                    </span>
                  </div>

                  {uploaded ? (
                    <div className="mt-md flex items-center justify-between rounded-lg border border-outline-variant bg-background p-sm">
                      <span className="font-label-md text-label-md text-primary">Foto subida</span>
                      <div className="flex gap-xs">
                        <button
                          type="button"
                          onClick={() => viewDocument(uploaded.id)}
                          className="rounded-full bg-surface-container-lowest p-2 text-primary shadow-md transition-colors hover:bg-surface-container-high"
                          aria-label="Ver documento"
                        >
                          <Icon name="visibility" size={20} />
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          loading={isUploading}
                          onClick={() => setCaptureType(slot.type)}
                        >
                          Reemplazar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setCaptureType(slot.type)}
                      className="mt-md flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-outline-variant bg-background p-xl transition-colors hover:border-secondary"
                    >
                      {isUploading ? (
                        <Spinner />
                      ) : (
                        <>
                          <Icon name="add_a_photo" size={36} className="mb-sm text-on-surface-variant" />
                          <span className="font-label-md text-label-md text-primary">
                            Tomar foto con la cámara
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-xl flex flex-col gap-md sm:flex-row sm:justify-end">
          <Link to="/calculadora" className="w-full sm:w-auto">
            <button className="flex h-12 w-full items-center justify-center rounded-lg border border-primary px-lg font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-low sm:w-auto">
              Volver a mi solicitud
            </button>
          </Link>
          <Link to="/video" className="w-full sm:w-auto">
            <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-lg font-label-md text-label-md text-white transition-opacity hover:opacity-90 sm:w-auto">
              Video de identidad
              <Icon name="arrow_forward" size={20} />
            </button>
          </Link>
        </div>
      </div>

      {captureType && (
        <CameraCapture
          title={SLOTS.find((s) => s.type === captureType)?.label ?? 'Documento'}
          onCapture={onCaptured(captureType)}
          onCancel={() => setCaptureType(null)}
        />
      )}
    </main>
  );
}
