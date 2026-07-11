#!/bin/bash
# Ohnyk — SessionStart hook for Claude Code on the web.
# Installs backend + frontend dependencies and provisions a local Postgres
# test database so `npm test` works in a fresh remote session.
set -euo pipefail

# Only run in the remote (web) environment; local dev already has deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
echo "[hook] Ohnyk setup starting in $ROOT"

# --- 1. Backend dependencies + Prisma client ---------------------------------
echo "[hook] installing backend dependencies…"
cd "$ROOT/backend"
npm install --no-audit --no-fund
npm run prisma:generate

# --- 2. Frontend dependencies -------------------------------------------------
echo "[hook] installing frontend dependencies…"
cd "$ROOT/frontend"
npm install --no-audit --no-fund

# --- 3. Best-effort local Postgres for backend tests -------------------------
# Backend tests need a database. This provisions a throwaway Postgres cluster
# and an `ohnyk_test` DB. It never fails the hook — frontend tests and installs
# still succeed even if Postgres is unavailable.
setup_test_db() {
  local pgbin pgdata
  pgbin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1)"
  if [ -z "$pgbin" ] || ! id postgres >/dev/null 2>&1; then
    echo "[hook] Postgres not available — skipping test DB (backend tests need a DB)."
    return 1
  fi

  pgdata=/tmp/ohnyk-pgdata
  # Start (or init then start) the cluster if it isn't already accepting connections.
  # initdb/pg_ctl cannot run as root, so run them as the postgres user; --auth=trust
  # then lets us drive psql directly over TCP without further su nesting.
  if ! "$pgbin/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    if [ ! -s "$pgdata/PG_VERSION" ]; then
      mkdir -p "$pgdata"
      chown postgres:postgres "$pgdata"
      chmod 700 "$pgdata"
      su postgres -c "$pgbin/initdb -D $pgdata -U postgres --auth=trust" >/tmp/ohnyk-initdb.log 2>&1
    fi
    su postgres -c "$pgbin/pg_ctl -D $pgdata -o '-p 5432 -k /tmp -c listen_addresses=127.0.0.1' -l /tmp/ohnyk-pg.log start" >/dev/null 2>&1 || true
    # Wait for readiness.
    for _ in $(seq 1 20); do
      "$pgbin/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && break
      sleep 1
    done
  fi
  "$pgbin/pg_isready" -h 127.0.0.1 -p 5432 >/dev/null 2>&1 || {
    echo "[hook] Postgres did not become ready — skipping test DB."
    return 1
  }

  # psql runs as root over TCP (trust auth) — no quote-nesting needed.
  local psql="$pgbin/psql -h 127.0.0.1 -p 5432 -U postgres -v ON_ERROR_STOP=1 -Atqc"
  # Ensure role exists (idempotent).
  if [ -z "$($psql "SELECT 1 FROM pg_roles WHERE rolname='ohnyk'")" ]; then
    $psql "CREATE USER ohnyk WITH PASSWORD 'ohnyk' SUPERUSER"
  fi
  # Ensure databases exist (idempotent).
  for db in ohnyk ohnyk_test; do
    if [ -z "$($psql "SELECT 1 FROM pg_database WHERE datname='$db'")" ]; then
      $psql "CREATE DATABASE $db OWNER ohnyk"
    fi
  done

  echo "[hook] Postgres ready (databases: ohnyk, ohnyk_test)."
  return 0
}

if setup_test_db; then
  # Persist DB URLs for the rest of the session.
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    {
      echo 'export DATABASE_URL="postgresql://ohnyk:ohnyk@127.0.0.1:5432/ohnyk?schema=public"'
      echo 'export TEST_DATABASE_URL="postgresql://ohnyk:ohnyk@127.0.0.1:5432/ohnyk_test?schema=public"'
    } >> "$CLAUDE_ENV_FILE"
  fi
  # Sync the dev database schema so the app is runnable immediately.
  cd "$ROOT/backend"
  DATABASE_URL="postgresql://ohnyk:ohnyk@127.0.0.1:5432/ohnyk?schema=public" \
    npx prisma db push --skip-generate >/dev/null 2>&1 || true
fi

echo "[hook] Ohnyk setup complete."
