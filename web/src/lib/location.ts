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
