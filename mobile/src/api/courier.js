// Courier API calls.

import api from './client.js';

export async function fetchCourierProfile() {
  const { data } = await api.get('/courier/me');
  return data.courier;
}

export async function setCourierStatus(patch) {
  const { data } = await api.patch('/courier/status', patch);
  return data.courier;
}

export async function fetchAvailableOrders() {
  const { data } = await api.get('/courier/orders/available');
  return data.orders ?? [];
}

export async function fetchMyDeliveries(params = {}) {
  const { data } = await api.get('/courier/orders', { params });
  return data.orders ?? [];
}

export async function claimOrder(orderId) {
  const { data } = await api.post(`/courier/orders/${orderId}/claim`);
  return data.order;
}

export async function advanceDelivery(orderId, status) {
  const { data } = await api.patch(`/courier/orders/${orderId}/status`, { status });
  return data.order;
}

// Mirrors the server's courier transition table
// (backend/src/controllers/courierController.js).
const COURIER_TRANSITIONS = {
  COURIER_ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'ON_THE_WAY',
  ON_THE_WAY: 'DELIVERED',
};

export function nextDeliveryStatus(order) {
  return COURIER_TRANSITIONS[order?.status] ?? null;
}

// Statuses during which the courier's position is worth reporting — the same
// list the server accepts location updates for.
export const TRACKABLE = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

export function activeDelivery(orders = []) {
  return orders.find((o) => TRACKABLE.includes(o.status)) ?? null;
}
