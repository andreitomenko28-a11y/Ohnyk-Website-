// Module 8.8 — offline cache.
//
// The interesting cases are the ones a manual smoke test on a good connection
// never reaches: what the app shows with the radio off, what it refuses to
// leave on disk, and the two settings whose defaults quietly break persistence.

import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider, onlineManager, useQuery } from '@tanstack/react-query';

import {
  PERSIST_KEY,
  PERSIST_MAX_AGE,
  clearOfflineCache,
  createQueryClient,
  persistOptions,
  shouldDehydrateQuery,
  shouldRetryQuery,
} from '../offline/queryClient.js';
import { onlineFromNetInfoState, startOnlineBridge, useOnlineStatus } from '../offline/online.js';
import { LANG_KEY, isSupportedLang, loadLang, saveLang } from '../offline/lang.js';
import { qk } from '../offline/queryKeys.js';

const flush = () => act(async () => { await Promise.resolve(); });

// Resuming a paused fetch takes more than one turn of the loop — the retryer
// continues, the request resolves, then React commits — so assertions on the
// rendered output poll instead of assuming a fixed number of flushes.
async function waitFor(predicate, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await flush();
  }
  expect(predicate()).toBe(true);
}

// Unmounting schedules React work of its own, and a live query keeps notifying
// after the test returns — both have to settle inside act or jest reports the
// leak against whichever test runs next.
async function teardown(tree, client) {
  await act(async () => tree.unmount());
  if (client) {
    client.cancelQueries();
    client.clear();
  }
  await flush();
}

describe('query client defaults', () => {
  const defaults = createQueryClient().getDefaultOptions();

  it('keeps entries alive at least as long as the persisted cache is valid', () => {
    // The trap: gcTime defaults to 5 minutes, so a restored day-old cache is
    // collected moments after hydration and the screen blanks anyway.
    expect(defaults.queries.gcTime).toBeGreaterThanOrEqual(PERSIST_MAX_AGE);
  });

  it('leaves queries on the default network mode so they pause when offline', () => {
    // 'always' here would fire requests into a dead radio instead of serving
    // the cache; the absence of an override is the behaviour under test.
    expect(defaults.queries.networkMode).toBeUndefined();
  });

  it('lets a mutation fail fast offline rather than hang pending', () => {
    // There is no offline write queue — the server owns every business rule —
    // so a tap must surface an error the user can act on.
    expect(defaults.mutations.networkMode).toBe('always');
    expect(defaults.mutations.retry).toBe(0);
  });
});

describe('retry policy', () => {
  const http = (status) => ({ response: { status } });

  it('does not retry a rejected request', () => {
    // The client already refreshes once on 401; 400/403/404 answer the same
    // every time, so retrying only delays the message.
    expect(shouldRetryQuery(0, http(401))).toBe(false);
    expect(shouldRetryQuery(0, http(409))).toBe(false);
  });

  it('retries a server fault and a bare network error, then gives up', () => {
    expect(shouldRetryQuery(0, http(500))).toBe(true);
    expect(shouldRetryQuery(0, new Error('Network Error'))).toBe(true);
    expect(shouldRetryQuery(2, http(500))).toBe(false);
  });
});

describe('what reaches the disk', () => {
  it('persists successful queries only', () => {
    expect(shouldDehydrateQuery({ state: { status: 'success' } })).toBe(true);
    // A restored error is a failure the user cannot retry away.
    expect(shouldDehydrateQuery({ state: { status: 'error' } })).toBe(false);
    expect(shouldDehydrateQuery({ state: { status: 'pending' } })).toBe(false);
  });

  it('never persists mutations', () => {
    expect(persistOptions.dehydrateOptions.shouldDehydrateMutation()).toBe(false);
  });

  it('drops a cache older than a day on restore', () => {
    expect(persistOptions.maxAge).toBe(PERSIST_MAX_AGE);
    expect(persistOptions.buster).toBeTruthy();
  });
});

describe('clearing the cache when a session ends', () => {
  it('empties memory and removes the persisted record', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const client = createQueryClient();
    client.setQueryData(qk.myOrders, { orders: [{ id: 'o1', addressText: 'вул. Тестова, 5' }] });
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify({ timestamp: Date.now() }));

    await clearOfflineCache(client);

    // AsyncStorage is not encrypted and the cache holds delivery addresses —
    // leaving them behind would show them to whoever logs in next.
    expect(client.getQueryData(qk.myOrders)).toBeUndefined();
    expect(await AsyncStorage.getItem(PERSIST_KEY)).toBeNull();
  });
});

