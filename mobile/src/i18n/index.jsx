// i18n for the mobile app — same public API as the web provider
// (`useI18n() -> { lang, setLang, t }`) so screens port across with no rewrite.
//
// Wording is kept identical to frontend/src/i18n/index.jsx for every shared
// key. This dictionary intentionally starts with what the navigation shell
// needs and grows per module, rather than copying all ~690 web strings up
// front — most of them belong to screens that don't exist here yet.
//
// Persistence of the chosen language lands in Module 8.2 together with
// SecureStore/AsyncStorage; for now the choice lives in memory.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const dict = {
  uk: {
    // Brand / shell
    tag: 'Домашнє тепло у кожній страві',
    loading: 'Завантаження...',
    error: 'Сталася помилка',
    cancel: 'Скасувати',
    save: 'Зберегти',
    retry: 'Спробувати ще раз',
    logout: 'Вийти',

    // Auth (screens arrive in Module 8.2)
    tabLogin: 'Вхід',
    tabRegister: 'Реєстрація',

    // Buyer tabs
    navHome: 'Головна',
    navSearch: 'Пошук',
    navCart: 'Кошик',
    navOrders: 'Замовлення',
    navProfile: 'Профіль',

    // Cook tabs
    navCookOrders: 'Замовлення',
    navCookMenu: 'Меню',
    navCookReviews: 'Відгуки',

    // Courier
    navCourier: 'Доставка',

    // Placeholder copy for the shell (removed as real screens land)
    comingSoon: 'Екран зʼявиться в наступному модулі',
  },
  en: {
    tag: 'Home warmth in every dish',
    loading: 'Loading...',
    error: 'Something went wrong',
    cancel: 'Cancel',
    save: 'Save',
    retry: 'Try again',
    logout: 'Log out',

    tabLogin: 'Login',
    tabRegister: 'Sign up',

    navHome: 'Home',
    navSearch: 'Search',
    navCart: 'Cart',
    navOrders: 'Orders',
    navProfile: 'Profile',

    navCookOrders: 'Orders',
    navCookMenu: 'Menu',
    navCookReviews: 'Reviews',

    navCourier: 'Delivery',

    comingSoon: 'This screen arrives in the next module',
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children, initialLang = 'uk' }) {
  const [lang, setLang] = useState(initialLang);

  const t = useCallback((key) => dict[lang]?.[key] ?? dict.uk[key] ?? key, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
