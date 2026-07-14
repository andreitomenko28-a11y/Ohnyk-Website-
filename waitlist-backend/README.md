# Ohnyk Waitlist Backend

A small, **standalone** service that powers the waitlist form on the Ohnyk
landing page (`ohnyk-website.html`). It is fully independent from the main
Ohnyk application in `../backend` (that one uses Postgres) — this one uses
**SQLite** and has its own dependencies, migrations, and Docker setup.

**Stack:** Node.js + Express · Prisma + SQLite · nodemailer · express-rate-limit · zod

## What it does

- `POST /api/waitlist` — accepts a signup: `name`, `phone`, `email`, `role`
  (`client` | `cook`). Validates everything server-side, blocks duplicates
  (by phone **or** email), throttles spam (honeypot + rate limit), stores the
  entry, and emails the owner.
- `GET /api/waitlist` — token-protected CSV export of all entries.
- `GET /health` — liveness check.

## Quick start (local, without Docker)

```bash
cd waitlist-backend
cp .env.example .env          # then edit values (at least ADMIN_TOKEN)
npm install
npm run prisma:migrate        # creates data/waitlist.db and applies migrations
npm run dev                   # starts on http://localhost:4000
```

> **Note:** Prisma reads `DATABASE_URL` from the real environment before
> `.env`. If your shell already exports a `DATABASE_URL` (e.g. a Postgres URL
> from another project), prefix the command:
> `DATABASE_URL="file:../data/waitlist.db" npm run prisma:migrate`.

## Quick start (Docker Compose)

Runs the API in a container with a named volume holding the SQLite file, so
data survives restarts. Migrations are applied automatically on boot.

```bash
cd waitlist-backend
cp .env.example .env          # edit values
docker compose up --build
```

The API is then on `http://localhost:${PORT:-4000}`. This compose file is
separate from the repo-root `docker-compose.yml` (which is for the main app).

## Environment variables (`.env`)

| Variable        | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `PORT`          | HTTP port (default `4000`).                                    |
| `ADMIN_TOKEN`   | Bearer token required by `GET /api/waitlist`. Set a long one.  |
| `ALLOWED_ORIGIN`| CORS allow-list — the landing page origin(s), comma-separated. Empty = allow any (dev only). |
| `RATE_LIMIT_MAX`| Max `POST` submissions per IP per 15 min (default `5`).        |
| `DATABASE_URL`  | SQLite file path, e.g. `file:../data/waitlist.db`.             |
| `SMTP_HOST`     | SMTP server host. If unset, email notifications are skipped.   |
| `SMTP_PORT`     | SMTP port (`587` STARTTLS, `465` implicit TLS).               |
| `SMTP_USER`     | SMTP username.                                                 |
| `SMTP_PASS`     | SMTP password / app password.                                  |
| `SMTP_FROM`     | From address (optional; defaults to `SMTP_USER`).             |
| `NOTIFY_EMAIL`  | Where new-signup notifications are delivered.                  |

### Gmail SMTP example

Enable 2FA on the Google account, create an **App Password**, and use:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=<16-char app password>
NOTIFY_EMAIL=you@gmail.com
```

## API reference

### `POST /api/waitlist`

Request body (JSON):

```json
{
  "name": "Олена Коваль",
  "phone": "+380671234567",
  "email": "olena@example.com",
  "role": "client",
  "website": ""
}
```

- `role` must be `"client"` or `"cook"`.
- `website` is a **honeypot** — leave it empty. If filled, the request is
  silently accepted (`200`) but nothing is stored.
- Phone accepts human formatting (spaces, dashes, parentheses) and is
  normalised to E.164 before validation.

Responses:

| Status | Body                                                   | Meaning                          |
| ------ | ------------------------------------------------------ | -------------------------------- |
| `201`  | `{"ok":true}`                                          | Created.                         |
| `200`  | `{"ok":true}`                                          | Honeypot tripped (ignored).      |
| `400`  | `{"error":"validation","details":[{field,code}]}`     | Invalid input.                   |
| `409`  | `{"error":"duplicate","field":"email"｜"phone"}`       | Already on the waitlist.         |
| `429`  | `{"error":"rate_limited"}`                             | Too many submissions.            |
| `500`  | `{"error":"server_error"}`                             | Unexpected error.                |

### `GET /api/waitlist`

Requires `Authorization: Bearer <ADMIN_TOKEN>`. Returns `text/csv`
(`id,name,phone,email,role,createdAt`) as a downloadable attachment.
Returns `401` on a missing/incorrect token.

## curl examples

```bash
API=http://localhost:4000

# Valid signup
curl -X POST $API/api/waitlist -H "Content-Type: application/json" \
  -d '{"name":"Олена Коваль","phone":"+380671234567","email":"olena@example.com","role":"client"}'

# Duplicate (same email or phone) → 409
curl -X POST $API/api/waitlist -H "Content-Type: application/json" \
  -d '{"name":"Інша","phone":"+380990000000","email":"olena@example.com","role":"cook"}'

# Invalid input → 400
curl -X POST $API/api/waitlist -H "Content-Type: application/json" \
  -d '{"name":"","phone":"12345","email":"nope","role":"client"}'

# Export CSV (admin)
curl -H "Authorization: Bearer $ADMIN_TOKEN" $API/api/waitlist
```

## Deploying separately from the frontend

The landing page and this backend are meant to live on **different hosts**.

1. Deploy this service anywhere that runs Node or Docker (Railway, Render,
   Fly.io, a VPS, …). Set all `.env` variables in the host's dashboard.
   For a persistent SQLite file, mount a volume at `/app/data`.
2. Set `ALLOWED_ORIGIN` to the exact origin of the deployed landing page
   (e.g. `https://ohnyk.com`).
3. On the landing page, point the single JS constant at this backend's URL:

   ```js
   const WAITLIST_API = 'https://waitlist-api.your-host.com';
   ```

   That constant lives at the top of the page script — it's the only thing
   to change when the backend URL changes.
