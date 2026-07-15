import { io } from 'socket.io-client';
import { tokenStore } from '../api/client.js';

// Backend origin for the realtime channel. In dev it's the API on :4000; in
// production set VITE_SOCKET_URL to the deployed backend origin.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

let socket = null;

// Lazily create + connect a single shared socket, authenticated with the
// current access token (re-read on every (re)connect).
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket'],
      auth: (cb) => cb({ token: tokenStore.getAccess() }),
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
}
