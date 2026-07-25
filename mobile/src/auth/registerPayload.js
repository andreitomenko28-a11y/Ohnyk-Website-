// Builds the POST /auth/register body.
//
// The server schema is `.strict()`: any key it doesn't declare — including a
// role-specific key sent for the wrong role, or an empty string left over from
// an untouched input — fails the whole request with a validation error. So the
// payload is assembled explicitly per role instead of spreading the form state.

export const ROLES = ['CUSTOMER', 'COOK', 'COURIER'];
export const TRANSPORTS = ['WALKING', 'BICYCLE', 'MOTORBIKE', 'CAR'];

// Empty optional strings must be omitted, not sent as ''.
const clean = (value) => {
  const v = typeof value === 'string' ? value.trim() : value;
  return v ? v : undefined;
};

function withDefined(base, extras) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function buildRegisterPayload(form, role) {
  const base = {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    password: form.password,
    role,
  };

  const phone = clean(form.phone);
  if (phone) base.phone = phone;

  if (role === 'COOK') {
    return withDefined(base, {
      kitchenAddress: clean(form.kitchenAddress),
      deliveryZone: clean(form.deliveryZone),
      bio: clean(form.bio),
    });
  }

  if (role === 'COURIER') {
    return withDefined(base, { transport: form.transport });
  }

  return base; // CUSTOMER
}
