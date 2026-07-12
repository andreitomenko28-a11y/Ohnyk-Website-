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
    // Discovery
    discoveryTitle: 'Кухарі поруч',
    allCategories: 'Все',
    filters: 'Фільтри',
    apply: 'Застосувати',
    reset: 'Скинути',
    priceRange: 'Ціна',
    minRating: 'Рейтинг від',
    cityLabel: 'Місто',
    from: 'від',
    verified: 'Перевірений',
    noResults: 'Нічого не знайдено',
    dishesCount: 'страв',
    // Cook profile & menu
    menu: 'Меню',
    unavailable: 'Немає в наявності',
    addToCart: 'Додати',
    inCart: 'У кошику',
    // Cart
    cartTitle: 'Кошик',
    cartEmpty: 'Кошик порожній',
    cartEmptyHint: 'Додайте страви від улюбленого кухаря',
    browseCooks: 'До кухарів',
    subtotal: 'Сума',
    delivery: 'Доставка',
    total: 'Разом',
    checkout: 'Оформити замовлення',
    checkoutSoon: 'Оформлення замовлення — у Фазі 4',
    clearCart: 'Очистити',
    remove: 'Видалити',
    // Profile
    profileTitle: 'Профіль',
    editProfile: 'Редагувати профіль',
    save: 'Зберегти',
    saved: 'Збережено',
    cancel: 'Скасувати',
    myAddresses: 'Мої адреси',
    bio: 'Про себе',
    photoUrl: 'Фото (URL)',
    // Addresses
    addressesTitle: 'Адреси',
    addAddress: 'Додати адресу',
    street: 'Вулиця',
    building: 'Будинок',
    apartment: 'Квартира',
    postalCode: 'Індекс',
    makeDefault: 'Зробити основною',
    defaultBadge: 'Основна',
    noAddresses: 'Ще немає збережених адрес',
    // Password reset
    resetTitle: 'Скидання пароля',
    resetHint: 'Вкажіть email — ми надішлемо код для скидання',
    sendCode: 'Надіслати код',
    resetCode: 'Код скидання',
    newPassword: 'Новий пароль',
    resetDone: 'Пароль змінено. Тепер увійдіть.',
    backToLogin: 'Повернутись до входу',
    // Favorites
    favorites: 'Обране',
    addFavorite: 'Додати в обране',
    removeFavorite: 'Прибрати з обраного',
    noFavorites: 'Ще немає обраних кухарів',
    // common
    back: 'Назад',
    error: 'Сталася помилка',
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
    // Discovery
    discoveryTitle: 'Cooks nearby',
    allCategories: 'All',
    filters: 'Filters',
    apply: 'Apply',
    reset: 'Reset',
    priceRange: 'Price',
    minRating: 'Rating from',
    cityLabel: 'City',
    from: 'from',
    verified: 'Verified',
    noResults: 'Nothing found',
    dishesCount: 'dishes',
    // Cook profile & menu
    menu: 'Menu',
    unavailable: 'Unavailable',
    addToCart: 'Add',
    inCart: 'In cart',
    // Cart
    cartTitle: 'Cart',
    cartEmpty: 'Your cart is empty',
    cartEmptyHint: 'Add dishes from your favourite cook',
    browseCooks: 'Browse cooks',
    subtotal: 'Subtotal',
    delivery: 'Delivery',
    total: 'Total',
    checkout: 'Checkout',
    checkoutSoon: 'Checkout arrives in Phase 4',
    clearCart: 'Clear',
    remove: 'Remove',
    // Profile
    profileTitle: 'Profile',
    editProfile: 'Edit profile',
    save: 'Save',
    saved: 'Saved',
    cancel: 'Cancel',
    myAddresses: 'My addresses',
    bio: 'About',
    photoUrl: 'Photo (URL)',
    // Addresses
    addressesTitle: 'Addresses',
    addAddress: 'Add address',
    street: 'Street',
    building: 'Building',
    apartment: 'Apartment',
    postalCode: 'Postal code',
    makeDefault: 'Make default',
    defaultBadge: 'Default',
    noAddresses: 'No saved addresses yet',
    // Password reset
    resetTitle: 'Password reset',
    resetHint: "Enter your email — we'll send a reset code",
    sendCode: 'Send code',
    resetCode: 'Reset code',
    newPassword: 'New password',
    resetDone: 'Password changed. You can log in now.',
    backToLogin: 'Back to login',
    // Favorites
    favorites: 'Favourites',
    addFavorite: 'Add to favourites',
    removeFavorite: 'Remove from favourites',
    noFavorites: 'No favourite cooks yet',
    // common
    back: 'Back',
    error: 'Something went wrong',
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
