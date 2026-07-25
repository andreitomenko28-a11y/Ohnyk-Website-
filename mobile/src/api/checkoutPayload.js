// Builds the POST /orders body.
//
// The server schema is `.strict()`, and address is either/or: a saved
// `addressId` (uuid) or free-text `addressText`. Sending both is wasteful and
// sending a blank one fails validation, so exactly one goes out.
//
// `scheduledFor` must be a full ISO datetime; omitting it means "as soon as
// possible", which is the common case.

export const DELIVERY_METHODS = ['COURIER', 'COOK_DELIVERY', 'PICKUP'];

export function buildCheckoutPayload({ addressId, addressText, note, scheduledFor, deliveryMethod }) {
  const payload = {
    deliveryMethod: DELIVERY_METHODS.includes(deliveryMethod) ? deliveryMethod : 'COURIER',
  };

  // Pickup needs no address at all — the customer collects from the kitchen.
  if (payload.deliveryMethod !== 'PICKUP') {
    if (addressId) payload.addressId = addressId;
    else if (addressText?.trim()) payload.addressText = addressText.trim();
  }

  const cleanNote = note?.trim();
  if (cleanNote) payload.note = cleanNote;

  if (scheduledFor) payload.scheduledFor = scheduledFor;

  return payload;
}

// A delivery address is required unless the customer is collecting in person.
export function checkoutIsReady({ deliveryMethod, addressId, addressText }) {
  if (deliveryMethod === 'PICKUP') return true;
  return Boolean(addressId || addressText?.trim());
}
