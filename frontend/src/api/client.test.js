import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStore, apiError } from './client.js';

describe('tokenStore', () => {
  beforeEach(() => localStorage.clear());

  it('stores and reads tokens', () => {
    tokenStore.set('access-1', 'refresh-1');
    expect(tokenStore.getAccess()).toBe('access-1');
    expect(tokenStore.getRefresh()).toBe('refresh-1');
  });

  it('clears tokens', () => {
    tokenStore.set('a', 'r');
    tokenStore.clear();
    expect(tokenStore.getAccess()).toBeNull();
    expect(tokenStore.getRefresh()).toBeNull();
  });

  it('does not overwrite existing tokens with undefined', () => {
    tokenStore.set('a', 'r');
    tokenStore.set(undefined, undefined);
    expect(tokenStore.getAccess()).toBe('a');
    expect(tokenStore.getRefresh()).toBe('r');
  });
});

describe('apiError', () => {
  it('prefers the server error message', () => {
    expect(apiError({ response: { data: { error: 'Boom' } } })).toBe('Boom');
  });

  it('falls back to the first validation detail', () => {
    const err = { response: { data: { details: [{ message: 'Bad field' }] } } };
    expect(apiError(err)).toBe('Bad field');
  });

  it('falls back to the error message', () => {
    expect(apiError(new Error('Network down'))).toBe('Network down');
  });

  it('has a final generic fallback', () => {
    expect(apiError({})).toBe('Сталася помилка');
  });
});
