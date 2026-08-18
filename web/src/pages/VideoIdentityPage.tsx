import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Icon } from '../components/ui/Icon';

const TIPS = [
  {
    icon: 'lightbulb',
    title: 'Buena iluminación',
    body: 'Asegúrate de que tu rostro esté bien iluminado, sin sombras fuertes.',
  },
  {
    icon: 'face',
    title: 'Rostro visible',
    body: 'Quítate lentes oscuros, gorras o cualquier cosa que cubra tu cara.',
  },
  {
    icon: 'record_voice_over',
    title: 'Habla claro',
    body: 'Lee la frase que aparecerá en pantalla en voz alta.',
  },
];

const DECLARED_PHRASE =
  'Declaro que solicito voluntariamente este préstamo y que la información que proporcioné es verdadera.';

const MIN_DURATION_SECONDS = 3;
const MIN_HEIGHT = 480;
const MIN_FACE_DETECTIONS = 3;
const MODEL_URL = '/mediapipe/model/blaze_face_short_range.tflite';
const WASM_BASE_URL = '/mediapipe/wasm';

type FaceDetectorInstance = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { detections: unknown[] };
  close: () => void;
};

export function VideoIdentityPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const detectorRef = useRef<FaceDetectorInstance | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const faceDetectionCountRef = useRef(0);
  const recordingStartRef = useRef(0);

  const [modelReady, setModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const visionModule = await import('@mediapipe/tasks-vision');
        const fileset = await visionModule.FilesetResolver.forVisionTasks(WASM_BASE_URL);
        const detector = await visionModule.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
        });
        if (cancelled) return;
        detectorRef.current = detector as unknown as FaceDetectorInstance;
        setModelReady(true);
      } catch {
        if (!cancelled) setError('No se pudo cargar la detección facial. Recarga la página.');
      }
    })();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      } catch {
        if (!cancelled) setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const runDetectionLoop = () => {
    const loop = () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (video && detector && video.readyState >= 2) {
        const result = detector.detectForVideo(video, performance.now());
        if (result.detections.length > 0) {
          faceDetectionCountRef.current += 1;
        }
      }
      detectionLoopRef.current = requestAnimationFrame(loop);
    };
    detectionLoopRef.current = requestAnimationFrame(loop);
  };

  const stopDetectionLoop = () => {
    if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
    detectionLoopRef.current = null;
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    setError(null);
    setVideoBlob(null);
    chunksRef.current = [];
    faceDetectionCountRef.current = 0;
    recordingStartRef.current = Date.now();
    setElapsedSeconds(0);

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopDetectionLoop();
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      validateAndSet(blob);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    runDetectionLoop();

    const tick = setInterval(() => {
      const seconds = (Date.now() - recordingStartRef.current) / 1000;
      setElapsedSeconds(seconds);
      if (recorderRef.current?.state !== 'recording') clearInterval(tick);
    }, 200);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const validateAndSet = (blob: Blob) => {
    const durationSeconds = (Date.now() - recordingStartRef.current) / 1000;
    const track = streamRef.current?.getVideoTracks()[0];
    const height = track?.getSettings().height ?? 0;

    if (durationSeconds < MIN_DURATION_SECONDS) {
      setError(
        `El video debe durar al menos ${MIN_DURATION_SECONDS} segundos. Grábalo de nuevo.`,
      );
      return;
    }
    if (height && height < MIN_HEIGHT) {
      setError('La resolución de tu cámara es muy baja. Intenta con otra cámara.');
      return;
    }
    if (faceDetectionCountRef.current < MIN_FACE_DETECTIONS) {
      setError('No detectamos tu rostro con claridad. Grábalo de nuevo mirando a la cámara.');
      return;
    }
    setVideoBlob(blob);
  };

  const retry = () => {
    setVideoBlob(null);
    setError(null);
  };

  const submit = async () => {
    if (!videoBlob) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('type', 'VIDEO_IDENTITY');
      form.append('file', videoBlob, 'video-identidad.webm');
      await apiFetch('/documents', { method: 'POST', body: form });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el video');
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <Alert variant="success">Video de identidad guardado.</Alert>
          <Button type="button" className="mt-4 w-full" onClick={() => navigate('/pagare')}>
            Continuar con el pagaré
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-margin-mobile">
      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-surface px-margin-mobile">
        <Link to="/documentos" className="text-primary transition-opacity hover:opacity-80" aria-label="Volver">
          <Icon name="arrow_back" />
        </Link>
        <span className="font-label-md text-label-md text-primary">Video de identidad</span>
        <span className="w-6" />
      </header>

      <div className="mt-16 w-full max-w-md">
        <div className="mb-lg text-center">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">
            Video de Identidad
          </h1>
          <p className="mt-sm font-body-md text-body-md text-on-surface-variant">
            Para proteger tu cuenta, necesitamos un breve video tuyo diciendo la frase en pantalla.
          </p>
        </div>

        <div className="mb-md">
          <Alert variant="warning">&ldquo;{DECLARED_PHRASE}&rdquo;</Alert>
        </div>

        {error && (
          <div className="mb-md">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-level-2">
          {showInstructions && !videoBlob && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-lg bg-surface-container-lowest/95 p-lg">
              <div className="flex w-full max-w-xs flex-col gap-lg">
                {TIPS.map((tip) => (
                  <div key={tip.title} className="flex items-start gap-md">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-fixed">
                      <Icon name={tip.icon} filled className="text-secondary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-label-md text-label-md text-primary">{tip.title}</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{tip.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="w-full max-w-xs rounded-lg bg-primary py-sm font-label-md text-label-md text-white shadow-md transition-transform active:scale-95"
              >
                Entendido, iniciar
              </button>
            </div>
          )}

          {videoBlob ? (
            <video
              src={URL.createObjectURL(videoBlob)}
              controls
              className="h-full w-full object-cover"
              data-testid="preview"
            />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          )}

          {!showInstructions && !videoBlob && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end p-md">
              <div className="w-full rounded-xl border border-white/10 bg-black/60 p-md text-center shadow-lg backdrop-blur-md">
                <p className="mb-1 font-body-sm text-body-sm text-surface-variant">
                  Por favor, lee en voz alta:
                </p>
                <p className="font-headline-md text-headline-md tracking-wide text-white">
                  &ldquo;{DECLARED_PHRASE}&rdquo;
                </p>
              </div>
            </div>
          )}
        </div>

        {!cameraReady && !error && (
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        )}

        {!videoBlob && cameraReady && (
          <div className="mt-4 flex flex-col gap-2">
            {recording && (
              <p className="text-center text-sm text-secondary">
                Grabando… {elapsedSeconds.toFixed(1)}s
              </p>
            )}
            {!recording ? (
              <Button type="button" disabled={!modelReady} onClick={startRecording}>
                {modelReady ? 'Iniciar grabación' : 'Cargando detección facial…'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="danger"
                disabled={elapsedSeconds < MIN_DURATION_SECONDS}
                onClick={stopRecording}
              >
                Detener grabación
              </Button>
            )}
          </div>
        )}

        {videoBlob && (
          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" loading={uploading} onClick={submit}>
              Enviar video
            </Button>
            <Button type="button" variant="ghost" disabled={uploading} onClick={retry}>
              Grabar de nuevo
            </Button>
          </div>
        )}

      </div>
    </main>
  );
}
