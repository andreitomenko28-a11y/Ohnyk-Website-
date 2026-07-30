import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { initRealtime } from './realtime/index.js';
import { assertSecureEnv } from './config/env.js';
import { migratePrivateUploads } from './lib/storage.js';

// Fail fast on insecure secrets before binding the port (throws in production).
assertSecureEnv();

// Relocate any ID scans still sitting inside the statically-served uploads dir.
// Best-effort and idempotent — it must not keep the server from starting.
migratePrivateUploads()
  .then((moved) => {
    if (moved.length) console.log(`🔒 Moved ${moved.length} private document(s) out of the static uploads dir`);
  })
  .catch(() => {});

const app = createApp();
const PORT = process.env.PORT || 4000;

// Wrap Express in an HTTP server so socket.io can share the same port.
const server = http.createServer(app);

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
initRealtime(server, corsOrigins);

server.listen(PORT, () => {
  console.log(`🔥 Ohnyk backend listening on http://localhost:${PORT} (with realtime: tracking + chat)`);
});
