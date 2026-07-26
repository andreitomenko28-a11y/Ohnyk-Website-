import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { request, registerUser, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { collectDeadTokens, pushEnabled, sendPush } from '../src/lib/push.js';
import { createNotification } from '../src/lib/notify.js';

// Phase 8.7 — push device registration and delivery.

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

const registerDevice = (token, body) =>
  request.post('/api/notifications/device').set(authHeader(token)).send(body);

describe('POST /api/notifications/device', () => {
  it('registers a device for the caller', async () => {
    const user = await registerUser();
    const res = await registerDevice(user.accessToken, { token: TOKEN_A, platform: 'ios' });
    expect(res.status).toBe(204);

    const stored = await prisma.deviceToken.findUnique({ where: { token: TOKEN_A } });
    expect(stored.userId).toBe(user.user.id);
    expect(stored.platform).toBe('ios');
  });

  it('is idempotent — re-registering the same device does not duplicate it', async () => {
    const user = await registerUser();
    await registerDevice(user.accessToken, { token: TOKEN_A, platform: 'ios' });
    await registerDevice(user.accessToken, { token: TOKEN_A, platform: 'ios' });

    expect(await prisma.deviceToken.count({ where: { token: TOKEN_A } })).toBe(1);
  });

  it('moves the device to the new user when another account signs in on it', async () => {
    const first = await registerUser();
    const second = await registerUser();
    await registerDevice(first.accessToken, { token: TOKEN_A, platform: 'android' });
    await registerDevice(second.accessToken, { token: TOKEN_A, platform: 'android' });

    // Not duplicated, and the previous owner must no longer be a target —
    // otherwise they keep receiving the new user's notifications.
    expect(await prisma.deviceToken.count({ where: { token: TOKEN_A } })).toBe(1);
    const stored = await prisma.deviceToken.findUnique({ where: { token: TOKEN_A } });
    expect(stored.userId).toBe(second.user.id);
    expect(await prisma.deviceToken.count({ where: { userId: first.user.id } })).toBe(0);
  });

  it('keeps several devices for one user', async () => {
    const user = await registerUser();
    await registerDevice(user.accessToken, { token: TOKEN_A, platform: 'ios' });
    await registerDevice(user.accessToken, { token: TOKEN_B, platform: 'android' });

    expect(await prisma.deviceToken.count({ where: { userId: user.user.id } })).toBe(2);
  });

  it('rejects malformed bodies (schema is strict)', async () => {
    const user = await registerUser();
    expect((await registerDevice(user.accessToken, { token: 'short', platform: 'ios' })).status).toBe(400);
    expect((await registerDevice(user.accessToken, { token: TOKEN_A, platform: 'web' })).status).toBe(400);
    // An undeclared key fails the whole request.
    expect(
      (await registerDevice(user.accessToken, { token: TOKEN_A, platform: 'ios', extra: 1 })).status,
    ).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request.post('/api/notifications/device').send({ token: TOKEN_A, platform: 'ios' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/notifications/device', () => {
  it('drops the caller\'s device on logout', async () => {
    const user = await registerUser();
    await registerDevice(user.accessToken, { token: TOKEN_A, platform: 'ios' });

    const res = await request
      .delete('/api/notifications/device')
      .set(authHeader(user.accessToken))
      .send({ token: TOKEN_A });

    expect(res.status).toBe(204);
    expect(await prisma.deviceToken.findUnique({ where: { token: TOKEN_A } })).toBeNull();
  });

  it('leaves a token belonging to somebody else alone', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await registerDevice(owner.accessToken, { token: TOKEN_A, platform: 'ios' });

    await request
      .delete('/api/notifications/device')
      .set(authHeader(other.accessToken))
      .send({ token: TOKEN_A });

    expect(await prisma.deviceToken.findUnique({ where: { token: TOKEN_A } })).not.toBeNull();
  });
});

describe('sendPush', () => {
  const originalFlag = process.env.EXPO_PUSH_ENABLED;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.EXPO_PUSH_ENABLED;
    else process.env.EXPO_PUSH_ENABLED = originalFlag;
    vi.restoreAllMocks();
  });

  it('stays off the network unless explicitly enabled', async () => {
    delete process.env.EXPO_PUSH_ENABLED;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(pushEnabled()).toBe(false);
    const res = await sendPush([TOKEN_A], { title: 'Hi' });

    expect(res.channel).toBe('stub');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does nothing at all without targets', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await sendPush([], { title: 'Hi' })).channel).toBe('none');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('prunes tokens Expo reports as DeviceNotRegistered', async () => {
    const user = await registerUser();
    await prisma.deviceToken.create({ data: { token: TOKEN_A, platform: 'ios', userId: user.user.id } });
    await prisma.deviceToken.create({ data: { token: TOKEN_B, platform: 'ios', userId: user.user.id } });

    process.env.EXPO_PUSH_ENABLED = 'true';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'ok' },
          { status: 'error', details: { error: 'DeviceNotRegistered', expoPushToken: TOKEN_B } },
        ],
      }),
    });

    const res = await sendPush([TOKEN_A, TOKEN_B], { title: 'Hi' });

    // A dead token never delivers again, so keeping it would cost a request
    // on every future send forever.
    expect(res.pruned).toBe(1);
    expect(await prisma.deviceToken.findUnique({ where: { token: TOKEN_B } })).toBeNull();
    expect(await prisma.deviceToken.findUnique({ where: { token: TOKEN_A } })).not.toBeNull();
  });
});

