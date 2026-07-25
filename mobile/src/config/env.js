// Where the mobile app finds the backend.
//
// The web build talks to `/api` through the Vite dev proxy; a native app has no
// proxy and no same-origin, so it needs an absolute URL. Resolution order:
//
//   1. EXPO_PUBLIC_API_URL — set this for staging/production builds.
//   2. The LAN host Metro is already serving from (dev only). On a physical
//      device `localhost` is the phone itself, so we reuse the dev-server host
//      and swap in the backend port — this is what makes `npm start` work on a
//      real handset without hand-editing an IP.
//   3. localhost fallback — simulators only.

import Constants from 'expo-constants';

const DEV_BACKEND_PORT = 4000;

// e.g. "192.168.1.42:8081" while the Metro dev server is running.
function devServerHost() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  return hostUri ? hostUri.split(':')[0] : null;
}

function resolveBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (__DEV__) {
    const host = devServerHost();
    if (host) return `http://${host}:${DEV_BACKEND_PORT}`;
  }
  return `http://localhost:${DEV_BACKEND_PORT}`;
}

export const API_ORIGIN = resolveBaseUrl();
export const API_URL = `${API_ORIGIN}/api`;

// Socket.io connects to the origin, not the /api prefix.
export const SOCKET_URL = API_ORIGIN;
