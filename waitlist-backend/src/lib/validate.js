import { z } from 'zod';

// E.164: leading "+", first digit 1-9, then 7-14 more digits (8-15 total).
const E164 = /^\+[1-9]\d{7,14}$/;

// Accepts common human formatting (spaces, dashes, parentheses) and
// normalises to bare E.164 before validating.
function normalizePhone(raw) {
  if (typeof raw !== 'string') return raw;
  return raw.replace(/[\s()\-.]/g, '');
}

export const waitlistSchema = z.object({
  name: z
    .string({ required_error: 'name_required' })
    .trim()
    .min(2, 'name_too_short')
    .max(120, 'name_too_long'),
  phone: z
    .string({ required_error: 'phone_required' })
    .transform(normalizePhone)
    .refine((v) => E164.test(v), 'phone_invalid'),
  email: z
    .string({ required_error: 'email_required' })
    .trim()
    .toLowerCase()
    .email('email_invalid')
    .max(200, 'email_too_long'),
  role: z.enum(['client', 'cook'], {
    errorMap: () => ({ message: 'role_invalid' }),
  }),
  // Honeypot: real users never see or fill this. Must stay empty.
  website: z.string().optional().default(''),
});

// Returns { ok: true, data } or { ok: false, errors: [{ field, code }] }.
export function validateWaitlist(input) {
  const result = waitlistSchema.safeParse(input ?? {});
  if (result.success) return { ok: true, data: result.data };
  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    code: issue.message,
  }));
  return { ok: false, errors };
}
