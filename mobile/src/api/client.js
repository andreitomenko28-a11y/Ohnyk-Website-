// HTTP client — mirrors frontend/src/api/client.js so both clients behave the
// same against the API (Bearer access token, one-shot refresh on 401, replay).
//
// Difference from web: the token store is injected rather than hard-wired to
// localStorage. Module 8.1 ships an in-memory store so the shell runs; Module
// 8.2 swaps in expo-secure-store without touching this file.
//
// The backend rotates refresh tokens (one-time use; reusing a spent token
// revokes the whole family), so the NEW refresh token from every /auth/refresh
// response must be persisted — dropping it logs the user out on the next call.

import axios from 'axios';
import { API_URL } from '../config/env.js';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

// --- token store ------------------------------------------------------------
// Replaced wholesale in Module 8.2 by a SecureStore-backed implementation.
let memory = { access: null, refresh: null };

export const tokenStore = {
  getAccess: () => memory.access,
  getRefresh: () => memory.refresh,
  async set(access, refresh) {
    if (access) memory.access = access;
    if (refresh) memory.refresh = refresh;
  },
  async clear() {
    memory = { access: null, refresh: null };
  },
};

// Lets Module 8.2 (and tests) provide a different persistence layer.
export function setTokenStore(impl) {
  Object.assign(tokenStore, impl);
}

// Called when refreshing fails for good, so the app can drop to the auth stack.
let onAuthFailure = () => {};
export function setAuthFailureHandler(fn) {
  onAuthFailure = typeof fn === 'function' ? fn : () => {};
}

// --- interceptors -----------------------------------------------------------
api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single in-flight refresh shared by all queued requests.
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const refreshToken = await tokenStore.getRefresh();

    const canRetry =
      status === 401 &&
      refreshToken &&
      original &&
      !original._retried &&
      !original.url?.includes('/auth/refresh');

    if (!canRetry) return Promise.reject(error);

    original._retried = true;
    try {
      refreshing = refreshing || api.post('/auth/refresh', { refreshToken });
      const { data } = await refreshing;
      refreshing = null;
      await tokenStore.set(data.accessToken, data.refreshToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (err) {
      refreshing = null;
      await tokenStore.clear();
      onAuthFailure();
      return Promise.reject(err);
    }
  },
);

// Extracts a friendly message from an axios error (same shape as the web helper).
export function apiError(err) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.details?.[0]?.message ||
    err?.message ||
    'Сталася помилка'
  );
}

export default api;
