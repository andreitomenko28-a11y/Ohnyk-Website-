// Persistent token storage backed by expo-secure-store (Keychain on iOS,
// EncryptedSharedPreferences on Android).
//
// Why not AsyncStorage: refresh tokens are long-lived credentials, and
// AsyncStorage is plain unencrypted files readable on a rooted/jailbroken
// device or via a device backup. SecureStore is the native keystore.
//
// SecureStore has no web implementation, so the module falls back to an
// in-memory map when it isn't available (`expo start --web`, and the jest
// environment). Tokens then simply don't survive a reload, which is correct
// for those non-production targets.

import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'ohnyk_access';
const REFRESH_KEY = 'ohnyk_refresh';

let available = null; // resolved once, then cached
const memory = new Map();

async function isAvailable() {
  if (available === null) {
    try {
      available = await SecureStore.isAvailableAsync();
    } catch {
      available = false;
    }
  }
  return available;
}

async function read(key) {
  if (await isAvailable()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null; // corrupted/undecryptable entry — treat as logged out
    }
  }
  return memory.get(key) ?? null;
}

async function write(key, value) {
  if (await isAvailable()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  memory.set(key, value);
}

async function remove(key) {
  if (await isAvailable()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  memory.delete(key);
}

// Implements the interface consumed by api/client.js (see setTokenStore).
export const secureTokenStore = {
  getAccess: () => read(ACCESS_KEY),
  getRefresh: () => read(REFRESH_KEY),
  async set(access, refresh) {
    // Written in parallel; a rotation always supplies both.
    await Promise.all([
      access ? write(ACCESS_KEY, access) : Promise.resolve(),
      refresh ? write(REFRESH_KEY, refresh) : Promise.resolve(),
    ]);
  },
  async clear() {
    await Promise.all([remove(ACCESS_KEY), remove(REFRESH_KEY)]);
  },
};

// Test seam.
export const __keys = { ACCESS_KEY, REFRESH_KEY };
