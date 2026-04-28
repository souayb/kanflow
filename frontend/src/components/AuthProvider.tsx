/**
 * AuthProvider — initialises Keycloak, handles redirect-login, refreshes tokens.
 * Renders a branded loading screen while KC bootstraps.
 * Exposes `useAuth()` so any component can call `logout()` or read `kcUser`.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Kanban } from 'lucide-react';
import keycloak from '../lib/keycloak';
import { setTokenGetter } from '../lib/api';
import type { User } from '../types';

// ── Auth context ──────────────────────────────────────────────────────────

interface AuthContextValue {
  authenticated: boolean;
  kcUser: User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  authenticated: false,
  kcUser: null,
  logout: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function kcUserFromToken(): User | null {
  const p = keycloak.tokenParsed as Record<string, any> | undefined;
  if (!p) return null;
  const roles: string[] = p['realm_access']?.roles ?? [];
  return {
    id: p['sub'] ?? 'kc-user',
    name: p['name'] ?? p['preferred_username'] ?? 'User',
    email: p['email'] ?? '',
    role: roles.includes('admin') ? 'Admin' : 'Member',
  };
}

// ── Loading screen ────────────────────────────────────────────────────────

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-[#F5F5F0]">
      <div className="text-center">
        <div className="w-14 h-14 rounded-[16px] bg-[#0064E0] flex items-center justify-center mx-auto mb-5 animate-pulse shadow-lg">
          <Kanban className="w-7 h-7 text-white" strokeWidth={2} />
        </div>
        <p className="text-[#5D6C7B] text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [kcUser, setKcUser] = useState<User | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Register token getter so api.ts can attach Bearer headers
    setTokenGetter(() => keycloak.token);

    keycloak
      .init({
        onLoad: 'login-required',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      })
      .then((authenticated) => {
        if (authenticated) {
          setKcUser(kcUserFromToken());

          // Refresh token 60 s before it expires, every 30 s
          refreshIntervalRef.current = setInterval(() => {
            keycloak
              .updateToken(60)
              .then((refreshed) => {
                if (refreshed) setKcUser(kcUserFromToken());
              })
              .catch(() => keycloak.logout());
          }, 30_000);
        }
        setStatus('ok');
      })
      .catch(() => setStatus('error'));

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  const logout = () =>
    keycloak.logout({ redirectUri: window.location.origin });

  if (status === 'loading') {
    return <LoadingScreen message="Connecting to Keycloak…" />;
  }
  if (status === 'error') {
    return <LoadingScreen message="Could not reach the identity provider. Check your Keycloak configuration." />;
  }

  return (
    <AuthContext.Provider value={{ authenticated: !!kcUser, kcUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
