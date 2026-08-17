import type { CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(): CookieOptions {
  const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: days * 86400000,
  };
}

export function clearRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}
