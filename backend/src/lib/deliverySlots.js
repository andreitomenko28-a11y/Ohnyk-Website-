// Delivery time slots derived from the availability of the dishes in the cart.
// A slot is offered only on a day + time when EVERY dish in the cart is
// available (intersection of their schedules).

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']; // JS getDay() order
const DEFAULT_FROM = '09:00';
const DEFAULT_UNTIL = '21:00';
const SLOT_STEP_MIN = 60; // one slot per hour
const LEAD_MIN = 45; // earliest slot is ~45 min from now
const DAYS_AHEAD = 5; // offer slots for today + next 4 days

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Reduce the cart dishes to the common availability window + allowed weekdays.
export function commonAvailability(dishes) {
  // Allowed weekdays: intersection. Empty availableDays means "every day".
  let allowedDays = null; // null = all days
  for (const d of dishes) {
    if (d.availableDays && d.availableDays.length) {
      const set = new Set(d.availableDays);
      allowedDays = allowedDays ? new Set([...allowedDays].filter((x) => set.has(x))) : set;
    }
  }

  // Time window: latest "from" and earliest "until" across dishes that set them.
  let fromMin = toMinutes(DEFAULT_FROM);
  let untilMin = toMinutes(DEFAULT_UNTIL);
  for (const d of dishes) {
    if (d.availableFrom) fromMin = Math.max(fromMin, toMinutes(d.availableFrom));
    if (d.availableUntil) untilMin = Math.min(untilMin, toMinutes(d.availableUntil));
  }

  return { allowedDays, fromMin, untilMin };
}

// Returns slots grouped by day: [{ date: 'YYYY-MM-DD', label, slots: [{ value, label }] }].
export function computeDeliverySlots(dishes, now = new Date()) {
  const { allowedDays, fromMin, untilMin } = commonAvailability(dishes);
  if (untilMin <= fromMin) return []; // no valid window (e.g. conflicting schedules)

  const earliest = now.getTime() + LEAD_MIN * 60 * 1000;
  const days = [];

  for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const code = DAY_CODES[day.getDay()];
    if (allowedDays && !allowedDays.has(code)) continue;

    const slots = [];
    // Start on the hour at/after fromMin.
    const startMin = Math.ceil(fromMin / SLOT_STEP_MIN) * SLOT_STEP_MIN;
    for (let min = startMin; min <= untilMin; min += SLOT_STEP_MIN) {
      const slot = new Date(day);
      slot.setHours(Math.floor(min / 60), min % 60, 0, 0);
      if (slot.getTime() < earliest) continue; // skip past / too-soon slots
      const hh = String(slot.getHours()).padStart(2, '0');
      const mm = String(slot.getMinutes()).padStart(2, '0');
      slots.push({ value: slot.toISOString(), label: `${hh}:${mm}` });
    }
    if (slots.length) {
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, '0');
      const d = String(day.getDate()).padStart(2, '0');
      days.push({ date: `${y}-${m}-${d}`, slots });
    }
  }
  return days;
}

// True if `iso` matches one of the currently valid slots.
export function isValidSlot(dishes, iso, now = new Date()) {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return false;
  return computeDeliverySlots(dishes, now).some((g) => g.slots.some((s) => new Date(s.value).getTime() === target));
}
