// Rotating refresh-token sessions.
//
// Refresh tokens live in the DB (hashed) as rotation families. On each refresh
// the presented token is rotated: the old one is marked used and a new one is
// issued in the same family. Presenting a token that is already used/revoked is
// treated as reuse (token theft) and revokes the whole family, so a stolen
// token survives at most until the legitimate client's next refresh.
//
// This keeps the token-in-localStorage model (works for web AND the Capacitor
// native app) while bounding the blast radius of an XSS-stolen refresh token.

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { signAccessToken, signRefreshToken } from './jwt.js';

const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Read the token's own expiry so the DB row matches the JWT exactly.
function expiryOf(token) {
  const decoded = jwt.decode(token);
  return decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + DEFAULT_REFRESH_MS);
}

// Access + refresh for a user. The refresh carries a random jti so two tokens
// minted in the same second are still distinct (no hash collision).
function mintTokens({ id, role }) {
  const base = { sub: id, role };
  return {
    accessToken: signAccessToken(base),
    refreshToken: signRefreshToken({ ...base, jti: crypto.randomUUID() }),
  };
}

function authError(message) {
  const e = new Error(message);
  e.status = 401;
  return e;
}

// Start a new session (login/register): a fresh rotation family.
export async function issueSession(user) {
  const tokens = mintTokens(user);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(tokens.refreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: expiryOf(tokens.refreshToken),
    },
  });
  return tokens;
}

// Rotate a presented refresh token. Throws a 401 on unknown/expired tokens and
// on reuse (after revoking the family). `user` needs only { id, role }.
export async function rotateSession(oldToken, user) {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(oldToken) } });
  if (!stored) throw authError('Недійсний refresh-токен');

  if (stored.revokedAt || stored.usedAt) {
    // Reuse of an already-rotated/revoked token — revoke the entire family.
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw authError('Сесію завершено з міркувань безпеки. Увійдіть знову.');
  }
  if (stored.expiresAt < new Date()) throw authError('Строк дії сесії вичерпано');

  const tokens = mintTokens(user);
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(tokens.refreshToken),
        familyId: stored.familyId, // stay in the same lineage
        expiresAt: expiryOf(tokens.refreshToken),
      },
    }),
  ]);
  return tokens;
}

// Revoke every live session a user holds, on every device.
//
// This is what a password reset needs: someone resets precisely because they
// think another person is in the account, and changing the password alone does
// not touch a refresh family already in that person's hands — it keeps rotating
// itself for the rest of its seven days.
//
// Takes a transaction client so the revocation commits together with the new
// password hash.
export async function revokeAllSessions(userId, db = prisma) {
  const { count } = await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

// Logout — revoke the presented token's whole family. Best-effort (unknown
// tokens are a no-op) so logout never errors.
export async function revokeSession(token) {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!stored) return;
  await prisma.refreshToken.updateMany({
    where: { familyId: stored.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
