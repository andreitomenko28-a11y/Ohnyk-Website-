// Which status a cook may move an order to next.
//
// This mirrors `cookTransitions` in backend/src/controllers/cookOrdersController.js.
// The server is still the authority — it re-validates every transition — but the
// UI needs to know which buttons to show, and offering an action the server
// would reject is worse than not offering it.
//
// The map depends on the delivery method, because the cook's involvement ends
// at different points:
//   • COURIER       — cook stops at READY; a courier takes over.
//   • COOK_DELIVERY — the cook delivers: READY → ON_THE_WAY → DELIVERED.
//   • PICKUP        — the customer collects: READY → DELIVERED.

export function cookTransitions(deliveryMethod) {
  const map = {
    NEW: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: [],
    ON_THE_WAY: [],
  };

  if (deliveryMethod === 'PICKUP') {
    map.READY = ['DELIVERED'];
  } else if (deliveryMethod === 'COOK_DELIVERY') {
    map.READY = ['ON_THE_WAY'];
    map.ON_THE_WAY = ['DELIVERED'];
  }

  return map;
}

// Forward action the cook can take, if any. Cancelling is handled separately
// so it never sits on the primary button.
export function nextCookStatus(order) {
  const allowed = cookTransitions(order?.deliveryMethod)[order?.status] ?? [];
  return allowed.find((s) => s !== 'CANCELLED') ?? null;
}

export function canCancel(order) {
  return (cookTransitions(order?.deliveryMethod)[order?.status] ?? []).includes('CANCELLED');
}

// Statuses that mean the order is finished, one way or another.
export const TERMINAL = ['DELIVERED', 'CANCELLED'];

export function isActive(order) {
  return !TERMINAL.includes(order?.status) && order?.status !== 'AWAITING_PAYMENT';
}
