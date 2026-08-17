import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch, setAccessToken } from '../lib/api';
import { captureLocation } from '../lib/location';

export type Role = 'CLIENT' | 'COLLECTOR' | 'ADMIN';

export interface AuthUser {
  phone: string;
  email?: string | null;
  role: Role;
  mustChangePassword: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (phone: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ phone, password }) },
    );
    setAccessToken(res.accessToken);
    setUser(res.user);
    if (res.user.role === 'CLIENT') captureLocation('LOGIN');
    return res.user;
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  };

  const changePassword = async (current: string, next: string) => {
    const res = await apiFetch<{ accessToken: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setAccessToken(res.accessToken);
    setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
  };

  return (
    <Ctx.Provider value={{ user, loading, login, logout, changePassword }}>
      {children}
    </Ctx.Provider>
  );
}
