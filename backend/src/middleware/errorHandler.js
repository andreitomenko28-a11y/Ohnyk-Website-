import { ZodError } from 'zod';

// 404 for unmatched routes.
export function notFound(req, res, next) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

// Central error handler — normalises Zod, Prisma and generic errors.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Помилка валідації',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  // Prisma unique-constraint violation (e.g. duplicate email/phone).
  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'поле';
    return res.status(409).json({ error: `Значення вже використовується: ${target}` });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
}

// Helper to throw HTTP errors with a status code.
export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
