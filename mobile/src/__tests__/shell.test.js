// Module 8.1 — navigation-shell foundations.
//
// These cover the pieces that are easy to get subtly wrong and that every
// later module builds on: the React Navigation 7 theme contract, the i18n
// fallback chain, and API base-URL resolution.

import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { dark, light, palettes } from '../theme/tokens.js';
import { dict } from '../i18n/index.jsx';

describe('theme tokens', () => {
  it('exposes the same keys for both palettes (no undefined colours on toggle)', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(palettes).toEqual({ dark, light });
  });

  it('matches the web build accent and background values', () => {
    // Ported from frontend/src/styles/index.css — drift here means the two
    // clients stop looking like one product.
    expect(dark.bg).toBe('#0e0e0f');
    expect(dark.ember).toBe('#ea6a2e');
    expect(light.bg).toBe('#faf3ea');
    expect(light.ember).toBe('#d46a3b');
  });
});

describe('React Navigation theme contract (v7)', () => {
  // v7 made `fonts` part of Theme; a theme built from scratch without it
  // crashes at render time. Our provider must spread the library defaults.
  it('library defaults carry a fonts block we must preserve', () => {
    expect(DefaultTheme.fonts).toBeDefined();
    expect(DarkTheme.fonts).toBeDefined();
  });

  it('accepts exactly the six documented colour keys', () => {
    expect(Object.keys(DefaultTheme.colors).sort()).toEqual(
      ['background', 'border', 'card', 'notification', 'primary', 'text'].sort(),
    );
  });
});

describe('i18n dictionary', () => {
  it('defines every uk key in en too (no half-translated UI)', () => {
    expect(Object.keys(dict.en).sort()).toEqual(Object.keys(dict.uk).sort());
  });

  it('covers the navigation labels the shell renders', () => {
    for (const key of ['navHome', 'navSearch', 'navCart', 'navOrders', 'navProfile']) {
      expect(dict.uk[key]).toBeTruthy();
      expect(dict.en[key]).toBeTruthy();
    }
  });
});

describe('API base URL resolution', () => {
  const ORIGINAL = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = ORIGINAL;
    jest.resetModules();
  });

  it('prefers EXPO_PUBLIC_API_URL and strips a trailing slash', () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = 'https://api.ohnyk.app/';
    const env = require('../config/env.js');
    expect(env.API_ORIGIN).toBe('https://api.ohnyk.app');
    expect(env.API_URL).toBe('https://api.ohnyk.app/api');
    // Sockets connect to the origin, not the /api prefix.
    expect(env.SOCKET_URL).toBe('https://api.ohnyk.app');
  });
});
