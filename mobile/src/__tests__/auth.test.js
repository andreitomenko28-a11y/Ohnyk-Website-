// Module 8.2 — auth payloads, secure token storage, and the session lifecycle.

import { buildRegisterPayload, ROLES, TRANSPORTS } from '../auth/registerPayload.js';

describe('register payload (server schema is .strict())', () => {
  const base = {
    fullName: '  Андрій  ',
    email: ' a@b.com ',
    phone: '',
    password: 'password123',
    kitchenAddress: '',
    deliveryZone: '',
    bio: '',
    transport: 'BICYCLE',
  };

  it('sends only the shared fields for a customer', () => {
    expect(buildRegisterPayload(base, 'CUSTOMER')).toEqual({
      fullName: 'Андрій',
      email: 'a@b.com',
      password: 'password123',
      role: 'CUSTOMER',
    });
  });

  it('omits empty optional strings rather than sending ""', () => {
    // '' would fail min-length validation on the server for cook fields.
    const payload = buildRegisterPayload(base, 'COOK');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('kitchenAddress');
    expect(payload).not.toHaveProperty('deliveryZone');
    expect(payload).not.toHaveProperty('bio');
  });

  it('never leaks another role’s fields', () => {
    const cook = buildRegisterPayload(
      { ...base, kitchenAddress: 'вул. Тестова, 1', transport: 'CAR' },
      'COOK',
    );
    expect(cook.kitchenAddress).toBe('вул. Тестова, 1');
    expect(cook).not.toHaveProperty('transport'); // courier-only

    const courier = buildRegisterPayload({ ...base, kitchenAddress: 'вул. Тестова, 1' }, 'COURIER');
    expect(courier.transport).toBe('BICYCLE');
    expect(courier).not.toHaveProperty('kitchenAddress'); // cook-only
  });

  it('includes a phone when the user typed one', () => {
    expect(buildRegisterPayload({ ...base, phone: ' +380631112233 ' }, 'CUSTOMER').phone).toBe(
      '+380631112233',
    );
  });

  it('only ever emits keys the server schema declares', () => {
    const ALLOWED = new Set([
      'fullName', 'email', 'phone', 'password', 'role',
      'displayName', 'bio', 'kitchenAddress', 'deliveryZone', 'transport',
    ]);
    for (const role of ROLES) {
      const filled = { ...base, phone: '+380631112233', kitchenAddress: 'a street', deliveryZone: 'centre', bio: 'hi' };
      for (const key of Object.keys(buildRegisterPayload(filled, role))) {
        expect(ALLOWED.has(key)).toBe(true);
      }
    }
  });

  it('offers the transports the server enum accepts', () => {
    expect(TRANSPORTS).toEqual(['WALKING', 'BICYCLE', 'MOTORBIKE', 'CAR']);
  });
});

describe('secure token storage', () => {
  let store;
  let SecureStore;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('expo-secure-store', () => {
      const mem = new Map();
      return {
        isAvailableAsync: jest.fn(async () => true),
        getItemAsync: jest.fn(async (k) => (mem.has(k) ? mem.get(k) : null)),
        setItemAsync: jest.fn(async (k, v) => void mem.set(k, v)),
        deleteItemAsync: jest.fn(async (k) => void mem.delete(k)),
      };
    });
    SecureStore = require('expo-secure-store');
    store = require('../auth/tokenStorage.js').secureTokenStore;
  });

  afterEach(() => jest.dontMock('expo-secure-store'));

  it('round-trips both tokens through SecureStore', async () => {
    await store.set('access-1', 'refresh-1');
    expect(await store.getAccess()).toBe('access-1');
    expect(await store.getRefresh()).toBe('refresh-1');
    // Credentials must go to the keystore, never plain storage.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ohnyk_access', 'access-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ohnyk_refresh', 'refresh-1');
  });

  it('clears both tokens on logout', async () => {
    await store.set('a', 'r');
    await store.clear();
    expect(await store.getAccess()).toBeNull();
    expect(await store.getRefresh()).toBeNull();
  });

  it('treats an undecryptable entry as logged out instead of throwing', async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('decrypt failed'));
    await expect(store.getAccess()).resolves.toBeNull();
  });

  it('falls back to memory where SecureStore is unavailable (web)', async () => {
    jest.resetModules();
    jest.doMock('expo-secure-store', () => ({
      isAvailableAsync: jest.fn(async () => false),
      getItemAsync: jest.fn(),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    }));
    const webStore = require('../auth/tokenStorage.js').secureTokenStore;
    const unavailable = require('expo-secure-store');

    await webStore.set('a', 'r');
    expect(await webStore.getAccess()).toBe('a');
    expect(unavailable.setItemAsync).not.toHaveBeenCalled();
  });
});
