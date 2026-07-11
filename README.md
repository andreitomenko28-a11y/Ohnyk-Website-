# Ohnyk 🔥

> Домашня кухня твого району — маркетплейс, що з'єднує домашніх кухарів із покупцями поруч.

Це **Фаза 1 (Фундамент)**: робочий скелет із авторизацією (реєстрація покупця/кухаря,
логін із JWT, захищені endpoints) та застосунок на React, стилізований під дизайн-систему Ohnyk.

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

## Структура репозиторію

```
ohnyk/
├── frontend/     # React + Vite + Tailwind (Login, Register, Home)
├── backend/      # Express + Prisma + JWT (auth, users, addresses)
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
| GET | `/api/addresses` | Список адрес користувача (захищено) |
| POST | `/api/addresses` | Додати адресу (захищено) |
| DELETE | `/api/addresses/:id` | Видалити адресу (захищено) |

Health-check: `GET /api/health`.

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

### Backend (28 тестів)

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

Покриває: register/login (email і телефон)/refresh/me, помилки валідації,
дублікати, заборону self-register як ADMIN, CRUD адрес із перевіркою прав,
редагування профілю лише власником.

### Frontend (13 тестів)

```bash
cd frontend
npm test              # компонентні тести (jsdom)
```

Покриває: рендер форм входу/реєстрації, перемикання вкладок і ролі, вибір мови,
відправку форм і показ помилок, логіку токен-стору та обробку помилок API.

## Дизайн-система

| Токен | Значення |
|---|---|
| `--soot` | `#241E1B` |
| `--linen` | `#FAF3EA` |
| `--ember` | `#D46A3B` |
| `--ember-dark` | `#B8532A` |
| `--glow` | `#F2A65A` |

Шрифти: **Comfortaa** (заголовки/бренд), **Manrope** (текст).

## Definition of Done — Фаза 1

- [x] Користувач може зареєструватись як покупець або кухар
- [x] Логін повертає робочий JWT
- [x] Захищений endpoint `/api/auth/me` працює з токеном
- [x] Frontend має Login/Register форми у дизайн-системі Ohnyk
- [x] Локально піднімається (`docker compose up` + `npm run dev`)
- [x] Автоматичні тести (backend + frontend) і CI на GitHub Actions

## Що далі

Меню, кошик, замовлення, платежі, чат, доставка — **Фази 2–6**.
Адмін-панель — **Фаза 7**.