describe('NetInfo → onlineManager', () => {
  it('treats an unknown reachability as online', () => {
    // null means "still probing"; calling that offline would blank the app on
    // every cold start.
    expect(onlineFromNetInfoState({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it('treats a connected-but-unreachable network as offline', () => {
    // Captive portal or no data plan: connected, but nothing gets through.
    expect(onlineFromNetInfoState({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('treats no connection, and no state at all, as offline', () => {
    expect(onlineFromNetInfoState({ isConnected: false, isInternetReachable: true })).toBe(false);
    expect(onlineFromNetInfoState(undefined)).toBe(false);
  });

  it('pushes NetInfo events into the manager and unsubscribes on teardown', () => {
    const unsubscribe = jest.fn();
    let emit;
    const netInfo = {
      addEventListener: (fn) => {
        emit = fn;
        return unsubscribe;
      },
    };
    const manager = { setEventListener: jest.fn((setup) => setup(jest.fn())) };
    const setOnline = jest.fn();
    manager.setEventListener = jest.fn((setup) => {
      manager.teardown = setup(setOnline);
    });

    const stop = startOnlineBridge(netInfo, manager);
    emit({ isConnected: false });
    expect(setOnline).toHaveBeenCalledWith(false);
    emit({ isConnected: true, isInternetReachable: true });
    expect(setOnline).toHaveBeenLastCalledWith(true);

    manager.teardown();
    expect(unsubscribe).toHaveBeenCalled();
    stop();
  });
});

describe('useOnlineStatus', () => {
  // Restoring the connection resumes anything left paused, and React Query
  // delivers that on a timer — flush it inside act, or the notification lands
  // after the test has torn down.
  afterEach(async () => {
    await act(async () => onlineManager.setOnline(true));
  });

  it('re-renders when connectivity flips', async () => {
    const seen = [];
    function Probe() {
      seen.push(useOnlineStatus());
      return null;
    }
    let tree;
    await act(async () => {
      tree = create(<Probe />);
    });
    expect(seen[seen.length - 1]).toBe(true);

    await act(async () => onlineManager.setOnline(false));
    expect(seen[seen.length - 1]).toBe(false);

    await teardown(tree);
  });
});

describe('a screen offline', () => {
  // Restoring the connection resumes anything left paused, and React Query
  // delivers that on a timer — flush it inside act, or the notification lands
  // after the test has torn down.
  afterEach(async () => {
    await act(async () => onlineManager.setOnline(true));
  });

  let last; // the full query result of the most recent render
  function List({ queryFn }) {
    const result = useQuery({ queryKey: qk.cooks(''), queryFn });
    last = result;
    const { data, isLoading } = result;
    return <Text>{isLoading ? 'loading' : (data?.cooks ?? []).map((c) => c.name).join(',')}</Text>;
  }

  // The real defaults, minus retry backoff — those timers would outlive the
  // test without changing what is being asserted.
  const testClient = () => {
    const client = createQueryClient();
    client.setDefaultOptions({
      queries: { ...client.getDefaultOptions().queries, retry: false },
    });
    return client;
  };

  const render = async (client, queryFn) => {
    let tree;
    await act(async () => {
      tree = create(
        <QueryClientProvider client={client}>
          <List queryFn={queryFn} />
        </QueryClientProvider>,
      );
    });
    await flush();
    return tree;
  };

  it('renders cached data and fires no request', async () => {
    const client = testClient();
    // Stand in for what a restore from AsyncStorage puts in the cache.
    client.setQueryData(qk.cooks(''), { cooks: [{ id: '1', name: 'Олена' }] });
    onlineManager.setOnline(false);

    const queryFn = jest.fn();
    const tree = await render(client, queryFn);

    expect(tree.root.findByType(Text).props.children).toBe('Олена');
    expect(queryFn).not.toHaveBeenCalled();

    await teardown(tree, client);
  });

  it('does not spin forever when there is nothing cached', async () => {
    // isLoading is pending && fetching; a paused query is not fetching, so the
    // screen falls through to its empty state instead of an endless spinner.
    const client = testClient();
    onlineManager.setOnline(false);

    const tree = await render(client, jest.fn());

    expect(tree.root.findByType(Text).props.children).toBe('');
    expect(last.isLoading).toBe(false);

    // The same pair is what RefreshControl reads. A paused fetch never
    // settles, so a local flag cleared in a refetch().finally() would leave
    // the pull-to-refresh spinner turning forever; `isRefetching` does not.
    expect(last.fetchStatus).toBe('paused');
    expect(last.isRefetching).toBe(false);

    await teardown(tree, client);
  });

  it('fetches once the connection is back', async () => {
    const client = testClient();
    onlineManager.setOnline(false);
    const queryFn = jest.fn().mockResolvedValue({ cooks: [{ id: '2', name: 'Марія' }] });
    const tree = await render(client, queryFn);

    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => tree.root.findByType(Text).props.children === 'Марія');

    expect(queryFn).toHaveBeenCalledTimes(1);

    await teardown(tree, client);
  });
});

describe('remembered language', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  beforeEach(() => AsyncStorage.clear());

  it('round-trips a supported language', async () => {
    await saveLang('en');
    expect(await AsyncStorage.getItem(LANG_KEY)).toBe('en');
    expect(await loadLang()).toBe('en');
  });

  it('refuses to store or return a language the app cannot render', async () => {
    await saveLang('de');
    expect(await AsyncStorage.getItem(LANG_KEY)).toBeNull();

    await AsyncStorage.setItem(LANG_KEY, 'de');
    // null, not 'de' — the caller keeps its own default.
    expect(await loadLang()).toBeNull();
    expect(isSupportedLang('de')).toBe(false);
  });

  it('survives a storage that throws', async () => {
    const broken = {
      getItem: () => Promise.reject(new Error('disk full')),
      setItem: () => Promise.reject(new Error('disk full')),
    };
    expect(await loadLang(broken)).toBeNull();
    await expect(saveLang('uk', broken)).resolves.toBeUndefined();
  });
});

describe('query keys', () => {
  it('separates the catalogue per search term', () => {
    expect(qk.cooks('борщ')).not.toEqual(qk.cooks(''));
  });

  it('gives every cached surface a distinct root', () => {
    const roots = [
      qk.cooks('')[0],
      qk.cookMenu('x')[0],
      qk.cart[0],
      qk.myOrders[0],
      qk.myDishes[0],
      qk.cookOrders[0],
      qk.cookReviews[0],
      qk.courierProfile[0],
      qk.courierAvailable[0],
      qk.courierDeliveries[0],
    ];
    expect(new Set(roots).size).toBe(roots.length);
  });
});

describe('QueryClient is shared, not rebuilt', () => {
  it('exports a single instance so the persisted cache has one owner', () => {
    const { queryClient } = require('../offline/queryClient.js');
    expect(queryClient).toBeInstanceOf(QueryClient);
    expect(require('../offline/queryClient.js').queryClient).toBe(queryClient);
  });
});
