# Ohnyk

> Домашня кухня твого району — маркетплейс, що з'єднує домашніх кухарів із покупцями поруч.

**Фаза 1 (Фундамент)** — авторизація (реєстрація покупця/кухаря, логін із JWT,
захищені endpoints) та застосунок на React у дизайн-системі Ohnyk.

**Фаза 2 (Discovery, Profile & Cart)** — управління профілем і адресами, скидання
пароля, каталог кухарів із пошуком та фільтрами, меню кухаря і кошик із
розрахунком суми (один кухар на кошик).

## Технічний стек

| Шар | Технологія |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js + Express |
| База даних | PostgreSQL |
| ORM | Prisma |
| Auth | JWT + bcrypt |
| Валідація | Zod |
| Dev-середовище | Docker Compose (Postgres + Adminer) |
| Мобільний застосунок | Capacitor (обгортка веб → iOS / Android) |

## Платформи

Один код — три поверхні:

- **Телефон (браузер)** — mobile-first макет, працює одразу за посиланням.
- **ПК / широкий екран** — адаптивно: на `lg`+ з'являється бічне меню (sidebar),
  а списки кухарів стають сіткою в кілька колонок. Мобільний вигляд не змінюється.
- **Нативний застосунок (iOS / Android)** — через **Capacitor** веб-збірка
  запаковується в нативну оболонку для App Store / Google Play.

### Збірка нативного застосунку

```bash
cd frontend
# 1) Зібрати веб, вказавши бойовий API (у native немає dev-проксі):
VITE_API_URL=https://api.your-domain npm run build

# 2) Один раз додати платформи (потрібні Xcode / Android Studio на вашій машині):
npx cap add ios
npx cap add android

# 3) Синхронізувати + відкрити нативний проєкт:
npm run cap:ios       # або: npm run cap:android
```

Далі в Xcode / Android Studio: підписати (signing), запустити на пристрої,
зробити archive і завантажити в App Store Connect / Play Console.

> Публікація потребує акаунтів **Apple Developer** (99 $/рік) та **Google Play**
> (25 $ одноразово). Нативні теки `ios/` та `android/` генеруються на вашій
> машині командою `cap add` (їх немає в цьому репозиторії за замовчуванням).

## Структура репозиторію

```
ohnyk/
├── frontend/     # React + Vite + Tailwind (Auth, Home, Discovery, CookProfile, Cart, Profile, Addresses)
├── backend/      # Express + Prisma + JWT (auth, users, addresses, cooks, categories, cart)
├── admin/        # заглушка (Фаза 7)
├── docker-compose.yml
└── README.md
```

## Швидкий старт

### 1. Підняти базу даних

```bash
docker compose up -d          # Postgres :5432, Adminer :8080
```

### 2. Backend

```bash
cd backend
cp .env.example .env          # за потреби змініть секрети
npm install
npm run prisma:migrate        # застосувати міграції (створить таблиці)
npm run seed                  # (опційно) демо-користувачі
npm run dev                   # http://localhost:4000
```

Демо-акаунти після `npm run seed` (пароль `password123`):
- Покупець: `andrii@example.com`
- Кухар: `oksana@example.com`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Vite проксіює `/api/*` на backend (`localhost:4000`), тож CORS у dev не заважає.

## API endpoints (Фаза 1)

### Auth
| Метод | Шлях | Опис |
|---|---|---|
| POST | `/api/auth/register` | Реєстрація (`role`: `CUSTOMER` \| `COOK`) |
| POST | `/api/auth/login` | Вхід (email або телефон) → JWT |
| POST | `/api/auth/refresh` | Оновлення access-токену |
| GET | `/api/auth/me` | Поточний користувач (захищено) |

### Users
| Метод | Шлях | Опис |
|---|---|---|
| GET | `/api/users/:id` | Профіль |
| PATCH | `/api/users/:id` | Редагування профілю (захищено, лише власник/admin) |

### Addresses
| Метод | Шлях | Опис |
|---|---|---|
| GET | `/api/addresses` | Список адрес користувача (захищено, аліас Фази 1) |
| POST | `/api/addresses` | Додати адресу (захищено) |
| DELETE | `/api/addresses/:id` | Видалити адресу (захищено) |

Health-check: `GET /api/health`.

## API endpoints (Фаза 2)

### Profile & Addresses
| Метод | Шлях | Опис |
|---|---|---|
| GET | `/api/users/profile` | Профіль поточного користувача (захищено) |
| PATCH | `/api/users/profile` | Редагувати профіль: ім'я, телефон, фото, (кухар) біо/місто |
| GET | `/api/users/addresses` | Список адрес (захищено) |
| POST | `/api/users/addresses` | Додати адресу |
| PATCH | `/api/users/addresses/:id` | Редагувати адресу |
| PUT | `/api/users/addresses/:id/default` | Зробити адресу основною |
| DELETE | `/api/users/addresses/:id` | Видалити адресу |
| POST | `/api/auth/password-reset` | Запит коду для скидання пароля |
| POST | `/api/auth/password-reset-confirm` | Підтвердження скидання (код + новий пароль) |

### Discovery & Search
| Метод | Шлях | Опис |
|---|---|---|
| GET | `/api/cooks` | Список кухарів (пагінація `limit`/`offset`) |
| GET | `/api/cooks/search` | Пошук за іменем/біо (`q`) |
| GET | `/api/cooks/filter` | Фільтр (`category`, `minPrice`, `maxPrice`, `minRating`, `city`) |
| GET | `/api/cooks/:id` | Профіль кухаря |
| GET | `/api/categories` | Категорії страв |

