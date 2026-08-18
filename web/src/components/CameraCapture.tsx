import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

interface CameraCaptureProps {
  title: string;
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}

export function CameraCapture({ title, onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      } catch {
        if (!cancelled)
          setError(
            'No se pudo acceder a la cámara. Asegúrate de permitir el acceso y de estar en una conexión segura (HTTPS).',
          );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) setSnapshot(blob);
    }, 'image/jpeg', 0.85);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-secondary">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="text-2xl leading-none text-secondary"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
            {snapshot ? (
              <img
                src={URL.createObjectURL(snapshot)}
                alt="Captura"
                className="h-full w-full object-cover"
                data-testid="camera-preview"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
                data-testid="camera-live"
              />
            )}
          </div>
          {!ready && !error && (
            <p className="mt-3 text-center text-sm text-secondary">Abriendo cámara…</p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {!snapshot ? (
              <Button type="button" disabled={!ready} onClick={takePhoto}>
                Tomar foto
              </Button>
            ) : (
              <>
                <Button type="button" onClick={() => onCapture(snapshot)}>
                  Usar esta foto
                </Button>
                <Button type="button" variant="ghost" onClick={() => setSnapshot(null)}>
                  Repetir
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}