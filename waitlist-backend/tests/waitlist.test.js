// Env must be set before the app/prisma modules are imported (in setupApp).
process.env.ADMIN_TOKEN = 'test-token';
process.env.RATE_LIMIT_MAX = '1000'; // effectively disable throttling here
process.env.ALLOWED_ORIGIN = 'https://ohnyk.example';
delete process.env.SMTP_HOST; // no real email in tests → mailer is skipped

import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setupApp } from './helpers.js';

let app;
let prisma;

const valid = {
  name: 'Олена Коваль',
  phone: '+380671234567',
  email: 'olena@example.com',
  role: 'client',
};

before(async () => {
  ({ app, prisma } = await setupApp('test-main.db'));
});

beforeEach(async () => {
  await prisma.waitlistEntry.deleteMany();
});

after(async () => {
  await prisma.$disconnect();
});

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('POST /api/waitlist creates an entry (201) and stores it', async () => {
  const res = await request(app).post('/api/waitlist').send(valid);
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, { ok: true });

  const rows = await prisma.waitlistEntry.findMany();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, 'olena@example.com');
  assert.equal(rows[0].role, 'client');
});

test('POST rejects a duplicate email (409, field=email)', async () => {
  await request(app).post('/api/waitlist').send(valid);
  const res = await request(app)
    .post('/api/waitlist')
    .send({ ...valid, phone: '+380990000000' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'duplicate');
  assert.equal(res.body.field, 'email');
  assert.equal(await prisma.waitlistEntry.count(), 1);
});

test('POST rejects a duplicate phone (409, field=phone)', async () => {
  await request(app).post('/api/waitlist').send(valid);
  const res = await request(app)
    .post('/api/waitlist')
    .send({ ...valid, email: 'other@example.com' });
  assert.equal(res.status, 409);
  assert.equal(res.body.field, 'phone');
  assert.equal(await prisma.waitlistEntry.count(), 1);
});

test('POST rejects invalid fields (400) with per-field codes', async () => {
  const res = await request(app)
    .post('/api/waitlist')
    .send({ name: '', phone: '12345', email: 'not-an-email', role: 'client' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'validation');
  const fields = res.body.details.map((d) => d.field);
  assert.ok(fields.includes('name'));
  assert.ok(fields.includes('phone'));
  assert.ok(fields.includes('email'));
  assert.equal(await prisma.waitlistEntry.count(), 0);
});

test('POST rejects an invalid role (400)', async () => {
  const res = await request(app)
    .post('/api/waitlist')
    .send({ ...valid, role: 'admin' });
  assert.equal(res.status, 400);
  assert.equal(res.body.details[0].code, 'role_invalid');
});

test('POST honeypot: filled "website" returns 200 but stores nothing', async () => {
  const res = await request(app)
    .post('/api/waitlist')
    .send({ ...valid, website: 'http://spam.example' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(await prisma.waitlistEntry.count(), 0);
});

test('POST normalises a human-formatted phone to E.164', async () => {
  const res = await request(app)
    .post('/api/waitlist')
    .send({ ...valid, phone: '+380 (63) 222-33-44', email: 'petro@example.com' });
  assert.equal(res.status, 201);
  const row = await prisma.waitlistEntry.findFirst();
  assert.equal(row.phone, '+380632223344');
});

test('POST lowercases the email', async () => {
  await request(app)
    .post('/api/waitlist')
    .send({ ...valid, email: 'MiXeD@Example.COM' });
  const row = await prisma.waitlistEntry.findFirst();
  assert.equal(row.email, 'mixed@example.com');
});

test('GET /api/waitlist without a token returns 401', async () => {
  const res = await request(app).get('/api/waitlist');
  assert.equal(res.status, 401);
});

test('GET /api/waitlist with a wrong token returns 401', async () => {
  const res = await request(app)
    .get('/api/waitlist')
    .set('Authorization', 'Bearer nope');
  assert.equal(res.status, 401);
});

test('GET /api/waitlist with the admin token returns CSV', async () => {
  await request(app).post('/api/waitlist').send(valid);
  const res = await request(app)
    .get('/api/waitlist')
    .set('Authorization', 'Bearer test-token');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.headers['content-disposition'], /waitlist\.csv/);
  const lines = res.text.trim().split('\r\n');
  assert.equal(lines[0], 'id,name,phone,email,role,createdAt');
  assert.ok(lines[1].includes('olena@example.com'));
});

test('CORS: allowed origin is echoed back', async () => {
  const res = await request(app)
    .post('/api/waitlist')
    .set('Origin', 'https://ohnyk.example')
    .send({ ...valid, email: 'cors-ok@example.com', phone: '+380671110000' });
  assert.equal(res.headers['access-control-allow-origin'], 'https://ohnyk.example');
});

test('CORS: a disallowed origin gets no allow-origin header', async () => {
  const res = await request(app)
    .post('/api/waitlist')
    .set('Origin', 'https://evil.example')
    .send({ ...valid, email: 'cors-no@example.com', phone: '+380671110001' });
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});
