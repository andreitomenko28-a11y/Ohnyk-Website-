// Background location task.
//
// Registered at module scope because TaskManager must know the task before the
// OS can wake the app into it — a task defined inside a component would not
// exist on a cold background launch.
//
// The task posts to REST rather than the socket: when the app is backgrounded
// the OS suspends the JS runtime, so a socket connection is gone and there is
// no time to re-establish one during the brief wake-up. The axios client also
// refreshes an expired access token for us, which a socket handshake would not.
//
// Which order to report against is written to AsyncStorage when tracking
// starts: the task is woken in a fresh context with no React state to read.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client.js';
import { toPositions } from './positions.js';

export const LOCATION_TASK = 'ohnyk-courier-location';
const ORDER_KEY = 'ohnyk_tracking_order';

export async function setTrackedOrder(orderId) {
  if (orderId) await AsyncStorage.setItem(ORDER_KEY, orderId);
  else await AsyncStorage.removeItem(ORDER_KEY);
}

export async function getTrackedOrder() {
  return AsyncStorage.getItem(ORDER_KEY);
}

// Re-exported so callers have one import for the task's surface; the shaping
// itself lives in positions.js, free of native imports.
export { toPositions };

// Posts a batch. Returns false when the server refuses the report (order
// finished or reassigned), which tells the caller to stop tracking.
export async function pushPositions(orderId, positions) {
  if (!orderId || positions.length === 0) return true;
  const { data } = await api.post('/courier/location', { orderId, positions });
  return data?.accepted !== false;
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;

  const orderId = await getTrackedOrder();
  if (!orderId) {
    // Nothing to report against — make sure the OS stops waking us.
    await stopTracking();
    return;
  }

  try {
    const accepted = await pushPositions(orderId, toPositions(data.locations));
    // The delivery is over (or was reassigned); stop draining the battery.
    if (!accepted) await stopTracking();
  } catch {
    // Offline or a transient failure: swallow it. The next wake-up carries a
    // fresh position anyway, and only the newest one matters server-side.
  }
});

// Foreground + background permission. Background is a separate, second prompt
// on both platforms and is the one users most often decline.
export async function requestTrackingPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return { granted: false, background: false };

  const background = await Location.requestBackgroundPermissionsAsync();
  return { granted: true, background: background.granted };
}

export async function isTracking() {
  return TaskManager.isTaskRegisteredAsync(LOCATION_TASK).then((registered) =>
    registered ? Location.hasStartedLocationUpdatesAsync(LOCATION_TASK) : false,
  );
}

export async function startTracking(orderId) {
  await setTrackedOrder(orderId);

  if (await isTracking()) return; // already running for this courier

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
    distanceInterval: 25,
    // Android requires a visible notification for background location; it also
    // makes the tracking honest to the courier.
    foregroundService: {
      notificationTitle: 'Ohnyk',
      notificationBody: 'Передаємо ваше місцезнаходження для активної доставки',
      notificationColor: '#ea6a2e',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopTracking() {
  await setTrackedOrder(null);
  if (await isTracking()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
