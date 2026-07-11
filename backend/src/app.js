import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import addressRoutes from './routes/addresses.js';
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
  app.use(express.json());

  // Health check.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'ohnyk-backend', time: new Date().toISOString() });
  });

  // Routes.
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/addresses', addressRoutes);

  // 404 + error handling.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
