import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { initTracking } from './realtime/tracking.js';

const app = createApp();
const PORT = process.env.PORT || 4000;

// Wrap Express in an HTTP server so socket.io can share the same port.
const server = http.createServer(app);

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
initTracking(server, corsOrigins);

server.listen(PORT, () => {
  console.log(`🔥 Ohnyk backend listening on http://localhost:${PORT} (with realtime tracking)`);
});
