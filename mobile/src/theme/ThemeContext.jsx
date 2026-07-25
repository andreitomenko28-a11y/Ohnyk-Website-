// Theme provider. Dark is the default, matching the web build.
//
// Also exposes a React Navigation theme so navigator chrome (headers, tab bars,
// card backgrounds) follows the same palette. NOTE: React Navigation 7's Theme
// requires a `fonts` block and accepts exactly six colour keys — so we spread
// its DefaultTheme/DarkTheme and override only `colors`, rather than building a
// theme object from scratch (which crashes at render time).

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { palettes } from './tokens.js';

const ThemeContext = createContext(null);

function navigationTheme(mode, colors) {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.ember,
      background: colors.bg,
      card: colors.surface,
      text: colors.fg,
      border: colors.line,
      notification: colors.ember,
    },
  };
}

export function ThemeProvider({ children, initialMode = 'dark' }) {
  const [mode, setMode] = useState(initialMode);

  const toggleTheme = useCallback(() => {
    setMode((m) => (m === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => {
    const colors = palettes[mode];
    return { mode, colors, toggleTheme, navTheme: navigationTheme(mode, colors) };
  }, [mode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
