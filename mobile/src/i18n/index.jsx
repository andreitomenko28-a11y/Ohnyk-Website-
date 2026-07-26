// i18n for the mobile app — same public API as the web provider
// (`useI18n() -> { lang, setLang, t }`) so screens port across with no rewrite.
//
// Wording is kept identical to frontend/src/i18n/index.jsx for every shared
// key. This dictionary intentionally starts with what the navigation shell
// needs and grows per module, rather than copying all ~690 web strings up
// front — most of them belong to screens that don't exist here yet.
//
// The chosen language is remembered in AsyncStorage (offline/lang.js): it is a
// preference, not a credential, so it does not belong in SecureStore.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadLang, saveLang } from '../offline/lang.js';

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

    // Cook — profile, menu, dishes (Module 8.3)
    displayName: 'Назва кухні',
    cityLabel: 'Місто',
    savedNotice: 'Збережено',
    statusPending: 'На перевірці',
    statusVerified: 'Перевірено',
    statusRejected: 'Відхилено',
    cookNotOperating: 'Щоб приймати замовлення, заверши верифікацію',
    addPhoto: 'Додати фото',
    takePhoto: 'Зробити фото',
    chooseFromGallery: 'Обрати з галереї',
    permissionNeededTitle: 'Потрібен дозвіл',
    permissionCamera: 'Дозволь доступ до камери в налаштуваннях застосунку',
    permissionLibrary: 'Дозволь доступ до галереї в налаштуваннях застосунку',
    addDish: 'Додати страву',
    editDish: 'Редагувати страву',
    deleteDishTitle: 'Видалити страву?',
    delete: 'Видалити',
    noDishesYet: 'Страв ще немає',
    dishName: 'Назва страви',
    dishPrice: 'Ціна, ₴',
    dishDescription: 'Опис',
    dishCategory: 'Категорія',
    dishAvailable: 'Доступна для замовлення',
    dishUnavailable: 'Недоступна',
    dishPhotos: 'Фото',
    photoLongPressHint: 'Утримуй фото, щоб видалити',
    outOfPhase8: 'Поза межами Фази 8 — доступно у веб-версії',

    // Cook orders & reviews
    ordersActive: 'Активні',
    ordersAll: 'Усі',
    noOrdersYet: 'Замовлень ще немає',
    cookPayout: 'До виплати',
    cancelOrder: 'Скасувати замовлення',
    cancelOrderTitle: 'Скасувати замовлення?',
    status_AWAITING_PAYMENT: 'Очікує оплати',
    status_NEW: 'Нове',
    status_CONFIRMED: 'Підтверджено',
    status_PREPARING: 'Готується',
    status_READY: 'Готове',
    status_COURIER_ASSIGNED: 'Курʼєр призначений',
    status_PICKED_UP: 'Забрано',
    status_ON_THE_WAY: 'В дорозі',
    status_DELIVERED: 'Доставлено',
    status_CANCELLED: 'Скасовано',
    action_PREPARING: 'Почати готувати',
    action_READY: 'Страва готова',
    action_ON_THE_WAY: 'Виїхав',
    action_DELIVERED: 'Доставлено',
    delivery_PICKUP: 'Самовивіз',
    delivery_COOK_DELIVERY: 'Доставляє кухар',
    delivery_COURIER: 'Курʼєр',
    noReviewsYet: 'Відгуків ще немає',
    reviewsCount: 'відгуків',
    replyToReview: 'Відповісти',
    replyPlaceholder: 'Дякую за відгук!',
    yourReply: 'Ваша відповідь',
    edit: 'Змінити',

    // Buyer — catalogue, cart, checkout, payment (Module 8.4)
    popularCooks: 'Кухарі поруч',
    searchPlaceholder: 'Борщ, варенички, кухар...',
    noCooksFound: 'Кухарів не знайдено',
    priceFrom: 'від',
    goToCart: 'Перейти в кошик',
    cartEmpty: 'Кошик порожній',
    clearCart: 'Очистити кошик',
    subtotal: 'Сума',
    serviceFee: 'Сервісний збір',
    total: 'До сплати',
    checkout: 'Оформити',
    deliveryMethod: 'Спосіб отримання',
    deliveryAddress: 'Адреса доставки',
    orEnterAddress: 'Або введи адресу',
    addressPlaceholder: 'вул. Шевченка, 12, кв. 5',
    addressRequired: 'Вкажи адресу доставки',
    pickupHint: 'Забереш замовлення на кухні',
    deliveryTime: 'Час доставки',
    asSoonAsPossible: 'Якнайшвидше',
    orderNote: 'Коментар до замовлення',
    payBtn: 'Перейти до оплати',
    paymentTitle: 'Оплата',
    paymentChecking: 'Перевіряємо оплату...',
    paymentDone: 'Готово',
    paymentSuccess: 'Оплату отримано',
    paymentFailed: 'Оплата не пройшла',
    toOrders: 'До замовлень',
    paymentStubTitle: 'Тестовий режим оплати',
    paymentStubHint: 'MONO_TOKEN не налаштований, тож справжньої платіжної сторінки немає. Можна підтвердити оплату вручну.',
    paymentStubPay: 'Підтвердити оплату (тест)',

    // Courier — dashboard & GPS tracking (Module 8.5)
    courierOnline: 'Ви онлайн',
    courierOffline: 'Ви офлайн',
    courierOnlineHint: 'Онлайн — щоб бачити й брати замовлення',
    availableOrders: 'Доступні замовлення',
    noAvailableOrders: 'Наразі доступних замовлень немає',
    goOnlineToSee: 'Перейдіть онлайн, щоб бачити замовлення',
    claimOrder: 'Взяти замовлення',
    finishCurrentFirst: 'Спершу заверши поточну доставку',
    activeDelivery: 'Активна доставка',
    startTracking: 'Почати передачу',
    stopTracking: 'Зупинити',
    trackingOn: 'Місцезнаходження передається',
    trackingOff: 'Передача вимкнена',
    permissionLocation: 'Дозволь доступ до геолокації в налаштуваннях застосунку',
    locationForegroundOnlyTitle: 'Лише коли застосунок відкритий',
    locationForegroundOnly: 'Фоновий доступ не надано, тож місцезнаходження передаватиметься лише поки застосунок відкритий.',
    action_PICKED_UP: 'Забрав замовлення',

    // Map & live tracking (Module 8.6)
    trackTitle: 'Відстеження',
    trackOnMap: 'Стежити на карті',
    waitingForCourier: 'Очікуємо сигнал від курʼєра...',
    trackingLive: 'Позиція оновлюється наживо',
    lastSeen: 'Оновлено',
    minutesAgo: 'хв тому',
    trackForbidden: 'Це замовлення недоступне для відстеження',

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

    // Offline (Module 8.8)
    offlineNotice: 'Немає звʼязку — показані збережені дані',

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

    displayName: 'Kitchen name',
    cityLabel: 'City',
    savedNotice: 'Saved',
    statusPending: 'Pending review',
    statusVerified: 'Verified',
    statusRejected: 'Rejected',
    cookNotOperating: 'Finish verification to accept orders',
    addPhoto: 'Add photo',
    takePhoto: 'Take a photo',
    chooseFromGallery: 'Choose from gallery',
    permissionNeededTitle: 'Permission needed',
    permissionCamera: 'Allow camera access in the app settings',
    permissionLibrary: 'Allow photo library access in the app settings',
    addDish: 'Add dish',
    editDish: 'Edit dish',
    deleteDishTitle: 'Delete this dish?',
    delete: 'Delete',
    noDishesYet: 'No dishes yet',
    dishName: 'Dish name',
    dishPrice: 'Price, ₴',
    dishDescription: 'Description',
    dishCategory: 'Category',
    dishAvailable: 'Available to order',
    dishUnavailable: 'Unavailable',
    dishPhotos: 'Photos',
    photoLongPressHint: 'Long-press a photo to remove it',
    outOfPhase8: 'Outside Phase 8 — available on the web',

    ordersActive: 'Active',
    ordersAll: 'All',
    noOrdersYet: 'No orders yet',
    cookPayout: 'Your payout',
    cancelOrder: 'Cancel order',
    cancelOrderTitle: 'Cancel this order?',
    status_AWAITING_PAYMENT: 'Awaiting payment',
    status_NEW: 'New',
    status_CONFIRMED: 'Confirmed',
    status_PREPARING: 'Preparing',
    status_READY: 'Ready',
    status_COURIER_ASSIGNED: 'Courier assigned',
    status_PICKED_UP: 'Picked up',
    status_ON_THE_WAY: 'On the way',
    status_DELIVERED: 'Delivered',
    status_CANCELLED: 'Cancelled',
    action_PREPARING: 'Start cooking',
    action_READY: 'Dish is ready',
    action_ON_THE_WAY: 'On my way',
    action_DELIVERED: 'Delivered',
    delivery_PICKUP: 'Pickup',
    delivery_COOK_DELIVERY: 'Cook delivers',
    delivery_COURIER: 'Courier',
    noReviewsYet: 'No reviews yet',
    reviewsCount: 'reviews',
    replyToReview: 'Reply',
    replyPlaceholder: 'Thanks for the review!',
    yourReply: 'Your reply',
    edit: 'Edit',

    popularCooks: 'Cooks nearby',
    searchPlaceholder: 'Borscht, dumplings, a cook...',
    noCooksFound: 'No cooks found',
    priceFrom: 'from',
    goToCart: 'Go to cart',
    cartEmpty: 'Your cart is empty',
    clearCart: 'Clear cart',
    subtotal: 'Subtotal',
    serviceFee: 'Service fee',
    total: 'Total',
    checkout: 'Checkout',
    deliveryMethod: 'How to get it',
    deliveryAddress: 'Delivery address',
    orEnterAddress: 'Or type an address',
    addressPlaceholder: '12 Shevchenka St, apt. 5',
    addressRequired: 'Enter a delivery address',
    pickupHint: 'You will collect the order from the kitchen',
    deliveryTime: 'Delivery time',
    asSoonAsPossible: 'As soon as possible',
    orderNote: 'Order note',
    payBtn: 'Continue to payment',
    paymentTitle: 'Payment',
    paymentChecking: 'Checking the payment...',
    paymentDone: 'Done',
    paymentSuccess: 'Payment received',
    paymentFailed: 'Payment failed',
    toOrders: 'To orders',
    paymentStubTitle: 'Test payment mode',
    paymentStubHint: 'MONO_TOKEN is not configured, so there is no real payment page. You can confirm the payment manually.',
    paymentStubPay: 'Confirm payment (test)',

    courierOnline: 'You are online',
    courierOffline: 'You are offline',
    courierOnlineHint: 'Go online to see and claim orders',
    availableOrders: 'Available orders',
    noAvailableOrders: 'No available orders right now',
    goOnlineToSee: 'Go online to see orders',
    claimOrder: 'Claim order',
    finishCurrentFirst: 'Finish your current delivery first',
    activeDelivery: 'Active delivery',
    startTracking: 'Start sharing',
    stopTracking: 'Stop',
    trackingOn: 'Sharing your location',
    trackingOff: 'Location sharing is off',
    permissionLocation: 'Allow location access in the app settings',
    locationForegroundOnlyTitle: 'Only while the app is open',
    locationForegroundOnly: 'Background access was not granted, so your location will only be shared while the app is open.',
    action_PICKED_UP: 'Picked up',

    trackTitle: 'Tracking',
    trackOnMap: 'Track on map',
    waitingForCourier: 'Waiting for the courier signal...',
    trackingLive: 'Position updating live',
    lastSeen: 'Updated',
    minutesAgo: 'min ago',
    trackForbidden: 'This order is not available for tracking',

    navHome: 'Home',
    navSearch: 'Search',
    navCart: 'Cart',
    navOrders: 'Orders',
    navProfile: 'Profile',

    navCookOrders: 'Orders',
    navCookMenu: 'Menu',
    navCookReviews: 'Reviews',

    navCourier: 'Delivery',

    offlineNotice: 'No connection — showing saved data',

    comingSoon: 'This screen arrives in the next module',
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children, initialLang = 'uk' }) {
  const [lang, setLangState] = useState(initialLang);

  // Adopt the remembered choice once storage answers. Rendering starts on the
  // default rather than waiting: a blank first frame costs more than a label
  // that settles a moment later, and nothing below depends on the value.
  useEffect(() => {
    let active = true;
    loadLang().then((stored) => {
      if (active && stored) setLangState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback((next) => {
    setLangState(next);
    saveLang(next); // best-effort; failing to remember must not block the switch
  }, []);

  const t = useCallback((key) => dict[lang]?.[key] ?? dict.uk[key] ?? key, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
