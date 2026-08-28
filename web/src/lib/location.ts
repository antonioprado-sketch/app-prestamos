import { apiFetch } from './api';

export type LocationSource = 'ONBOARDING' | 'LOGIN' | 'PAYMENT' | 'REQUEST';
export type LocationConsent = 'granted' | 'declined';

const CONSENT_KEY = 'locationConsent';

export function getLocationConsent(): LocationConsent | null {
  const value = localStorage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'declined' ? value : null;
}

export function setLocationConsent(value: LocationConsent) {
  localStorage.setItem(CONSENT_KEY, value);
}

/** Captura la ubicación una sola vez y la envía al backend. Nunca bloquea ni reporta error al usuario — es opcional. */
export function captureLocation(source: LocationSource) {
  if (getLocationConsent() !== 'granted') return;
  if (!('geolocation' in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      apiFetch('/locations', {
        method: 'POST',
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source,
        }),
      }).catch(() => undefined);
    },
    () => undefined,
    { timeout: 10000, maximumAge: 5 * 60 * 1000 },
  );
}

export type GpsStatus = 'granted' | 'blocked' | 'insecure' | 'unsupported' | 'timeout' | 'unavailable';

export function ensureGpsGranted(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.isSecureContext === false) {
      reject('insecure' as GpsStatus);
      return;
    }
    if (!('geolocation' in navigator) || typeof navigator.geolocation.getCurrentPosition !== 'function') {
      reject('unsupported' as GpsStatus);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationConsent('granted');
        // Enviar una captura inmediata para que el backend tenga el punto
        apiFetch('/locations', {
          method: 'POST',
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'LOGIN' as LocationSource,
          }),
        }).catch(() => undefined);
        resolve();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject('blocked' as GpsStatus);
        else if (err.code === err.POSITION_UNAVAILABLE) reject('unavailable' as GpsStatus);
        else if (err.code === err.TIMEOUT) reject('timeout' as GpsStatus);
        else reject('blocked' as GpsStatus);
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 },
    );
  });
}
