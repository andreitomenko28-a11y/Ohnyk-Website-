import { describe, it, expect } from 'vitest';
import { computePricing, CUSTOMER_FEE_RATE, COOK_COMMISSION_RATE } from '../src/lib/pricing.js';

describe('Pricing / commission (lib/pricing)', () => {
  it('adds a 10% customer fee and deducts a 10% cook commission (20% total take)', () => {
    const p = computePricing(190);
    expect(p.subtotal).toBe(190);
    expect(p.serviceFee).toBe(19); // customer +10%
    expect(p.total).toBe(209); // customer pays
    expect(p.cookPayout).toBe(171); // cook earns (−10%)
    expect(p.commission).toBe(38); // app take = 19 + 19 = 20% of 190
    // The app's take equals what the customer pays minus what the cook earns.
    expect(Number((p.total - p.cookPayout).toFixed(2))).toBe(p.commission);
  });

  it('adds a delivery fee to the customer total but not to the commission', () => {
    const p = computePricing(100, 50);
    expect(p.serviceFee).toBe(10);
    expect(p.deliveryFee).toBe(50);
    expect(p.total).toBe(160); // 100 + 10 + 50
    expect(p.cookPayout).toBe(90);
    expect(p.commission).toBe(20); // delivery excluded
  });

  it('rounds to two decimals', () => {
    const p = computePricing(95.5);
    expect(p.serviceFee).toBe(9.55);
    expect(p.total).toBe(105.05);
    expect(p.cookPayout).toBe(85.95);
  });

  it('exposes the configured rates', () => {
    expect(CUSTOMER_FEE_RATE).toBe(0.1);
    expect(COOK_COMMISSION_RATE).toBe(0.1);
  });
});
