// Module 8.6 — socket auth and the live-tracking subscription.

describe('socket authentication', () => {
  let ioMock;
  let socketModule;
  let tokenStore;

  beforeEach(() => {
    jest.resetModules();
    ioMock = jest.fn(() => ({
      connected: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    }));
    jest.doMock('socket.io-client', () => ({ io: ioMock }));
    socketModule = require('../realtime/socket.js');
    tokenStore = require('../api/client.js').tokenStore;
  });

  afterEach(() => jest.dontMock('socket.io-client'));

  it('supplies the token through the callback form, so a rotated token is picked up', async () => {
    await tokenStore.set('access-1', 'refresh-1');
    socketModule.getSocket();

    const options = ioMock.mock.calls[0][1];
    expect(typeof options.auth).toBe('function');

    // The web reads the token synchronously; here it comes from SecureStore,
    // so the callback must tolerate a promise.
    const payload = await new Promise((resolve) => options.auth(resolve));
    expect(payload).toEqual({ token: 'access-1' });
  });

  it('connects over websocket only', () => {
    socketModule.getSocket();
    expect(ioMock.mock.calls[0][1].transports).toEqual(['websocket']);
  });

  it('still connects when the token cannot be read, rather than hanging', async () => {
    jest.resetModules();
    jest.doMock('socket.io-client', () => ({ io: ioMock }));
    jest.doMock('../api/client.js', () => ({
      __esModule: true,
      default: {},
      tokenStore: { getAccess: () => Promise.reject(new Error('locked')) },
      apiError: String,
    }));
    const mod = require('../realtime/socket.js');
    mod.getSocket();
    const options = ioMock.mock.calls.at(-1)[1];
    await expect(new Promise((resolve) => options.auth(resolve))).resolves.toEqual({});
    jest.dontMock('../api/client.js');
  });

  it('reuses one socket and drops it on disconnect', () => {
    const first = socketModule.getSocket();
    socketModule.getSocket();
    expect(ioMock).toHaveBeenCalledTimes(1); // shared, not one per call

    socketModule.disconnectSocket();
    expect(first.disconnect).toHaveBeenCalled();
    socketModule.getSocket();
    expect(ioMock).toHaveBeenCalledTimes(2); // a fresh one after teardown
  });
});

describe('order tracking subscription', () => {
  // Rendered for real, so the effect's socket conversation is exercised rather
  // than imitated: join on mount, ignore other orders, leave on unmount.
  function fakeSocket({ connected = true } = {}) {
    const handlers = {};
    return {
      connected,
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn((event, fn) => {
        (handlers[event] ||= []).push(fn);
      }),
      off: jest.fn((event, fn) => {
        handlers[event] = (handlers[event] ?? []).filter((h) => h !== fn);
      }),
      emit: jest.fn(),
      fire: (event, payload) => (handlers[event] ?? []).forEach((h) => h(payload)),
      handlers,
    };
  }

  function renderHook(socket, orderId) {
    jest.resetModules();
    jest.doMock('../realtime/socket.js', () => ({
      getSocket: () => socket,
      disconnectSocket: jest.fn(),
    }));
    const React = require('react');
    const TestRenderer = require('react-test-renderer');
    const useOrderTracking = require('../realtime/useOrderTracking.js').default;

    const seen = {};
    function Probe() {
      Object.assign(seen, useOrderTracking(orderId));
      return null;
    }
    let tree;
    TestRenderer.act(() => {
      tree = TestRenderer.create(React.createElement(Probe));
    });
    return { seen, unmount: () => TestRenderer.act(() => tree.unmount()) };
  }

  afterEach(() => jest.dontMock('../realtime/socket.js'));

  it('joins the order room and adopts the last known location from the ack', () => {
    const socket = fakeSocket();
    socket.emit.mockImplementation((event, id, ack) => {
      if (event === 'track:join') ack({ ok: true, status: 'ON_THE_WAY', location: { lat: 49.4, lng: 32.0 } });
    });

    const { seen, unmount } = renderHook(socket, 'order-1');
    expect(socket.emit).toHaveBeenCalledWith('track:join', 'order-1', expect.any(Function));
    // The ack carries the last position so the map is not blank until the next ping.
    expect(seen.location).toEqual({ lat: 49.4, lng: 32.0 });
    expect(seen.status).toBe('ON_THE_WAY');
    expect(seen.state).toBe('live');
    unmount();
  });

  it('reports forbidden when the server refuses the room', () => {
    const socket = fakeSocket();
    socket.emit.mockImplementation((event, id, ack) => {
      if (event === 'track:join') ack({ ok: false, error: 'forbidden' });
    });
    const { seen, unmount } = renderHook(socket, 'order-1');
    expect(seen.state).toBe('forbidden');
    unmount();
  });

  it('ignores position events belonging to another order', () => {
    const socket = fakeSocket();
    socket.emit.mockImplementation((event, id, ack) => {
      if (event === 'track:join') ack({ ok: true });
    });
    const { seen, unmount } = renderHook(socket, 'order-1');

    const TestRenderer = require('react-test-renderer');
    TestRenderer.act(() => socket.fire('location:update', { orderId: 'order-2', lat: 1, lng: 1 }));
    expect(seen.location).toBeNull();

    TestRenderer.act(() => socket.fire('location:update', { orderId: 'order-1', lat: 49.5, lng: 32.1 }));
    expect(seen.location).toMatchObject({ lat: 49.5, lng: 32.1 });
    unmount();
  });

  it('leaves the room on unmount so a stale subscription cannot linger', () => {
    const socket = fakeSocket();
    socket.emit.mockImplementation((event, id, ack) => {
      if (event === 'track:join') ack({ ok: true });
    });
    const { unmount } = renderHook(socket, 'order-1');
    unmount();
    expect(socket.emit).toHaveBeenCalledWith('track:leave', 'order-1');
    expect(socket.off).toHaveBeenCalledWith('location:update', expect.any(Function));
  });

  it('re-joins after a reconnect, since room membership does not survive one', () => {
    const socket = fakeSocket({ connected: false });
    socket.emit.mockImplementation((event, id, ack) => {
      if (event === 'track:join' && ack) ack({ ok: true });
    });
    const { unmount } = renderHook(socket, 'order-1');
    // Not connected yet, so no join happened on mount.
    expect(socket.emit).not.toHaveBeenCalledWith('track:join', 'order-1', expect.any(Function));

    const TestRenderer = require('react-test-renderer');
    TestRenderer.act(() => socket.fire('connect'));
    expect(socket.emit).toHaveBeenCalledWith('track:join', 'order-1', expect.any(Function));
    unmount();
  });
});
