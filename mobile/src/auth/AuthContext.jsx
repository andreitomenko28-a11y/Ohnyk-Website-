// Auth state for the navigation shell.
//
// MODULE 8.1 SCOPE: this holds the session in memory only and exposes a
// `devSignInAs(role)` helper so every role's navigator can be exercised before
// the real login screens exist. Module 8.2 replaces the body of this file with
// real /auth/login + /auth/register calls and SecureStore persistence; the
// context's public shape ({ user, loading, login, logout }) stays the same so
// the navigators don't change.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { setAuthFailureHandler, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export const ROLES = ['CUSTOMER', 'COOK', 'COURIER'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Module 8.2 flips this to `true` initially while the stored session is read.
  const [loading] = useState(false);

  const logout = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
  }, []);

  // Drop to the auth stack when a refresh finally fails.
  setAuthFailureHandler(() => setUser(null));

  // TEMPORARY (8.1): fake a session so the role-based navigators are reachable.
  const devSignInAs = useCallback((role) => {
    setUser({ id: `dev-${role}`, role, fullName: 'Dev', email: `${role}@dev.local` });
  }, []);

  const value = useMemo(
    () => ({ user, loading, logout, devSignInAs }),
    [user, loading, logout, devSignInAs],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
