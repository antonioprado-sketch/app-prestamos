import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [permState, setPermState] = useState<PermissionState | null>(null);

  const requestCamera = async (showPrompt = true) => {
    setError(null);
    setReady(false);
    // Chequeo de permiso explícito (galería no aplica — solo cámara, por anti-fraude)
    try {
      if (navigator.permissions?.query) {
        const r = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setPermState(r.state);
        r.onchange = () => setPermState(r.state);
        if (r.state === 'denied') {
          setError(
            'Permiso de cámara denegado. Ve a Ajustes del sistema → Apps → Chrome/Navegador → Permisos → Cámara → Permitir, y recarga. Si estás en http:// (sin HTTPS), el navegador la bloquea: usa https://192.168.68.71',
          );
          return;
        }
      }
    } catch {
      // ignorar — no todos los navegadores soportan permissions.query camera
    }
    if (!window.isSecureContext && showPrompt) {
      setError('Estás en HTTP. El navegador bloquea la cámara. Abre en https://192.168.68.71 o https://localhost (acepta el certificado) para permitir el acceso.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Esperar a que el video tenga dimensiones antes de marcar ready
        await new Promise<void>((res) => {
          const v = videoRef.current!;
          if (v.readyState >= 2 && v.videoWidth > 0) return res();
          const onLoaded = () => { v.removeEventListener('loadedmetadata', onLoaded); res(); };
          v.addEventListener('loadedmetadata', onLoaded, { once: true });
          setTimeout(() => res(), 1500);
        });
      }
      setReady(true);
    } catch (e: unknown) {
      const err = e as DOMException;
      if (err?.name === 'NotAllowedError') {
        setError('Permiso denegado. Toca “Permitir” cuando el navegador pida acceso a la cámara. Si lo denegaste antes, ve a Ajustes → Permisos → Cámara → Permitir y recarga.');
      } else if (err?.name === 'NotFoundError') {
        setError('No se encontró cámara trasera. Prueba en otro dispositivo.');
      } else {
        setError('No se pudo acceder a la cámara. Asegúrate de permitir el acceso y de estar en una conexión segura (HTTPS).');
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await requestCamera(false);
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const snapshotUrl = useMemo(() => (snapshot ? URL.createObjectURL(snapshot) : null), [snapshot]);
  useEffect(() => {
    return () => { if (snapshotUrl) URL.revokeObjectURL(snapshotUrl); };
  }, [snapshotUrl]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < 2 || video.videoWidth === 0) {
      setError('Cámara aún cargando. Espera 1 segundo e intenta de nuevo.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob && blob.size > 0) setSnapshot(blob);
      else setError('No se pudo capturar la imagen. Reintenta.');
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
          {error && (
            <div className="space-y-2">
              <Alert variant="error">{error}</Alert>
              {(permState === 'denied' || error.includes('Permiso') || error.includes('HTTP')) && (
                <Button type="button" onClick={() => requestCamera(true)} className="w-full">
                  Solicitar permiso de cámara
                </Button>
              )}
            </div>
          )}
          <div className="relative mt-3 aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
            {snapshot ? (
              <img
                src={snapshotUrl!}
                alt="Captura"
                className="h-full w-full object-cover"
                data-testid="camera-preview"
                onError={() => setError('No se pudo mostrar la vista previa (CSP o blob bloqueado). Recarga y reintenta.')}
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  data-testid="camera-live"
                />
                {ready && !error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4" aria-hidden="true">
                    <div className="relative h-[42%] w-[86%] rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                      <span className="absolute -top-1 -left-1 h-4 w-4 border-l-2 border-t-2 border-white rounded-tl-lg" />
                      <span className="absolute -top-1 -right-1 h-4 w-4 border-r-2 border-t-2 border-white rounded-tr-lg" />
                      <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-white rounded-bl-lg" />
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-white rounded-br-lg" />
                    </div>
                  </div>
                )}
                {ready && !error && (
                  <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    Mantén los 4 bordes dentro del marco
                  </p>
                )}
              </>
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