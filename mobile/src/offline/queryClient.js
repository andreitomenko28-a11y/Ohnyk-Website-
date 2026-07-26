// Offline cache — a QueryClient whose cache is mirrored into AsyncStorage.
//
// The point of this module is that a screen shown once keeps rendering after
// the connection drops: the list comes from the cache, not from the request.
//
// Three settings carry that behaviour and are easy to get wrong:
//
// 1. `gcTime` must be at least `PERSIST_MAX_AGE`. Restoring writes the cached
//    entries into a fresh cache; anything whose gcTime has passed is collected
//    moments later, so a shorter gcTime silently throws the restore away.
// 2. Queries keep the default `networkMode: 'online'` — while offline they go
//    to `paused` instead of firing a request that cannot succeed. Cached data
//    stays on screen, and `isLoading` is false, so screens do not spin forever.
// 3. Mutations use `networkMode: 'always'`. There is no offline write queue —
//    the server owns every business rule — so a tap must fail fast with a real
//    error rather than hang pending until the network returns.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const PERSIST_KEY = 'ohnyk.query-cache';

// Older than this and the whole persisted cache is dropped on restore. A day
// is the line for a food marketplace: yesterday's menu is worth showing when
// offline, last week's prices are not.
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

// Bump when a cached payload shape changes in a way hydration cannot survive.
export const PERSIST_BUSTER = 'v1';

// Retrying a 4xx is pointless: the client already refreshes once on 401, and
// 400/403/404 will answer the same on every attempt.
export function shouldRetryQuery(failureCount, error) {
  const status = error?.response?.status;
  if (status >= 400 && status < 500) return false;
  return failureCount < 2;
}

// Only successful queries are written out. Persisting an error would restore a
// failure the user cannot retry away, and pending entries hold nothing useful.
export function shouldDehydrateQuery(query) {
  return query?.state?.status === 'success';
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: PERSIST_MAX_AGE,
        retry: shouldRetryQuery,
        // The app has no window focus event; refetching is driven by screen
        // focus (useRefreshOnFocus) and by reconnect.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: 'always',
        retry: 0,
      },
    },
  });
}

export const queryClient = createQueryClient();

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  // The cache is rewritten on every query settle; throttling keeps a scrolling
  // list from hammering the disk.
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery,
    // Nothing about a mutation is worth replaying later (see the note above).
    shouldDehydrateMutation: () => false,
  },
};

// Called on logout and on a final refresh failure.
//
// AsyncStorage is not encrypted, and the cache holds the account's orders and
// delivery addresses — leaving it behind would show the previous user's data
// to whoever logs in next on the same handset. (Tokens are never in here; they
// live in SecureStore.)
//
// A throttled save may still land after removeClient(); by then the cache is
// empty, so the worst case is an empty record on disk.
export async function clearOfflineCache(client = queryClient) {
  client.clear();
  await persister.removeClient();
}
