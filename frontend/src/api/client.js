import axios from 'axios';

// Base URL: uses Vite proxy in dev (/api), overridable via env for prod.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

const ACCESS_KEY = 'ohnyk_access';
const REFRESH_KEY = 'ohnyk_refresh';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// Attach access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try a one-time refresh then replay the original request.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const refreshToken = tokenStore.getRefresh();

    if (
      error.response?.status === 401 &&
      refreshToken &&
      !original._retried &&
      !original.url.includes('/auth/refresh')
    ) {
      original._retried = true;
      try {
        refreshing =
          refreshing || api.post('/auth/refresh', { refreshToken });
        const { data } = await refreshing;
        refreshing = null;
        tokenStore.set(data.accessToken, data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        tokenStore.clear();
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

// Extracts a friendly message from an axios error.
export function apiError(err) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.details?.[0]?.message ||
    err?.message ||
    'Сталася помилка'
  );
}

export default api;
