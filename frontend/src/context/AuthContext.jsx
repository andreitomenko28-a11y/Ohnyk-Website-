import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session from a stored token.
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!tokenStore.getAccess()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (active) setUser(data.user);
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const handleAuth = useCallback((data) => {
    tokenStore.set(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (identifier, password) => {
      const { data } = await api.post('/auth/login', { identifier, password });
      return handleAuth(data);
    },
    [handleAuth]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload);
      return handleAuth(data);
    },
    [handleAuth]
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Add/remove a cook from the current user's favourites.
  const toggleFavorite = useCallback(
    async (cookId) => {
      const isFav = user?.favoriteCookIds?.includes(cookId);
      const { data } = isFav
        ? await api.delete(`/users/favorites/${cookId}`)
        : await api.put(`/users/favorites/${cookId}`);
      setUser(data.user);
      return data.user;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser, toggleFavorite }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
