const BASE = '/api/v1';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let accessToken: string | null = localStorage.getItem('accessToken');

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

async function refreshTokens() {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new ApiError(401, 'Sesión expirada');
  const data = await res.json();
  setAccessToken(data.accessToken);
  return data;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const doFetch = (token?: string) =>
    fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

  let res = await doFetch(accessToken ?? undefined);
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const refreshed = await refreshTokens().catch(() => null);
    if (!refreshed) throw new ApiError(401, 'Sesión expirada');
    res = await doFetch(accessToken ?? undefined);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? 'Error de servidor');
  }
  return res.json() as Promise<T>;
}
