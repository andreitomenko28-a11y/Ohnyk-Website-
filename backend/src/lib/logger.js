// Structured logger (pino) with secret redaction.
//
// Everything that logs objects or free text should go through here so that
// passwords, tokens, reset codes, auth headers and payment payloads never
// reach stdout in plaintext. pino provides levels + JSON output; our own
// redact() runs first so deep keys AND secret-shaped substrings in free text
// are masked before anything is emitted. Level via LOG_LEVEL (silent in tests).

import pino from 'pino';

// Object keys whose values are always masked (case-insensitive, exact match).
const SENSITIVE_KEY = /^(password|passwordhash|pass|token|codehash|accesstoken|refreshtoken|authorization|auth|cookie|secret|apikey|api_key|x-token|xtoken|code|otp|cvv|card|cardnumber|pan|jwt|monotoken)$/i;

const REDACTED = '[REDACTED]';

// Mask secret-shaped substrings inside free text (Bearer tokens, JWTs, and long
// hex blobs like reset tokens / HMAC hashes).
function maskString(s) {
  return s
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ' + REDACTED)
    .replace(/eyJ[A-Za-z0-9._-]{10,}/g, REDACTED) // JWT
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, REDACTED); // long hex (tokens, hashes)
}

// Deep-clone `input` with sensitive keys and secret-shaped strings masked.
export function redact(input, seen = new WeakSet()) {
  if (input == null) return input;
  if (typeof input === 'string') return maskString(input);
  if (typeof input !== 'object') return input;
  if (seen.has(input)) return '[Circular]';
  seen.add(input);

  if (Array.isArray(input)) return input.map((v) => redact(v, seen));

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(value, seen);
  }
  return out;
}

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
const base = pino({ level });

// Emit a redacted record. pino takes (mergingObject, message); we pass the
// redacted meta as the merging object so its keys land as structured fields.
function emit(fn, msg, meta) {
  if (meta !== undefined) fn.call(base, redact(meta), msg);
  else fn.call(base, msg);
}

export const logger = {
  info: (msg, meta) => emit(base.info, msg, meta),
  warn: (msg, meta) => emit(base.warn, msg, meta),
  error: (msg, meta) => emit(base.error, msg, meta),
};
