// Refetch when a screen regains focus.
//
// Replaces the `useFocusEffect(load)` the screens used before React Query. The
// difference matters: `load` overwrote state unconditionally and blanked the
// list when the request failed, whereas `refetch` leaves the cached data in
// place on failure — and does not fire at all while offline, because queries
// are paused (see offline/queryClient.js).
//
// The first focus is skipped: it fires together with mount, where the query is
// already fetching, so refetching there is a duplicate request on every open.

import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export default function useRefreshOnFocus(refetch) {
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch?.();
    }, [refetch]),
  );
}
