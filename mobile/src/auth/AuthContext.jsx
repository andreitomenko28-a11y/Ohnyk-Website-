// Session state: login, registration, autologin and logout.
//
// Tokens live in SecureStore (see tokenStorage.js) and are wired into the HTTP
// client at module load, so every request — including the very first one during
// autologin — carries the stored access token and can transparently refresh.
//
// Autologin deliberately calls GET /auth/me instead of trusting the stored
// token: the backend checks `isBlocked` on every request, so a user blocked by
// an admin while the app was closed must not walk back into a session. A 401
// there triggers the client's refresh-and-retry; if that also fails, the
// tokens are cleared and the user lands on the auth stack.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { apiError, setAuthFailureHandler, setTokenStore } from '../api/client.js';
import { secureTokenStore } from './tokenStorage.js';

// Persist tokens securely from here on (replaces the in-memory default).
setTokenStore(secureTokenStore);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until autologin settles

  // Drop to the auth stack when a refresh finally fails (expired or revoked
  // session, or a token family revoked by reuse detection).
  useEffect(() => {
    setAuthFailureHandler(() => setUser(null));
  }, []);

  // Autologin on cold start.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await secureTokenStore.getAccess();
        if (!stored) return; // never logged in — go straight to the auth stack
        const { data } = await api.get('/auth/me');
        if (active) setUser(data.user);
      } catch {
        // Refresh already ran and failed inside the client; make sure nothing
        // stale is left behind.
        await secureTokenStore.clear();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Shared tail of login/register: persist the pair, then adopt the session.
  const adoptSession = useCallback(async (data) => {
    await secureTokenStore.set(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (identifier, password) => {
      const { data } = await api.post('/auth/login', { identifier, password });
      return adoptSession(data);
    },
    [adoptSession],
  );

  const register = useCallback(
    async (payload) => {
      // NOTE: registerSchema is .strict() server-side — sending a field it
      // doesn't declare fails the whole request, so callers must pass only
      // the keys for the chosen role (see buildRegisterPayload).
      const { data } = await api.post('/auth/register', payload);
      return adoptSession(data);
    },
    [adoptSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = await secureTokenStore.getRefresh();
    // Best-effort server-side revocation of the token family; never block the
    // UI on it (the user may well be offline).
    if (refreshToken) api.post('/auth/logout', { refreshToken }).catch(() => {});
    await secureTokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { apiError };
