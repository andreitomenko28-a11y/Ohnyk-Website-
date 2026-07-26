// Turns a notification's data payload into a navigation target.
//
// The backend attaches { type, orderId, conversationId } to every push, which
// is enough to open the right screen — including from a cold tap, where the app
// has no state to fall back on.
//
// Kept free of navigation imports so the mapping can be tested on its own.

export function targetForNotification(data = {}) {
  switch (data.type) {
    case 'ORDER_STATUS':
      // Mid-delivery, the map is the screen the buyer actually wants.
      return data.orderId
        ? { tab: 'Orders', screen: 'Track', params: { orderId: data.orderId } }
        : { tab: 'Orders' };

    case 'NEW_ORDER':
      // Cooks land on their incoming orders.
      return { tab: 'CookOrders' };

    case 'REVIEW_RECEIVED':
      return { tab: 'CookReviews' };

    case 'NEW_MESSAGE':
      // Chat screens are not part of Phase 8; the orders list is the closest
      // sensible landing spot until they exist.
      return { tab: 'Orders' };

    default:
      return null;
  }
}

// Only tracking targets a pushed screen; everything else just selects a tab.
export function isTrackTarget(target) {
  return target?.screen === 'Track' && !!target?.params?.orderId;
}
