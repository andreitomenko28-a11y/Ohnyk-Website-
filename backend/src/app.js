import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import addressRoutes from './routes/addresses.js';
import cookRoutes from './routes/cooks.js';
import categoryRoutes from './routes/categories.js';
import cartRoutes from './routes/cart.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Builds the Express app. Kept separate from server.js so tests can import
// the app (via supertest) without binding a port.
export function createApp() {
  const app = express();

  // CORS — allow the frontend origin (comma-separated list supported).
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(cors({ origin: origins, credentials: true }));
  // Larger limit accommodates base64 avatar/dish images.
  app.use(express.json({ limit: '2mb' }));

  // Health check.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'ohnyk-backend', time: new Date().toISOString() });
  });

  // Routes.
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/addresses', addressRoutes); // back-compat alias (Phase 1)
  app.use('/api/cooks', cookRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/cart', cartRoutes);

  // 404 + error handling.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
