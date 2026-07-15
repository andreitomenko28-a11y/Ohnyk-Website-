// Marketplace pricing / commission.
//
// The cook sets dish prices — their sum is the order SUBTOTAL (base value).
// On top of that Ohnyk applies a two-sided commission:
//   • The customer pays a +10% service fee  → pays  subtotal * 1.10
//   • The cook is charged a 10% commission   → earns subtotal * 0.90
// So the app's total take is ~20% of the subtotal.

export const CUSTOMER_FEE_RATE = 0.1; // added to what the customer pays
export const COOK_COMMISSION_RATE = 0.1; // deducted from what the cook earns

const round2 = (n) => Number((Number(n) || 0).toFixed(2));

// Compute the full price breakdown for a given subtotal (base dish value).
// deliveryFee is added to the customer total but is not commissionable.
export function computePricing(subtotal, deliveryFee = 0) {
  const base = round2(subtotal);
  const delivery = round2(deliveryFee);

  const serviceFee = round2(base * CUSTOMER_FEE_RATE); // customer +10%
  const total = round2(base + serviceFee + delivery); // customer pays

  const cookCommission = round2(base * COOK_COMMISSION_RATE); // cook −10%
  const cookPayout = round2(base - cookCommission); // cook earns

  const commission = round2(serviceFee + cookCommission); // app take (~20%)

  return { subtotal: base, deliveryFee: delivery, serviceFee, total, cookCommission, cookPayout, commission };
}
