// Connectivity, bridged into React Query.
//
// React Query's onlineManager defaults to browser `navigator.onLine` events,
// which do not exist in React Native — without this bridge it believes the app
// is permanently online and keeps firing requests into a dead radio. Wiring
// NetInfo into it is what turns "offline" into paused queries and cached data
// instead of a screen full of timeouts.

import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

// `isInternetReachable` is null while NetInfo is still probing. Treating that
// as offline would blank the app for a moment on every cold start, so only an
// explicit `false` (connected to a network that goes nowhere — captive portal,
// no data plan) counts as offline.
export function onlineFromNetInfoState(state) {
  if (!state) return false;
  return state.isConnected === true && state.isInternetReachable !== false;
}

export function startOnlineBridge(netInfo = NetInfo, manager = onlineManager) {
  manager.setEventListener((setOnline) =>
    netInfo.addEventListener((state) => setOnline(onlineFromNetInfoState(state))),
  );
  return () => manager.setEventListener(() => undefined);
}

export function useOnlineStatus(manager = onlineManager) {
  const [online, setOnline] = useState(() => manager.isOnline());
  useEffect(() => manager.subscribe(() => setOnline(manager.isOnline())), [manager]);
  return online;
}
