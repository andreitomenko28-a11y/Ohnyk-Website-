import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { globalLimiter } from './middleware/rateLimit.js';
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
import { UPLOAD_ROOT } from './lib/storage.js';

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

  // CORS — allow the frontend origin (comma-separated list supported).
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(cors({ origin: origins, credentials: true }));

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

  // Private PII (ID scans, medical books) must never be served statically —
  // block those folders and force access through the authenticated
  // /api/documents route below.
  app.use(['/uploads/identity', '/uploads/verification'], (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  // Serve public uploaded media (cook/dish/kitchen photos & videos).
  app.use('/uploads', express.static(UPLOAD_ROOT));

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
