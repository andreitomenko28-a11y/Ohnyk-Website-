// Expo push registration.
//
// The token is registered with our backend after login and dropped on logout,
// so whoever uses the handset next does not receive the previous account's
// notifications. That mirrors what logout already does to the refresh-token
// family and the socket.
//
// Push only works on a real device — a simulator has no push service to issue
// a token, so the whole flow is skipped there rather than failing loudly.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '../api/client.js';

// A notification arriving while the app is open should still be visible: the
// in-app centre updates over the socket, but a banner is what the user expects.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android needs an explicit channel or notifications arrive silently.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Ohnyk',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#ea6a2e',
  });
}

// EAS injects the project id at build time; getExpoPushTokenAsync needs it.
function projectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

// Returns the Expo push token, or null when push is unavailable (simulator,
// permission declined, or no project id in a bare dev build).
export async function obtainPushToken() {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  await ensureAndroidChannel();

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    return data ?? null;
  } catch {
    // Missing project id or a push service hiccup — not worth failing login over.
    return null;
  }
}

export async function registerForPush() {
  const token = await obtainPushToken();
  if (!token) return null;
  await api.post('/notifications/device', {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  return token;
}

// Best-effort: never block logout on it, and never leave the user signed in
// because the network was down.
export async function unregisterFromPush() {
  const token = await obtainPushToken().catch(() => null);
  if (!token) return;
  await api.delete('/notifications/device', { data: { token } }).catch(() => {});
}
