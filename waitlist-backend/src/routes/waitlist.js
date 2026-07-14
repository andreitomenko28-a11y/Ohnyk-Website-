import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { validateWaitlist } from '../lib/validate.js';
import { sendNewEntryNotification } from '../lib/mailer.js';

export const waitlistRouter = Router();

// Basic spam throttle: a handful of submissions per IP per window.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

// POST /api/waitlist — public signup endpoint.
waitlistRouter.post('/', submitLimiter, async (req, res) => {
  const parsed = validateWaitlist(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: 'validation', details: parsed.errors });
  }

  const { name, phone, email, role, website } = parsed.data;

  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if (website && website.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  try {
    // Pre-check gives a clean duplicate response; the unique constraint
    // below is the real guard against races.
    const existing = await prisma.waitlistEntry.findFirst({
      where: { OR: [{ phone }, { email }] },
    });
    if (existing) {
      const field = existing.email === email ? 'email' : 'phone';
      return res.status(409).json({ error: 'duplicate', field });
    }

    const entry = await prisma.waitlistEntry.create({
      data: { name, phone, email, role },
    });

    // Notify the owner, but never let a mail failure break signup.
    sendNewEntryNotification(entry).catch(() => {});

    return res.status(201).json({ ok: true });
  } catch (err) {
    // Unique-constraint violation from a concurrent duplicate.
    if (err && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target
        : [err.meta?.target];
      const field = target.includes('email') ? 'email' : 'phone';
      return res.status(409).json({ error: 'duplicate', field });
    }
    console.error('[waitlist] create failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

function csvCell(value) {
  const s = value == null ? '' : String(value);
  // Quote and escape per RFC 4180 when needed.
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// GET /api/waitlist — admin CSV export, guarded by a bearer token.
waitlistRouter.get('/', async (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  const header = req.get('authorization') || '';
  const provided = header.replace(/^Bearer\s+/i, '').trim();

  if (!token || provided !== token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const entries = await prisma.waitlistEntry.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const rows = [['id', 'name', 'phone', 'email', 'role', 'createdAt']];
  for (const e of entries) {
    rows.push([e.id, e.name, e.phone, e.email, e.role, e.createdAt.toISOString()]);
  }
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="waitlist.csv"');
  return res.send(csv);
});
