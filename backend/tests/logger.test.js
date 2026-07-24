import { describe, it, expect } from 'vitest';
import { redact } from '../src/lib/logger.js';

// Module 4 (security) — log redaction. Guarantees secrets can't reach stdout
// through the shared logger.
describe('log redaction', () => {
  it('masks sensitive object keys at any depth', () => {
    const input = {
      email: 'a@b.com',
      password: 'hunter2',
      nested: { refreshToken: 'abc', authorization: 'Bearer x', codeHash: 'deadbeef' },
      list: [{ token: 't1' }, { safe: 'ok' }],
    };
    const out = redact(input);
    expect(out.email).toBe('a@b.com'); // non-sensitive passes through
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.refreshToken).toBe('[REDACTED]');
    expect(out.nested.authorization).toBe('[REDACTED]');
    expect(out.nested.codeHash).toBe('[REDACTED]');
    expect(out.list[0].token).toBe('[REDACTED]');
    expect(out.list[1].safe).toBe('ok');
  });

  it('masks secret-shaped substrings inside free text', () => {
    const jwt = 'eyJhbGciOiJIUzI1Ni{}.eyJzdWIiOiIx.abcDEF';
    const hex = 'a'.repeat(48); // reset-token / hash shape
    expect(redact(`token=${jwt}`)).toContain('[REDACTED]');
    expect(redact(`reset ${hex} here`)).toBe(`reset [REDACTED] here`);
    expect(redact('Authorization: Bearer abc.def-123')).toContain('Bearer [REDACTED]');
  });

  it('does not blow up on circular references', () => {
    const a = { name: 'x' };
    a.self = a;
    const out = redact(a);
    expect(out.name).toBe('x');
    expect(out.self).toBe('[Circular]');
  });

  it('leaves short non-secret strings and primitives untouched', () => {
    expect(redact('0000')).toBe('0000'); // dev SMS code, not secret-shaped
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
  });
});
