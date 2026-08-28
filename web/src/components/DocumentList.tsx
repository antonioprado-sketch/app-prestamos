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
  const [viewer, setViewer] = useState<{ id: string; blobUrl: string; isPdf: boolean; label: string } | null>(null);

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

  const openViewer = async (doc: AdminDocument) => {
    const url = await signedUrl(doc.id);
    if (!url) return;
    setLoadingId(doc.id);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('No se pudo descargar el documento');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (viewer?.blobUrl) URL.revokeObjectURL(viewer.blobUrl);
      setViewer({ id: doc.id, blobUrl, isPdf: isPdf(doc), label: documentTypeLabel(doc.type) });
    } catch {
      // Fallback a window.open si el fetch blob falla (CORS inusual)
      window.open(url, '_blank', 'noopener');
    } finally {
      setLoadingId(null);
    }
  };

  const closeViewer = () => {
    if (viewer?.blobUrl) URL.revokeObjectURL(viewer.blobUrl);
    setViewer(null);
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
                onClick={() => openViewer(doc)}
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
      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={closeViewer}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-auto rounded-xl bg-white p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-secondary">{viewer.label}</p>
              <div className="flex gap-2">
                <a href={viewer.blobUrl} download={`${viewer.label.replace(/\s+/g, '_')}.${viewer.isPdf ? 'pdf' : 'jpg'}`} className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-medium text-primary hover:bg-surface-container-high">Descargar</a>
                <button type="button" onClick={closeViewer} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">Cerrar</button>
              </div>
            </div>
            {viewer.isPdf ? (
              <iframe src={viewer.blobUrl} title={viewer.label} className="h-[70vh] w-full rounded-lg border border-gray-200" />
            ) : (
              <img src={viewer.blobUrl} alt={viewer.label} className="max-h-[70vh] w-full object-contain rounded-lg bg-black" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}