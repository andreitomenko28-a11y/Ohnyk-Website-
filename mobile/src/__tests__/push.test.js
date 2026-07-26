// Module 8.7 — notification deep-link mapping.

import { isTrackTarget, targetForNotification } from '../push/deepLink.js';

describe('notification deep links', () => {
  it('sends a buyer straight to the live map for an order update', () => {
    const target = targetForNotification({ type: 'ORDER_STATUS', orderId: 'order-1' });
    expect(target).toEqual({ tab: 'Orders', screen: 'Track', params: { orderId: 'order-1' } });
    expect(isTrackTarget(target)).toBe(true);
  });

  it('falls back to the orders tab when the payload has no order id', () => {
    const target = targetForNotification({ type: 'ORDER_STATUS' });
    expect(target).toEqual({ tab: 'Orders' });
    // Nothing to push onto the stack, so it must not be treated as a track target.
    expect(isTrackTarget(target)).toBe(false);
  });

  it('routes cook notifications to the right cook tab', () => {
    expect(targetForNotification({ type: 'NEW_ORDER' })).toEqual({ tab: 'CookOrders' });
    expect(targetForNotification({ type: 'REVIEW_RECEIVED' })).toEqual({ tab: 'CookReviews' });
  });

  it('ignores an unknown or empty payload rather than navigating somewhere wrong', () => {
    expect(targetForNotification({ type: 'SOMETHING_NEW' })).toBeNull();
    expect(targetForNotification({})).toBeNull();
    expect(targetForNotification()).toBeNull();
  });

  it('covers every notification type the backend can send', () => {
    // Mirrors NotificationType in backend/prisma/schema.prisma — a new type
    // added there without a target here would land the user nowhere.
    for (const type of ['ORDER_STATUS', 'NEW_ORDER', 'NEW_MESSAGE', 'REVIEW_RECEIVED']) {
      expect(targetForNotification({ type, orderId: 'o-1' })).not.toBeNull();
    }
  });
});
