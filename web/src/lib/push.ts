import { apiFetch } from './api';

const PUSH_CONSENT_KEY = 'pushConsent';

export type PushConsent = 'granted' | 'declined';

export function getPushConsent(): PushConsent | null {
  const value = localStorage.getItem(PUSH_CONSENT_KEY);
  return value === 'granted' || value === 'declined' ? value : null;
}

export function setPushConsent(value: PushConsent) {
  localStorage.setItem(PUSH_CONSENT_KEY, value);
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes.buffer;
}

/** Suscribe al navegador a Web Push y registra la suscripción en el backend. Nunca bloquea ni reporta error — sin soporte, permiso denegado o falla de red se ignoran en silencio. */
export async function subscribeToPush(): Promise<void> {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!publicKey) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = subscription.toJSON();
    await apiFetch('/notifications/webpush-subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
  } catch {
    // opcional — no bloquea el resto de la app
  }
}
