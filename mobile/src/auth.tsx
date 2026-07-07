import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER } from './config';
import type { AuthUser } from './types';

WebBrowser.maybeCompleteAuthSession();

const REFRESH_KEY = 'kanflow_refresh_token';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

interface AuthState {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Current access token, refreshing if expired. Used by the API client. */
  getFreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Decode a JWT payload without verifying (server verifies; we only read claims). */
function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(
      decodeBase64Url(payload),
    ) as { sub: string; name?: string; email?: string; preferred_username?: string };
    return { sub: json.sub, name: json.name ?? json.preferred_username, email: json.email };
  } catch {
    return null;
  }
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  // atob exists in Hermes via global; fall back to Buffer-less manual decode.
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
  return globalThis.Buffer ? globalThis.Buffer.from(b64, 'base64').toString('utf8') : '';
}

export const redirectUri = AuthSession.makeRedirectUri({ scheme: 'kanflow', path: 'auth' });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const discovery = AuthSession.useAutoDiscovery(KEYCLOAK_ISSUER);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0); // epoch ms
  const [user, setUser] = useState<AuthUser | null>(null);

  const applyTokens = useCallback(async (res: AuthSession.TokenResponse) => {
    setToken(res.accessToken);
    setUser(decodeJwt(res.accessToken));
    setExpiresAt(Date.now() + (res.expiresIn ?? 300) * 1000);
    if (res.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, res.refreshToken);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (!discovery) return null;
    const stored = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!stored) return null;
    try {
      const res = await AuthSession.refreshAsync(
        { clientId: KEYCLOAK_CLIENT_ID, refreshToken: stored, scopes: SCOPES },
        discovery,
      );
      await applyTokens(res);
      return res.accessToken;
    } catch {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      setToken(null);
      setUser(null);
      return null;
    }
  }, [discovery, applyTokens]);

  // On boot, try to restore a session from the stored refresh token.
  useEffect(() => {
    if (!discovery) return;
    (async () => {
      await refresh();
      setReady(true);
    })();
  }, [discovery, refresh]);

  const signIn = useCallback(async () => {
    if (!discovery) throw new Error('Keycloak discovery not ready');
    const request = new AuthSession.AuthRequest({
      clientId: KEYCLOAK_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      usePKCE: true,
    });
    const result = await request.promptAsync(discovery);
    if (result.type !== 'success' || !result.params.code) {
      throw new Error(result.type === 'error' ? result.params.error_description ?? 'auth error' : 'cancelled');
    }
    const res = await AuthSession.exchangeCodeAsync(
      {
        clientId: KEYCLOAK_CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      discovery,
    );
    await applyTokens(res);
  }, [discovery, applyTokens]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    setToken(null);
    setUser(null);
    setExpiresAt(0);
  }, []);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    if (token && Date.now() < expiresAt - 15_000) return token;
    return refresh();
  }, [token, expiresAt, refresh]);

  const value = useMemo<AuthState>(
    () => ({ ready, token, user, signIn, signOut, getFreshToken }),
    [ready, token, user, signIn, signOut, getFreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
