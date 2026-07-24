// Per-socket event rate limiting.
//
// A connected (authenticated) client can still flood the server with socket
// events — each `location:update` is a DB upsert + broadcast, each `*:join` a
// DB lookup. This caps how many events per window a single socket may send,
// with a tighter budget for the write-heavy `location:update`. Over-budget
// events are dropped (the socket is not disconnected).

const SECOND = 1000;

// Defaults (env-tunable). Windows are per socket, per event.
const GLOBAL = {
  windowMs: Number(process.env.SOCKET_RATE_WINDOW_MS) || 10 * SECOND,
  max: Number(process.env.SOCKET_RATE_MAX) || 60,
};
const PER_EVENT = {
  'location:update': { windowMs: 10 * SECOND, max: Number(process.env.SOCKET_RATE_LOCATION_MAX) || 30 },
  'track:join': { windowMs: 10 * SECOND, max: 15 },
  'chat:join': { windowMs: 10 * SECOND, max: 15 },
};

// Pure sliding-window limiter. Exported for testing. `allow(event)` returns
// false when the event should be dropped.
export function createEventLimiter({ global = GLOBAL, perEvent = PER_EVENT } = {}) {
  const buckets = new Map(); // event -> ascending timestamps within the window

  function allow(event, now = Date.now()) {
    const cfg = perEvent[event] || global;
    const arr = buckets.get(event) || [];
    const cutoff = now - cfg.windowMs;
    // Drop timestamps that have aged out of the window.
    let i = 0;
    while (i < arr.length && arr[i] <= cutoff) i++;
    if (i > 0) arr.splice(0, i);

    if (arr.length >= cfg.max) return false;
    arr.push(now);
    buckets.set(event, arr);
    return true;
  }

  return { allow };
}

// Install limiting on a socket. No-op under NODE_ENV=test. Over-budget packets
// are rejected with a lightweight error rather than disconnecting the client.
export function installSocketRateLimit(socket) {
  if (process.env.NODE_ENV === 'test') return;
  const limiter = createEventLimiter();
  socket.use((packet, next) => {
    const [event] = packet;
    if (!limiter.allow(event)) return next(new Error('rate_limited'));
    next();
  });
}
