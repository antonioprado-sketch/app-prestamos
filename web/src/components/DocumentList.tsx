import { useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { formatShortDate } from '../lib/dates';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

export interface AdminDocument {
  id: string;
  type: string;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  INE_FRONT: 'INE frente',
  INE_BACK: 'INE reverso',
  ADDRESS_PROOF: 'Comprobante de domicilio',
  VIDEO_IDENTITY: 'Video de identidad',
  PAGARE: 'Pagaré',
  COLLECTOR_DOC: 'Evidencia de visita',
};

function documentTypeLabel(type: string): string {
  return DOC_TYPE_LABEL[type] ?? type;
}

function isVideo(doc: AdminDocument): boolean {
  return (doc.mime ?? '').startsWith('video/') || doc.type === 'VIDEO_IDENTITY';
}

function isPdf(doc: AdminDocument): boolean {
  return (doc.mime ?? '').startsWith('application/pdf');
}

export function DocumentList({ documents }: { documents: AdminDocument[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoOpenId, setVideoOpenId] = useState<string | null>(null);

  const signedUrl = async (id: string): Promise<string | null> => {
    if (urls[id]) return urls[id];
    setLoadingId(id);
    setError(null);
    try {
      const res = await apiFetch<{ url: string }>(
        `/admin/documents/${id}/signed-url`,
      );
      setUrls((prev) => ({ ...prev, [id]: res.url }));
      return res.url;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo obtener el documento',
      );
      return null;
    } finally {
      setLoadingId(null);
    }
  };

  const openInTab = async (id: string) => {
    const url = await signedUrl(id);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const toggleVideo = async (id: string) => {
    if (videoOpenId === id) {
      setVideoOpenId(null);
      return;
    }
    const url = await signedUrl(id);
    if (url) setVideoOpenId(id);
  };

  if (documents.length === 0) {
    return <p className="text-xs text-secondary">Sin documentos.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Alert variant="error">{error}</Alert>}
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex flex-col gap-1 rounded-xl border border-gray-200 p-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-secondary">
                {documentTypeLabel(doc.type)}
              </p>
              <p className="text-[10px] text-secondary">
                {formatShortDate(doc.createdAt)}
                {doc.sizeBytes ? ` · ${(doc.sizeBytes / 1024).toFixed(0)} KB` : ''}
              </p>
            </div>
            {isVideo(doc) ? (
              <Button
                type="button"
                variant="ghost"
                loading={loadingId === doc.id}
                onClick={() => toggleVideo(doc.id)}
              >
                {videoOpenId === doc.id ? 'Ocultar video' : 'Ver video'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                loading={loadingId === doc.id}
                onClick={() => openInTab(doc.id)}
              >
                {isPdf(doc) ? 'Ver PDF' : 'Ver'}
              </Button>
            )}
          </div>
          {videoOpenId === doc.id && urls[doc.id] && (
            <video
              controls
              preload="metadata"
              crossOrigin="anonymous"
              className="mt-1 w-full rounded-lg bg-black"
              src={urls[doc.id]}
              onError={() => setError('No se pudo reproducir el video. Si es Firefox, prueba en Chrome. El archivo puede ser webm no compatible.')}
            />
          )}
        </div>
      ))}
    </div>
  );
}