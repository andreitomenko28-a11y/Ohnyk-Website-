import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import addressRoutes from './routes/addresses.js';
import cookRoutes from './routes/cooks.js';
import cookAccountRoutes from './routes/cook.js';
import adminRoutes from './routes/admin.js';
import categoryRoutes from './routes/categories.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { UPLOAD_ROOT } from './lib/storage.js';

// Builds the Express app. Kept separate from server.js so tests can import
// the app (via supertest) without binding a port.
export function createApp() {
  const app = express();

  // CORS — allow the frontend origin (comma-separated list supported).
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(cors({ origin: origins, credentials: true }));
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

  // Serve uploaded media (cook photos, dish photos, verification docs).
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
  app.use('/api/categories', categoryRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);

  // 404 + error handling.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
