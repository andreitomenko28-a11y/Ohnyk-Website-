import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { globalLimiter } from './middleware/rateLimit.js';
import { corsOrigins } from './config/env.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import addressRoutes from './routes/addresses.js';
import cookRoutes from './routes/cooks.js';
import cookAccountRoutes from './routes/cook.js';
import adminRoutes from './routes/admin.js';
import documentRoutes from './routes/documents.js';
import categoryRoutes from './routes/categories.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import courierRoutes from './routes/courier.js';
import conversationRoutes from './routes/conversations.js';
import notificationRoutes from './routes/notifications.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { UPLOAD_ROOT, isPrivateUploadPath } from './lib/storage.js';

// Builds the Express app. Kept separate from server.js so tests can import
// the app (via supertest) without binding a port.
export function createApp() {
  const app = express();

  // Behind a reverse proxy (prod) the client IP is in X-Forwarded-For; without
  // this, rate limiting would bucket every request under the proxy's IP.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  }

  // Security headers (CSP, HSTS, X-Frame-Options, nosniff, …). The API serves
  // JSON + uploaded media, not HTML, so the restrictive CSP default is fine and
  // cross-origin resource loading is left enabled for the separate frontend.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS — reflect only origins on the explicit allow-list (comma-separated
  // CORS_ORIGIN; dev fallback to localhost). Requests with no Origin (curl,
  // server-to-server, same-origin) are allowed; a disallowed browser origin is
  // rejected. Production requires CORS_ORIGIN to be set (see assertSecureEnv).
  const origins = corsOrigins();
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || origins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }),
  );

  // Generic API-wide flood ceiling. Route-specific limiters (auth, upload,
  // order) are mounted on their routers for tighter, targeted limits.
  app.use('/api', globalLimiter);
  // Larger limit accommodates base64 avatar/dish images. Keep the raw bytes so
  // the payment webhook can verify the provider's signature over the exact body.
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // Private PII (ID scans, medical books) is not stored under UPLOAD_ROOT at
  // all (see lib/storage.js) — that, not this block, is what keeps it out of
  // the static mount. The block stays as a second line for anything left in the
  // old location before the startup migration runs, but it cannot be the only
  // one: it matches the raw path while express.static decodes it, so
  // `/uploads/%69dentity/x` and `/uploads//identity/x` walked past it.
  app.use('/uploads', (req, res, next) => {
    if (isPrivateUploadPath(req.path)) return res.status(404).json({ error: 'Not found' });
    next();
  });
  // Serve public uploaded media (cook/dish/kitchen photos & videos).
  app.use('/uploads', express.static(UPLOAD_ROOT, { dotfiles: 'deny', index: false }));

  // Health check.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'ohnyk-backend', time: new Date().toISOString() });
  });

  // Routes.
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/addresses', addressRoutes); // back-compat alias (Phase 1)
  app.use('/api/cooks', cookRoutes); // public discovery (plural)
  app.use('/api/cook', cookAccountRoutes); // authenticated cook's own account
  app.use('/api/admin', adminRoutes);
  app.use('/api/documents', documentRoutes); // authenticated private-doc access
  app.use('/api/categories', categoryRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/courier', courierRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/notifications', notificationRoutes);

  // 404 + error handling.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