### Menu & Cart
| Метод | Шлях | Опис |
|---|---|---|
| GET | `/api/cooks/:cookId/menu` | Меню кухаря (згруповане за категоріями) |
| GET | `/api/cooks/:cookId/dishes` | Список страв (`category`, `available`) |
| GET | `/api/cart` | Кошик користувача (захищено) |
| POST | `/api/cart/add` | Додати страву (`dishId`, `quantity`) |
| PATCH | `/api/cart/:itemId` | Змінити кількість (0 = видалити) |
| DELETE | `/api/cart/:itemId` | Видалити позицію |
| DELETE | `/api/cart` | Очистити кошик |
| POST | `/api/cart/total` | Розрахувати суму (`deliveryFee`) |

> Правило кошика: один кошик = один кухар. Додавання страви іншого кухаря
> повертає `409`, поки кошик не очищено.

## Приклади запитів

```bash
# Реєстрація
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Андрій","email":"a@example.com","password":"password123","role":"CUSTOMER"}'

# Логін
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"a@example.com","password":"password123"}'

# Поточний користувач
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Тести

Проєкт має автоматичні тести: інтеграційні для API (Vitest + Supertest) і
компонентні для UI (Vitest + React Testing Library). Вони ганяються автоматично
на кожен push через GitHub Actions (`.github/workflows/ci.yml`).

### Backend (55 тестів)

Потрібна тестова база `ohnyk_test` (окрема від dev, дані затираються між тестами):

```bash
cd backend
# один раз створити тестову БД:
docker exec ohnyk-db createdb -U ohnyk ohnyk_test
npm test              # прогнати всі тести
npm run test:watch    # watch-режим
```

За замовчуванням тести беруть URL з `DATABASE_URL` і додають суфікс `_test`.
Можна задати явно через `TEST_DATABASE_URL`.

Покриває: register/login (email і телефон)/refresh/me, скидання пароля,
профіль і CRUD адрес (із default-логікою та перевіркою прав), каталог кухарів
(список/пошук/фільтри), категорії, меню, і повний цикл кошика (додавання,
накопичення кількості, правило одного кухаря, сума з доставкою).

### Frontend (21 тест)

```bash
cd frontend
npm test              # компонентні тести (jsdom)
```

Покриває: форми входу/реєстрації, вибір мови, показ помилок, токен-стор,
рендер каталогу і пошук (Discovery), картку кухаря з навігацією, і додавання
страви в кошик (DishCard).

### Claude Code на вебі — SessionStart hook

Для сесій Claude Code на вебі є хук `.claude/hooks/session-start.sh`, який
автоматично на старті сесії: встановлює залежності backend+frontend, генерує
Prisma-клієнт і піднімає локальний Postgres із базами `ohnyk` та `ohnyk_test`.
Тож `npm test` працює одразу, без ручного налаштування. У локальному середовищі
хук нічого не робить (гейт `CLAUDE_CODE_REMOTE`).

## Дизайн-система

| Токен | Значення |
|---|---|
| `--soot` | `#241E1B` |
| `--linen` | `#FAF3EA` |
| `--ember` | `#D46A3B` |
| `--ember-dark` | `#B8532A` |
| `--glow` | `#F2A65A` |

Шрифти: **Comfortaa** (заголовки/бренд), **Manrope** (текст).

### Теми (світла / темна)

Кольори винесені у семантичні CSS-змінні (`--bg`, `--surface`, `--elevated`,
`--fg`, `--muted`, `--ember`, `--star`…), які перемикаються за атрибутом
`data-theme` на `<html>`. **Темна** тема — основна; **світла** — похідна на тих
самих токенах. Вибір зберігається в `localStorage` і застосовується до першого
рендеру (без «мигання»). Перемкнути можна кнопкою 🌙/☀️ у шапці або сегментованим
перемикачем «Оформлення» у профілі.

## Definition of Done — Фаза 1

- [x] Користувач може зареєструватись як покупець або кухар
- [x] Логін повертає робочий JWT
- [x] Захищений endpoint `/api/auth/me` працює з токеном
- [x] Frontend має Login/Register форми у дизайн-системі Ohnyk
- [x] Локально піднімається (`docker compose up` + `npm run dev`)
- [x] Автоматичні тести (backend + frontend) і CI на GitHub Actions

## Definition of Done — Фаза 2

- [x] Користувач може редагувати профіль (ім'я, телефон, фото; кухар — біо/місто)
- [x] Користувач може управляти адресами (додати/редагувати/видалити/зробити основною)
- [x] Скидання пароля через код (два кроки)
- [x] Список кухарів із пошуком та фільтрами (категорія, ціна, рейтинг)
- [x] Меню конкретного кухаря, згруповане за категоріями
- [x] Додавання/зміна/видалення страв у кошику, правило «один кухар на кошик»
- [x] Коректний розрахунок суми кошика (+ доставка)
- [x] Автоматичні тести (backend 55 + frontend 21) і CI зелений

## Що далі

Замовлення та платежі — **Фаза 4**, доставка/кур'єри — **Фаза 5**,
real-time чат — **Фаза 6**, адмін-панель — **Фаза 7**.
