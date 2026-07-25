// Module 8.5 — courier tracking: batch shaping, transitions, and the rule that
// tracking follows an active delivery.

import { activeDelivery, nextDeliveryStatus, TRACKABLE } from '../api/courier.js';

describe('courier delivery transitions', () => {
  it('walks the delivery leg in order', () => {
    expect(nextDeliveryStatus({ status: 'COURIER_ASSIGNED' })).toBe('PICKED_UP');
    expect(nextDeliveryStatus({ status: 'PICKED_UP' })).toBe('ON_THE_WAY');
    expect(nextDeliveryStatus({ status: 'ON_THE_WAY' })).toBe('DELIVERED');
  });

  it('offers nothing once delivered or for an unknown state', () => {
    expect(nextDeliveryStatus({ status: 'DELIVERED' })).toBeNull();
    expect(nextDeliveryStatus({ status: 'READY' })).toBeNull();
    expect(nextDeliveryStatus(undefined)).toBeNull();
  });
});

describe('active delivery detection', () => {
  it('finds the order that is actually in progress', () => {
    const orders = [
      { id: 'a', status: 'DELIVERED' },
      { id: 'b', status: 'PICKED_UP' },
    ];
    expect(activeDelivery(orders).id).toBe('b');
  });

  it('returns null when nothing is in progress, so tracking can stop', () => {
    expect(activeDelivery([{ id: 'a', status: 'DELIVERED' }])).toBeNull();
    expect(activeDelivery([])).toBeNull();
  });

  it('treats exactly the statuses the server accepts positions for', () => {
    expect(TRACKABLE).toEqual(['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY']);
  });
});

describe('background batch shaping', () => {
  let tracking;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('expo-task-manager', () => ({
      defineTask: jest.fn(),
      isTaskRegisteredAsync: jest.fn(async () => false),
    }));
    jest.doMock('expo-location', () => ({
      Accuracy: { Balanced: 3 },
      requestForegroundPermissionsAsync: jest.fn(),
      requestBackgroundPermissionsAsync: jest.fn(),
      startLocationUpdatesAsync: jest.fn(),
      stopLocationUpdatesAsync: jest.fn(),
      hasStartedLocationUpdatesAsync: jest.fn(async () => false),
    }));
    jest.doMock('@react-native-async-storage/async-storage', () => {
      const mem = new Map();
      return {
        __esModule: true,
        default: {
          setItem: jest.fn(async (k, v) => void mem.set(k, v)),
          getItem: jest.fn(async (k) => mem.get(k) ?? null),
          removeItem: jest.fn(async (k) => void mem.delete(k)),
        },
      };
    });
    tracking = require('../tracking/locationTask.js');
  });

  afterEach(() => {
    jest.dontMock('expo-task-manager');
    jest.dontMock('expo-location');
    jest.dontMock('@react-native-async-storage/async-storage');
  });

  it('maps expo-location output to the endpoint payload', () => {
    const positions = tracking.toPositions([
      { coords: { latitude: 49.44, longitude: 32.05 }, timestamp: 1784000000000 },
    ]);
    expect(positions).toEqual([
      { lat: 49.44, lng: 32.05, at: new Date(1784000000000).toISOString() },
    ]);
  });

  it('drops entries without usable coordinates', () => {
    expect(
      tracking.toPositions([
        { coords: { latitude: NaN, longitude: 32 } },
        { coords: null },
        {},
        { coords: { latitude: 49, longitude: 32 } },
      ]),
    ).toHaveLength(1);
  });

  it('caps the batch at the 50 the endpoint accepts, keeping the newest', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      coords: { latitude: 49 + i / 1000, longitude: 32 },
      timestamp: 1784000000000 + i * 1000,
    }));
    const positions = tracking.toPositions(many);
    expect(positions).toHaveLength(50);
    // The tail is kept, so the most recent position always survives.
    expect(positions.at(-1).lat).toBeCloseTo(49 + 79 / 1000);
  });

  it('remembers which order to report against across a cold background wake', async () => {
    await tracking.setTrackedOrder('order-1');
    expect(await tracking.getTrackedOrder()).toBe('order-1');
    await tracking.setTrackedOrder(null);
    expect(await tracking.getTrackedOrder()).toBeNull();
  });
});
