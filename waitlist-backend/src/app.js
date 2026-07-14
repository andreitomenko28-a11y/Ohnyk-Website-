import express from 'express';
import cors from 'cors';
import { waitlistRouter } from './routes/waitlist.js';

export function createApp() {
  const app = express();

  // Trust the first proxy hop so rate-limiting sees the real client IP
  // behind common PaaS load balancers.
  app.set('trust proxy', 1);

  // Lock CORS to the configured frontend origin (comma-separated allowed).
  const allowed = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl / server-to-server (no Origin header).
        if (!origin) return cb(null, true);
        if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
    }),
  );

  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/waitlist', waitlistRouter);

  // JSON 404 for unknown routes.
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  return app;
}
