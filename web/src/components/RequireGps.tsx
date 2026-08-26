import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { getLocationConsent, setLocationConsent, type LocationSource } from '../lib/location';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Spinner } from './ui/Spinner';

type GpsState = 'checking' | 'granted' | 'blocked' | 'insecure' | 'unsupported';

export function RequireGps({ source, children }: { source: LocationSource; children: React.ReactNode }) {
  const [state, setState] = useState<GpsState>('checking');
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const check = async () => {
    // GPS y cámara requieren contexto seguro (HTTPS o localhost).
    // En http://192.168.x.x Chrome bloquea getCurrentPosition y getUserMedia.
    if (!window.isSecureContext) {
      setState('insecure');
      return;
    }
    if (!('geolocation' in navigator)) {
      setState('unsupported');
      return;
    }
    // Si ya está concedido, verificar que realmente podemos obtener posición
    // (el permiso puede estar granted pero el GPS del dispositivo apagado -> timeout/error).
    const consent = getLocationConsent();
    if (consent === 'granted') {
      // Intentar obtener una posición fresca para validar que el GPS está activo
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Reportar al backend y marcar como granted
          apiFetch('/locations', {
            method: 'POST',
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              source,
            }),
          }).catch(() => undefined);
          setState('granted');
        },
        (err) => {
          // Si falla aún con consent granted, volver a estado bloqueado para re-intentar
          if (err.code === err.PERMISSION_DENIED) setState('blocked');
          else {
            setError('No se pudo obtener tu ubicación. Verifica que el GPS esté encendido.');
            setState('blocked');
          }
        },
        { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 },
      );
      return;
    }
    // Sin consent aún -> pedir permiso explícitamente
    // Intentamos query de permisos si existe para no mostrar bloqueado de entrada
    try {
      const perm = await (navigator.permissions as unknown as { query: (o: { name: string }) => Promise<{ state: string }> })?.query?.({ name: 'geolocation' });
      if (perm?.state === 'denied') {
        setState('blocked');
        return;
      }
    } catch {
      // ignorar, caer a estado blocked que mostrará botón
    }
    setState('blocked');
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestGps = () => {
    setRetrying(true);
    setError(null);
    if (!window.isSecureContext) {
      setState('insecure');
      setRetrying(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationConsent('granted');
        apiFetch('/locations', {
          method: 'POST',
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source,
          }),
        }).catch(() => undefined);
        setState('granted');
        setRetrying(false);
      },
      (err) => {
        setRetrying(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Permiso de ubicación denegado. Actívalo en Ajustes del navegador/sistema y vuelve a intentar.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('GPS no disponible. Enciende el GPS del teléfono e intenta de nuevo.');
        } else if (err.code === err.TIMEOUT) {
          setError('No se pudo obtener la ubicación a tiempo. Verifica que el GPS esté encendido y con señal.');
        } else {
          setError('No se pudo activar el GPS. Intenta de nuevo.');
        }
        setState('blocked');
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 },
    );
  };

  if (state === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Spinner />
        <p className="text-sm text-secondary">Verificando GPS…</p>
      </div>
    );
  }

  if (state === 'granted') return <>{children}</>;

  if (state === 'insecure') {
    return (
      <div className="mx-auto w-full max-w-md p-4">
        <Alert variant="error">
          La ubicación y la cámara requieren una conexión segura (HTTPS). Estás en <code>http://192.168.x.x</code> que el navegador bloquea por seguridad.
        </Alert>
        <div className="mt-4 rounded-xl bg-surface-container-lowest p-4 text-sm text-secondary">
          <p className="font-semibold text-primary">Para probar desde el celular por WiFi:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              En el celular abre <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>, añade <code>http://192.168.68.51</code> y reinicia Chrome, <em>o</em> usa <code>http://localhost</code> en la laptop.
            </li>
            <li>En producción (Fase 8) esto funciona directo con HTTPS.</li>
          </ol>
          <p className="mt-3 text-xs">Sin HTTPS el navegador bloquea `getUserMedia` (cámara/mic) y `geolocation` aunque el servidor esté arriba — es por eso que "no permite grabar" en los logs del 26/08.</p>
        </div>
        <Button type="button" className="mt-4 w-full" onClick={() => window.location.reload()}>
          Reintentar tras habilitar
        </Button>
      </div>
    );
  }

  if (state === 'unsupported') {
    return (
      <div className="mx-auto max-w-md p-4">
        <Alert variant="error">Este navegador no soporta geolocalización.</Alert>
      </div>
    );
  }

  // blocked
  return (
    <div className="mx-auto w-full max-w-md p-4">
      <Alert variant="warning">Necesitas activar el GPS para continuar. La app no se puede usar sin ubicación.</Alert>
      {error && <div className="mt-3"><Alert variant="error">{error}</Alert></div>}
      <p className="mt-3 text-sm text-secondary">Al tocar "Activar GPS" el navegador pedirá permiso. Acepta y asegúrate que el GPS del teléfono esté encendido.</p>
      <Button type="button" className="mt-4 w-full" loading={retrying} onClick={requestGps}>
        Activar GPS
      </Button>
      <p className="mt-3 text-xs text-secondary text-center">Si denegaste antes: Ajustes del sistema → Apps → Chrome → Permisos → Ubicación → Permitir, y Ajustes → Ubicación (GPS) encendido.</p>
    </div>
  );
}
