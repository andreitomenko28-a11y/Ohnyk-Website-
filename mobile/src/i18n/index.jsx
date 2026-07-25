// i18n for the mobile app — same public API as the web provider
// (`useI18n() -> { lang, setLang, t }`) so screens port across with no rewrite.
//
// Wording is kept identical to frontend/src/i18n/index.jsx for every shared
// key. This dictionary intentionally starts with what the navigation shell
// needs and grows per module, rather than copying all ~690 web strings up
// front — most of them belong to screens that don't exist here yet.
//
// The chosen language lives in memory for now. It is not a credential, so it
// belongs in AsyncStorage rather than SecureStore — persisting it lands with
// the offline-cache work in Module 8.8.

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

    // Auth — wording matches the web dictionary key-for-key.
    tabLogin: 'Вхід',
    tabRegister: 'Реєстрація',
    emailOrPhone: 'Email або телефон',
    email: 'Email',
    password: 'Пароль',
    pwHint: 'Мінімум 8 символів',
    loginBtn: 'Увійти',
    registerBtn: 'Створити акаунт',
    name: 'Ім’я',
    phone: 'Телефон',
    terms: 'Реєструючись, ти приймаєш умови користування',
    roleLabel: 'Хто ти?',
    roleBuyer: 'Покупець',
    roleBuyerSub: 'хочу замовляти',
    roleCook: 'Кухар',
    roleCookSub: 'хочу готувати',
    roleCourier: 'Кур’єр',
    roleCourierSub: 'Доставляю',
    transportLabel: 'Транспорт',
    transportWALKING: 'Піший',
    transportBICYCLE: 'Велосипед',
    transportMOTORBIKE: 'Мотоцикл',
    transportCAR: 'Автомобіль',
    bio: 'Про себе',
    kitchenAddressLabel: 'Адреса кухні',
    cookKitchenPlaceholder: 'вул. Смілянська, 44, Черкаси',
    deliveryZoneLabel: 'Зона доставки',
    cookDeliveryPlaceholder: 'Центр, Митниця...',
    // Mobile-only: the web uses tabs, the app uses two screens.
    noAccount: 'Немає акаунта?',
    haveAccount: 'Вже маєш акаунт?',
    themeLight: 'Світла тема',
    themeDark: 'Темна тема',

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
    emailOrPhone: 'Email or phone',
    email: 'Email',
    password: 'Password',
    pwHint: 'At least 8 characters',
    loginBtn: 'Log in',
    registerBtn: 'Create account',
    name: 'Name',
    phone: 'Phone',
    terms: 'By signing up you accept the terms of use',
    roleLabel: 'Who are you?',
    roleBuyer: 'Buyer',
    roleBuyerSub: 'I want to order',
    roleCook: 'Cook',
    roleCookSub: 'I want to cook',
    roleCourier: 'Courier',
    roleCourierSub: 'I deliver',
    transportLabel: 'Transport',
    transportWALKING: 'On foot',
    transportBICYCLE: 'Bicycle',
    transportMOTORBIKE: 'Motorbike',
    transportCAR: 'Car',
    bio: 'About you',
    kitchenAddressLabel: 'Kitchen address',
    cookKitchenPlaceholder: '44 Smilyanska St, Cherkasy',
    deliveryZoneLabel: 'Delivery zone',
    cookDeliveryPlaceholder: 'Centre, Mytnytsia...',
    noAccount: 'No account?',
    haveAccount: 'Already have an account?',
    themeLight: 'Light theme',
    themeDark: 'Dark theme',

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