describe('collectDeadTokens', () => {
  it('picks out only DeviceNotRegistered tickets', () => {
    const response = {
      data: [
        { status: 'ok' },
        { status: 'error', details: { error: 'MessageTooBig' } },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ],
    };
    expect(collectDeadTokens(response, ['a-token', 'b-token', 'c-token'])).toEqual(['c-token']);
  });

  it('survives a malformed response', () => {
    expect(collectDeadTokens(null, ['a'])).toEqual([]);
    expect(collectDeadTokens({}, ['a'])).toEqual([]);
  });
});

describe('notifications reach registered devices', () => {
  beforeEach(() => {
    process.env.EXPO_PUSH_ENABLED = 'true';
  });
  afterEach(() => {
    delete process.env.EXPO_PUSH_ENABLED;
    vi.restoreAllMocks();
  });

  it('pushes to every device of the recipient, with deep-link data', async () => {
    const user = await registerUser();
    await prisma.deviceToken.create({ data: { token: TOKEN_A, platform: 'ios', userId: user.user.id } });
    await prisma.deviceToken.create({ data: { token: TOKEN_B, platform: 'android', userId: user.user.id } });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ status: 'ok' }, { status: 'ok' }] }) });

    await createNotification({
      userId: user.user.id,
      type: 'ORDER_STATUS',
      payload: { title: 'Замовлення готове', body: 'Кухар завершив', orderId: 'order-1' },
    });

    // The push is fire-and-forget, so let the microtask queue drain.
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toHaveLength(2);
    expect(body.map((m) => m.to).sort()).toEqual([TOKEN_A, TOKEN_B].sort());
    expect(body[0].title).toBe('Замовлення готове');
    // Enough for the app to open the right screen from a cold tap.
    expect(body[0].data).toMatchObject({ type: 'ORDER_STATUS', orderId: 'order-1' });
  });

  it('still persists and delivers in-app when push fails', async () => {
    const user = await registerUser();
    await prisma.deviceToken.create({ data: { token: TOKEN_A, platform: 'ios', userId: user.user.id } });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('expo down'));

    const n = await createNotification({
      userId: user.user.id,
      type: 'NEW_ORDER',
      payload: { title: 'Нове замовлення' },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(n).not.toBeNull();
    expect(await prisma.notification.findUnique({ where: { id: n.id } })).not.toBeNull();
  });
});
