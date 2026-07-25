// Cook order transitions — must stay in step with the server's table in
// backend/src/controllers/cookOrdersController.js (cookTransitions).

import { canCancel, cookTransitions, isActive, nextCookStatus } from '../api/orderStatus.js';

describe('cook transitions by delivery method', () => {
  it('stops at READY when a courier takes over', () => {
    const map = cookTransitions('COURIER');
    expect(map.NEW).toEqual(['PREPARING', 'CANCELLED']);
    expect(map.PREPARING).toEqual(['READY', 'CANCELLED']);
    expect(map.READY).toEqual([]); // handed to the courier
  });

  it('lets the cook hand over directly on pickup', () => {
    expect(cookTransitions('PICKUP').READY).toEqual(['DELIVERED']);
  });

  it('gives the cook the delivery leg when they deliver themselves', () => {
    const map = cookTransitions('COOK_DELIVERY');
    expect(map.READY).toEqual(['ON_THE_WAY']);
    expect(map.ON_THE_WAY).toEqual(['DELIVERED']);
  });
});

describe('next forward action', () => {
  it('never offers cancel as the primary action', () => {
    expect(nextCookStatus({ status: 'NEW', deliveryMethod: 'COURIER' })).toBe('PREPARING');
    expect(nextCookStatus({ status: 'PREPARING', deliveryMethod: 'COURIER' })).toBe('READY');
  });

  it('offers nothing once the cook is done with a courier order', () => {
    expect(nextCookStatus({ status: 'READY', deliveryMethod: 'COURIER' })).toBeNull();
  });

  it('continues past READY for pickup and self-delivery', () => {
    expect(nextCookStatus({ status: 'READY', deliveryMethod: 'PICKUP' })).toBe('DELIVERED');
    expect(nextCookStatus({ status: 'READY', deliveryMethod: 'COOK_DELIVERY' })).toBe('ON_THE_WAY');
    expect(nextCookStatus({ status: 'ON_THE_WAY', deliveryMethod: 'COOK_DELIVERY' })).toBe('DELIVERED');
  });

  it('offers nothing for a finished or unknown order', () => {
    expect(nextCookStatus({ status: 'DELIVERED', deliveryMethod: 'COURIER' })).toBeNull();
    expect(nextCookStatus({ status: 'CANCELLED', deliveryMethod: 'COURIER' })).toBeNull();
    expect(nextCookStatus(undefined)).toBeNull();
  });
});

describe('cancellation window', () => {
  it('is open before the dish is ready and closed after', () => {
    expect(canCancel({ status: 'NEW', deliveryMethod: 'COURIER' })).toBe(true);
    expect(canCancel({ status: 'PREPARING', deliveryMethod: 'COURIER' })).toBe(true);
    expect(canCancel({ status: 'READY', deliveryMethod: 'COURIER' })).toBe(false);
    expect(canCancel({ status: 'DELIVERED', deliveryMethod: 'COURIER' })).toBe(false);
  });
});

describe('active filter', () => {
  it('hides finished and unpaid orders', () => {
    expect(isActive({ status: 'PREPARING' })).toBe(true);
    expect(isActive({ status: 'DELIVERED' })).toBe(false);
    expect(isActive({ status: 'CANCELLED' })).toBe(false);
    // Unpaid orders never reach the cook's list server-side either.
    expect(isActive({ status: 'AWAITING_PAYMENT' })).toBe(false);
  });
});

// Regression: DELETE /cook/reviews/:id/reply answers 204 with no body, so the
// API helper must not try to read a review out of the response. Reading
// `data.review` there yields undefined and crashes the caller.
describe('endpoints that answer 204', () => {
  it('deleteReviewReply resolves without returning a review', async () => {
    jest.resetModules();
    const del = jest.fn(async () => ({ status: 204, data: '' }));
    jest.doMock('../api/client.js', () => ({
      __esModule: true,
      default: { delete: del, get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn() },
      apiError: (e) => String(e),
    }));
    const { deleteReviewReply } = require('../api/cook.js');

    await expect(deleteReviewReply('rev-1')).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('/cook/reviews/rev-1/reply');
    jest.dontMock('../api/client.js');
  });
});
