// Navigates when a notification is tapped.
//
// Two entry points matter and are easy to conflate: a tap while the app is
// running (the listener), and a tap that launched the app from cold
// (getLastNotificationResponseAsync). Handling only the first leaves the most
// common case — tapping a push on a locked phone — doing nothing.

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { isTrackTarget, targetForNotification } from './deepLink.js';

export default function useNotificationNavigation(navigationRef, { ready = true } = {}) {
  const handledCold = useRef(false);

  useEffect(() => {
    if (!ready) return undefined;

    const go = (response) => {
      const target = targetForNotification(response?.notification?.request?.content?.data ?? {});
      if (!target || !navigationRef?.current?.isReady()) return;

      if (isTrackTarget(target)) {
        navigationRef.current.navigate(target.tab, { screen: target.screen, params: target.params });
      } else {
        navigationRef.current.navigate(target.tab);
      }
    };

    // A tap that launched the app from cold — delivered once, not through the
    // listener, so it needs its own read.
    if (!handledCold.current) {
      handledCold.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) go(response);
        })
        .catch(() => {});
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(go);
    return () => subscription.remove();
  }, [navigationRef, ready]);
}
