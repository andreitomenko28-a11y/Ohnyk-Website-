// The chosen interface language, kept across launches.
//
// AsyncStorage rather than SecureStore: this is a preference, not a
// credential, and reading it must not cost a keychain round-trip on startup.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANG_KEY = 'ohnyk.lang';

const SUPPORTED = ['uk', 'en'];

export function isSupportedLang(value) {
  return SUPPORTED.includes(value);
}

// Returns null when nothing usable is stored, so the caller keeps its default
// instead of falling back to a language the app cannot render.
export async function loadLang(storage = AsyncStorage) {
  try {
    const stored = await storage.getItem(LANG_KEY);
    return isSupportedLang(stored) ? stored : null;
  } catch {
    return null;
  }
}

// Best-effort: failing to remember the language must never break switching it.
export async function saveLang(lang, storage = AsyncStorage) {
  if (!isSupportedLang(lang)) return;
  try {
    await storage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}
