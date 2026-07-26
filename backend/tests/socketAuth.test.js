import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import { request, registerUser, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { createApp } from '../src/app.js';
import { initRealtime } from '../src/realtime/index.js';

// The realtime channel used to ignore moderation entirely: the handshake
// verified the JWT and nothing else, so a blocked account kept a working socket
// while every REST call answered 403.

let httpServer;
let url;

beforeAll(async () => {
  httpServer = createServer(createApp());
  initRealtime(httpServer, '*');
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${httpServer.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
});

// Resolves { ok } — connected, or refused with the server's reason.
function open(token) {
  return new Promise((resolve) => {
    const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
    const done = (result) => {
      clearTimeout(timer);
      resolve({ ...result, socket });
    };
    const timer = setTimeout(() => done({ ok: false, error: 'timeout' }), 4000);
    socket.on('connect', () => done({ ok: true }));
    socket.on('connect_error', (err) => done({ ok: false, error: err.message }));
  });
}

// Resolves true if the socket goes down within the window.
function awaitDisconnect(socket, ms = 3000) {
  return new Promise((resolve) => {
    if (!socket.connected) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms);
    socket.on('disconnect', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function admin() {
  const user = await registerUser({ role: 'CUSTOMER' });
  await prisma.user.update({ where: { id: user.user.id }, data: { role: 'ADMIN' } });
  const login = await request
    .post('/api/auth/login')
    .send({ identifier: user.user.email, password: user.password });
  return login.body.accessToken;
}

describe('Socket handshake enforces moderation', () => {
  it('lets an ordinary account connect', async () => {
    const user = await registerUser({ role: 'CUSTOMER' });
    const conn = await open(user.accessToken);
    expect(conn.ok).toBe(true);
    conn.socket.close();
  });

  it('refuses a new connection from a blocked account', async () => {
    const adminToken = await admin();
    const victim = await registerUser({ role: 'CUSTOMER' });
    await request
      .patch(`/api/admin/users/${victim.user.id}/block`)
      .set(authHeader(adminToken))
      .send({ reason: 'test' });

    // The access token is still cryptographically valid — that is the point.
    const conn = await open(victim.accessToken);
    expect(conn.ok).toBe(false);
    expect(conn.error).toBe('blocked');
    conn.socket.close();
  });

  it('drops a socket that was already open when the block landed', async () => {
    const adminToken = await admin();
    const victim = await registerUser({ role: 'CUSTOMER' });

    const conn = await open(victim.accessToken);
    expect(conn.ok).toBe(true);

    await request
      .patch(`/api/admin/users/${victim.user.id}/block`)
      .set(authHeader(adminToken))
      .send({ reason: 'test' });

    // Guarding only the handshake would leave this socket alive, still
    // receiving chat messages and notifications.
    expect(await awaitDisconnect(conn.socket)).toBe(true);
    conn.socket.close();
  });

  it('refuses a connection with no token at all', async () => {
    const conn = await open(undefined);
    expect(conn.ok).toBe(false);
    expect(conn.error).toBe('unauthorized');
    conn.socket.close();
  });

  it('lets the account back in once unblocked', async () => {
    const adminToken = await admin();
    const victim = await registerUser({ role: 'CUSTOMER' });
    await request.patch(`/api/admin/users/${victim.user.id}/block`).set(authHeader(adminToken)).send({});
    await request.patch(`/api/admin/users/${victim.user.id}/unblock`).set(authHeader(adminToken));

    const conn = await open(victim.accessToken);
    expect(conn.ok).toBe(true);
    conn.socket.close();
  });
});
