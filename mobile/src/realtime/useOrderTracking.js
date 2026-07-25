// Subscribes to an order's live courier position.
//
// The server answers `track:join` with the last known location, so the map has
// something to show immediately instead of an empty view until the courier's
// next ping. After that, positions arrive as `location:update` events.
//
// Only the order's buyer or its assigned courier may join; anyone else gets
// `{ ok: false }`, which surfaces here as `forbidden` rather than a silent
// blank map.

import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket.js';

export default function useOrderTracking(orderId, { enabled = true } = {}) {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState(null);
  const [state, setState] = useState('connecting'); // connecting | live | forbidden | error
  const joinedRef = useRef(null);

  useEffect(() => {
    if (!orderId || !enabled) return undefined;

    const socket = getSocket();
    let active = true;

    const onLocation = (payload) => {
      // One socket can watch several orders; ignore other rooms' traffic.
      if (!active || payload?.orderId !== orderId) return;
      setLocation({ lat: payload.lat, lng: payload.lng, updatedAt: payload.updatedAt });
      setState('live');
    };

    const join = () => {
      socket.emit('track:join', orderId, (ack) => {
        if (!active) return;
        if (!ack?.ok) {
          setState('forbidden');
          return;
        }
        joinedRef.current = orderId;
        setStatus(ack.status ?? null);
        if (ack.location) setLocation(ack.location);
        setState('live');
      });
    };

    socket.on('location:update', onLocation);
    // Re-join after a reconnect — room membership does not survive one.
    socket.on('connect', join);
    if (socket.connected) join();

    return () => {
      active = false;
      socket.off('location:update', onLocation);
      socket.off('connect', join);
      if (joinedRef.current) {
        socket.emit('track:leave', joinedRef.current);
        joinedRef.current = null;
      }
    };
  }, [orderId, enabled]);

  return { location, status, state };
}
