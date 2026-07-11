import { createContext, useContext, useState, useCallback } from 'react';

// Ukrainian / English dictionary for Phase 1 screens.
export const dict = {
  uk: {
    tag: 'Домашня кухня твого району',
    tabLogin: 'Вхід',
    tabRegister: 'Реєстрація',
    emailOrPhone: 'Email або телефон',
    email: 'Email',
    password: 'Пароль',
    loginBtn: 'Увійти',
    forgot: 'Забули пароль?',
    roleLabel: 'Хто ти?',
    roleBuyer: 'Покупець',
    roleBuyerSub: 'хочу замовляти',
    roleCook: 'Кухар',
    roleCookSub: 'хочу готувати',
    name: 'Ім’я',
    phone: 'Телефон',
    registerBtn: 'Створити акаунт',
    terms: 'Реєструючись, ти приймаєш умови користування',
    // Home
    hi: 'Привіт',
    searchPlaceholder: 'Борщ, варенички, кухар...',
    popularCooks: 'Популярні кухарі',
    cookingToday: 'Готують сьогодні',
    seeAll: 'Усі →',
    navHome: 'Головна',
    navSearch: 'Пошук',
    navCart: 'Кошик',
    navProfile: 'Профіль',
    logout: 'Вийти',
    loading: 'Завантаження...',
    pwHint: 'Мінімум 8 символів',
  },
  en: {
    tag: 'Home cooking from your neighbourhood',
    tabLogin: 'Login',
    tabRegister: 'Sign up',
    emailOrPhone: 'Email or phone',
    email: 'Email',
    password: 'Password',
    loginBtn: 'Log in',
    forgot: 'Forgot password?',
    roleLabel: 'Who are you?',
    roleBuyer: 'Buyer',
    roleBuyerSub: 'I want to order',
    roleCook: 'Cook',
    roleCookSub: 'I want to cook',
    name: 'Name',
    phone: 'Phone',
    registerBtn: 'Create account',
    terms: 'By signing up, you agree to the terms of service',
    // Home
    hi: 'Hi',
    searchPlaceholder: 'Borshch, dumplings, cook...',
    popularCooks: 'Popular cooks',
    cookingToday: 'Cooking today',
    seeAll: 'All →',
    navHome: 'Home',
    navSearch: 'Search',
    navCart: 'Cart',
    navProfile: 'Profile',
    logout: 'Log out',
    loading: 'Loading...',
    pwHint: 'At least 8 characters',
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ohnyk_lang') || 'uk');

  const changeLang = useCallback((next) => {
    setLang(next);
    localStorage.setItem('ohnyk_lang', next);
  }, []);

  const t = useCallback((key) => dict[lang][key] ?? key, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
