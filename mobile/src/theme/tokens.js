// Design tokens ported verbatim from the web build
// (frontend/src/styles/index.css :root / [data-theme='light']).
//
// Keep these in sync with the web values — the two clients are one brand.
// Native has no CSS variables, so the same palette lives here as plain objects
// and is handed to components through ThemeContext.

export const dark = {
  bg: '#0e0e0f',
  surface: '#1a1a1c',
  elevated: '#262628',
  line: 'rgba(255, 255, 255, 0.09)',
  fg: '#f5f4f2',
  muted: 'rgba(255, 255, 255, 0.5)',
  ember: '#ea6a2e',
  emberDark: '#c85526',
  glow: '#f2a65a',
  star: '#f5a623',
  onAccent: '#ffffff',
  brandInk: '#f6e8d4',
};

export const light = {
  bg: '#faf3ea',
  surface: '#ffffff',
  elevated: '#f3ece1',
  line: 'rgba(36, 30, 27, 0.1)',
  fg: '#241e1b',
  muted: 'rgba(36, 30, 27, 0.55)',
  ember: '#d46a3b',
  emberDark: '#b8532a',
  glow: '#f2a65a',
  star: '#e8912b',
  onAccent: '#ffffff',
  brandInk: '#2a211c',
};

export const palettes = { dark, light };

// Shared, theme-independent scales.
export const radius = { sm: 8, md: 12, lg: 16, card: 20, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
