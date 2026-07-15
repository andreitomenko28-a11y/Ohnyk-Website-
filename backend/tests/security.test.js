import { describe, it, expect } from 'vitest';
import { request, registerCook, registerUser, createAdmin, authHeader } from './helpers.js';

// A buffer that begins with the PNG magic bytes (contents beyond the signature
// are irrelevant — documents are stored as-is).
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
// A buffer that is NOT a PNG (used to spoof the declared type).
const NOT_PNG = Buffer.from('this is definitely not a png file', 'utf8');

async function cookWithIdentityDoc() {
  const cook = await registerCook();
  const up = await request
    .post('/api/cook/verification/identity')
    .set(authHeader(cook.accessToken))
    .attach('document', PNG, { filename: 'id.png', contentType: 'image/png' });
  return { cook, url: up.body.cook.identityDocUrl };
}

describe('Security fixes', () => {
  describe('Fix #1 — private identity/verification documents', () => {
    it('stores identity docs behind the API, not the public /uploads mount', async () => {
      const { url } = await cookWithIdentityDoc();
      expect(url).toMatch(/^\/api\/documents\/identity\//);
    });

    it('blocks the public static route for the identity folder', async () => {
      const res = await request.get('/uploads/identity/anything.png');
      expect(res.status).toBe(404);
    });

    it('requires authentication to fetch a private document', async () => {
      const { url } = await cookWithIdentityDoc();
      const res = await request.get(url); // no token
      expect(res.status).toBe(401);
    });

    it('forbids a different user from fetching someone else’s document', async () => {
      const { url } = await cookWithIdentityDoc();
      const stranger = await registerUser({ role: 'CUSTOMER' });
      const res = await request.get(url).set(authHeader(stranger.accessToken));
      expect(res.status).toBe(403);
    });

    it('lets the owning cook and an admin fetch the document', async () => {
      const { cook, url } = await cookWithIdentityDoc();
      const owner = await request.get(url).set(authHeader(cook.accessToken));
      expect(owner.status).toBe(200);

      const admin = await createAdmin();
      const byAdmin = await request.get(url).set(authHeader(admin.accessToken));
      expect(byAdmin.status).toBe(200);
    });
  });

  describe('Fix #3 — upload content-type sniffing', () => {
    it('rejects a file whose bytes don’t match its declared type', async () => {
      const cook = await registerCook();
      const res = await request
        .post('/api/cook/verification/identity')
        .set(authHeader(cook.accessToken))
        .attach('document', NOT_PNG, { filename: 'fake.png', contentType: 'image/png' });
      expect(res.status).toBe(400);
    });

    it('accepts a genuine image', async () => {
      const cook = await registerCook();
      const res = await request
        .post('/api/cook/verification/identity')
        .set(authHeader(cook.accessToken))
        .attach('document', PNG, { filename: 'id.png', contentType: 'image/png' });
      expect(res.status).toBe(201);
    });
  });
});
