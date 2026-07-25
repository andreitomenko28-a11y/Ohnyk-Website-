# Ohnyk — мобільний застосунок (Expo / React Native)

Нативний клієнт (iOS + Android) поверх того самого backend API, що й веб-версія.
Бізнес-логіка живе на бекенді — застосунок лише споживає REST + Socket.io.

**Стек:** Expo SDK 57 · React Native 0.86 · React 19 · React Navigation 7

---

## Швидкий старт

```bash
cd mobile
npm install
npm start          # Metro; далі "a" — Android, "i" — iOS
npm test           # jest-expo
```

Бекенд має бути піднятий окремо:

```bash
cd backend && npm run dev     # http://localhost:4000
```

### Куди застосунок стукає по API

Порядок визначення адреси (`src/config/env.js`):

1. `EXPO_PUBLIC_API_URL` — задай для staging/production збірок;
2. у dev — хост, з якого вже роздається Metro, з портом `4000`. Саме це
   дозволяє запускатися **на реальному телефоні** без ручного вписування IP
   (на пристрої `localhost` — це сам телефон, а не твій компʼютер);
3. `http://localhost:4000` — фолбек для симуляторів.

Для збірки під прод:

```bash
EXPO_PUBLIC_API_URL=https://api.ohnyk.app npx expo export
```

---

## Expo Go не підійде

Починаючи з модуля 8.3 потрібні нативні модулі (камера, фонова геолокація,
push, карти), яких немає в Expo Go. Потрібен **development build**:

```bash
npx expo install expo-dev-client
npx eas build --profile development --platform android
```

EAS Build також дозволяє збирати **iOS без Mac** — це основна причина, чому
обрано Expo, а не bare React Native.

---

## Структура

```
src/
  api/client.js        axios + Bearer + одноразовий refresh на 401 (дзеркало веб-клієнта)
  auth/AuthContext.jsx стан сесії; SecureStore підключається в модулі 8.2
  config/env.js        визначення адреси бекенду
  i18n/                uk/en, той самий API що у вебі: useI18n() -> { lang, setLang, t }
  navigation/          RootNavigator + дерева за ролями (покупець / кухар / курʼєр)
  theme/               токени, перенесені з frontend/src/styles/index.css
  screens/             екрани (наразі плейсхолдери поза auth)
  components/          спільні примітиви
```

### Навігація

`RootNavigator` дзеркалить вебові guard-и: без сесії видно лише auth-стек,
далі дерево обирається за `user.role` — тож жодному екрану не треба
захищатися самому.

### Тема

Токени перенесені **дослівно** з `frontend/src/styles/index.css`. Якщо
змінюєш палітру у вебі — онови `src/theme/tokens.js` (тест це стереже).

> React Navigation 7 вимагає в темі блок `fonts`, а `colors` приймає рівно
> шість ключів. Тому кастомна тема будується поверх `DefaultTheme`/`DarkTheme`,
> а не з нуля — інакше застосунок падає при рендері.

---

## Статус за модулями

| Модуль | Обсяг | Статус |
|---|---|---|
| 8.1 | Скаффолд, навігація, тема, i18n, HTTP-клієнт | ✅ |
| 8.2 | Auth: вхід/реєстрація, SecureStore, автологін | ⏳ |
| 8.3 | Кухар: профіль, CRUD страв, камера/галерея | ⏳ |
| 8.4 | Клієнт: каталог, кошик, checkout (MonoPay у WebView) | ⏳ |
| 8.5 | Курʼєр: GPS-трекінг | ⏳ |
| 8.6 | Карта (react-native-maps + OSM) | ⏳ |
| 8.7 | Push (Expo Notifications) | ⏳ |
| 8.8 | Офлайн-кеш (React Query + AsyncStorage) | ⏳ |

Веб-версія (`frontend/`) цими змінами не зачіпається.
