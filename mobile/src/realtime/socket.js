// Shared socket.io connection, mirroring frontend/src/lib/socket.js.
//
// One difference that matters: the web reads its access token synchronously
// from localStorage, but here it lives in SecureStore behind an async call.
// socket.io's callback form of `auth` allows that — the callback is invoked on
// every (re)connect, so a rotated token is picked up automatically instead of
// the socket reconnecting with a stale one.

import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/env.js';
import { tokenStore } from '../api/client.js';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      // Long-polling adds nothing on a device and reconnects worse on flaky
      // mobile networks.
      transports: ['websocket'],
      auth: (cb) => {
        Promise.resolve(tokenStore.getAccess())
          .then((token) => cb({ token }))
          .catch(() => cb({}));
      },
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
