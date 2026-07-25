// Module 8.4 — checkout payload shaping.

import { buildCheckoutPayload, checkoutIsReady, DELIVERY_METHODS } from '../api/checkoutPayload.js';

describe('checkout payload (schema is .strict(), address is either/or)', () => {
  it('prefers a saved address and never sends both address forms', () => {
    const payload = buildCheckoutPayload({
      addressId: 'addr-1',
      addressText: 'вул. Шевченка, 12',
      deliveryMethod: 'COURIER',
    });
    expect(payload.addressId).toBe('addr-1');
    expect(payload).not.toHaveProperty('addressText');
  });

  it('falls back to free text when no saved address is chosen', () => {
    const payload = buildCheckoutPayload({
      addressId: null,
      addressText: '  вул. Шевченка, 12  ',
      deliveryMethod: 'COURIER',
    });
    expect(payload.addressText).toBe('вул. Шевченка, 12');
    expect(payload).not.toHaveProperty('addressId');
  });

  it('sends no address at all for pickup', () => {
    const payload = buildCheckoutPayload({
      addressId: 'addr-1',
      addressText: 'вул. Шевченка, 12',
      deliveryMethod: 'PICKUP',
    });
    expect(payload).not.toHaveProperty('addressId');
    expect(payload).not.toHaveProperty('addressText');
    expect(payload.deliveryMethod).toBe('PICKUP');
  });

  it('omits a blank note and a blank schedule rather than sending empties', () => {
    const payload = buildCheckoutPayload({
      addressText: 'вул. Шевченка, 12',
      note: '   ',
      scheduledFor: null,
      deliveryMethod: 'COURIER',
    });
    expect(payload).not.toHaveProperty('note');
    expect(payload).not.toHaveProperty('scheduledFor');
  });

  it('keeps a real note and schedule', () => {
    const payload = buildCheckoutPayload({
      addressText: 'вул. Шевченка, 12',
      note: '  без цибулі  ',
      scheduledFor: '2026-08-01T12:00:00.000Z',
      deliveryMethod: 'COURIER',
    });
    expect(payload.note).toBe('без цибулі');
    expect(payload.scheduledFor).toBe('2026-08-01T12:00:00.000Z');
  });

  it('falls back to COURIER for an unknown delivery method', () => {
    expect(buildCheckoutPayload({ addressText: 'a', deliveryMethod: 'TELEPORT' }).deliveryMethod).toBe(
      'COURIER',
    );
  });

  it('only ever emits keys the server schema declares', () => {
    const ALLOWED = new Set(['addressId', 'addressText', 'note', 'scheduledFor', 'deliveryMethod']);
    for (const method of DELIVERY_METHODS) {
      const payload = buildCheckoutPayload({
        addressId: 'a-1',
        addressText: 'вул. Шевченка, 12',
        note: 'нотатка',
        scheduledFor: '2026-08-01T12:00:00.000Z',
        deliveryMethod: method,
      });
      for (const key of Object.keys(payload)) expect(ALLOWED.has(key)).toBe(true);
    }
  });
});

describe('checkout readiness', () => {
  it('requires an address for delivery but not for pickup', () => {
    expect(checkoutIsReady({ deliveryMethod: 'COURIER', addressId: null, addressText: '' })).toBe(false);
    expect(checkoutIsReady({ deliveryMethod: 'COURIER', addressId: 'a-1' })).toBe(true);
    expect(checkoutIsReady({ deliveryMethod: 'COURIER', addressText: 'вул. Шевченка' })).toBe(true);
    expect(checkoutIsReady({ deliveryMethod: 'PICKUP' })).toBe(true);
  });

  it('does not accept whitespace as an address', () => {
    expect(checkoutIsReady({ deliveryMethod: 'COURIER', addressText: '   ' })).toBe(false);
  });
});
