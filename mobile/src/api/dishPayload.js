// Builds bodies for POST /cook/dishes and PUT /cook/dishes/:id.
//
// Both server schemas are `.strict()`, and they differ:
//   • create requires name + price;
//   • update requires *at least one* field and rejects an empty object.
//
// The form keeps everything as strings (TextInput gives strings), so price is
// converted here and blank optionals are simply left out of a create.
//
// On update, a cleared field IS sent as '' — that is how the server is told to
// clear it. Its schema accepts '' alongside the real type for exactly these
// optionals (`.or(z.literal(''))`), and the controller normalises '' to null.

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const trimmed = (v) => (typeof v === 'string' ? v.trim() : v);

// Accepts "120", "120.5" and "120,5" — Ukrainian keyboards produce commas.
export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalised = String(value ?? '').trim().replace(',', '.');
  if (!normalised) return null;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

export function buildCreateDishPayload(form) {
  const payload = {
    name: trimmed(form.name),
    price: parsePrice(form.price),
  };

  const description = trimmed(form.description);
  if (description) payload.description = description;

  const categoryId = trimmed(form.categoryId);
  if (categoryId) payload.categoryId = categoryId;

  if (typeof form.isAvailable === 'boolean') payload.isAvailable = form.isAvailable;

  if (Array.isArray(form.availableDays) && form.availableDays.length) {
    payload.availableDays = form.availableDays.filter((d) => DAYS.includes(d));
  }

  const from = trimmed(form.availableFrom);
  const until = trimmed(form.availableUntil);
  if (from) payload.availableFrom = from;
  if (until) payload.availableUntil = until;

  return payload;
}

// Only fields the cook actually changed are sent, so an edit never silently
// rewrites a value that wasn't touched.
export function buildUpdateDishPayload(form, original) {
  const patch = {};

  const name = trimmed(form.name);
  if (name && name !== original.name) patch.name = name;

  const price = parsePrice(form.price);
  if (price !== null && price !== original.price) patch.price = price;

  const description = trimmed(form.description) ?? '';
  if (description !== (original.description ?? '')) patch.description = description;

  const categoryId = trimmed(form.categoryId) ?? '';
  if (categoryId !== (original.categoryId ?? '')) patch.categoryId = categoryId;

  if (typeof form.isAvailable === 'boolean' && form.isAvailable !== original.isAvailable) {
    patch.isAvailable = form.isAvailable;
  }

  const days = Array.isArray(form.availableDays) ? form.availableDays.filter((d) => DAYS.includes(d)) : [];
  const originalDays = original.availableDays ?? [];
  if (days.length !== originalDays.length || days.some((d, i) => d !== originalDays[i])) {
    patch.availableDays = days;
  }

  const from = trimmed(form.availableFrom) ?? '';
  if (from !== (original.availableFrom ?? '')) patch.availableFrom = from;

  const until = trimmed(form.availableUntil) ?? '';
  if (until !== (original.availableUntil ?? '')) patch.availableUntil = until;

  return patch;
}

export { DAYS };
