// Runs in its own process (node --test spawns one per file), so a low
// RATE_LIMIT_MAX here doesn't affect the functional suite.
process.env.ADMIN_TOKEN = 'test-token';
process.env.RATE_LIMIT_MAX = '3';
delete process.env.SMTP_HOST;

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupApp } from './helpers.js';

let app;
let prisma;

before(async () => {
  ({ app, prisma } = await setupApp('test-ratelimit.db'));
});

after(async () => {
  await prisma.$disconnect();
});

test('POST /api/waitlist is throttled past RATE_LIMIT_MAX', async () => {
  // 3 allowed unique submissions…
  for (let i = 0; i < 3; i++) {
    const res = await request(app)
      .post('/api/waitlist')
      .send({
        name: 'User ' + i,
        phone: '+38067000000' + i,
        email: `rl${i}@example.com`,
        role: 'client',
      });
    assert.equal(res.status, 201, `submission ${i} should succeed`);
  }

  // …the 4th within the window is rate-limited.
  const blocked = await request(app)
    .post('/api/waitlist')
    .send({
      name: 'User 4',
      phone: '+380670000004',
      email: 'rl4@example.com',
      role: 'client',
    });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'rate_limited');
});
