import { describe, it, expect } from 'vitest';
import { request, registerCook, registerUser, createAdmin, authHeader } from './helpers.js';
import { normalizeDocUrl } from '../src/lib/storage.js';

// Box header helper: 4-byte size + a 4-char atom type, then payload.
const box = (type, ...rest) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from(type, 'ascii'), ...rest]);

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

    it('returns 404 (not 403) to a different user, so filenames can’t be enumerated', async () => {
      const { url } = await cookWithIdentityDoc();
      const stranger = await registerUser({ role: 'CUSTOMER' });
      const res = await request.get(url).set(authHeader(stranger.accessToken));
      expect(res.status).toBe(404); // indistinguishable from a missing file
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

    it('validates HEIC by its ftyp brand (no blanket bypass)', async () => {
      const cook = await registerCook();
      const realHeic = box('ftyp', Buffer.from('heic', 'ascii'));
      const fakeHeic = box('ftyp', Buffer.from('xxxx', 'ascii')); // wrong brand
      const ok = await request
        .post('/api/cook/verification/identity')
        .set(authHeader(cook.accessToken))
        .attach('document', realHeic, { filename: 'id.heic', contentType: 'image/heic' });
      expect(ok.status).toBe(201);
      const bad = await request
        .post('/api/cook/verification/identity')
        .set(authHeader(cook.accessToken))
        .attach('document', fakeHeic, { filename: 'spoof.heic', contentType: 'image/heic' });
      expect(bad.status).toBe(400);
    });

    it('accepts a valid video that leads with a non-ftyp atom, rejects random bytes', async () => {
      const cook = await registerCook();
      // Real .mov/.mp4 files may start with a 'wide'/'moov' box, not 'ftyp'.
      const realMov = box('wide', Buffer.alloc(16, 0));
      const ok = await request
        .post('/api/cook/kitchen/video')
        .set(authHeader(cook.accessToken))
        .attach('video', realMov, { filename: 'kitchen.mov', contentType: 'video/quicktime' });
      expect(ok.status).toBe(201);
      const bad = await request
        .post('/api/cook/kitchen/video')
        .set(authHeader(cook.accessToken))
        .attach('video', Buffer.from('not a video at all!!'), { filename: 'x.mp4', contentType: 'video/mp4' });
      expect(bad.status).toBe(400);
    });
  });

  describe('Fix #4 — legacy document URL normalization', () => {
    it('rewrites legacy /uploads private URLs to the /api/documents form', () => {
      expect(normalizeDocUrl('/uploads/identity/a.png')).toBe('/api/documents/identity/a.png');
      expect(normalizeDocUrl('/uploads/verification/b.pdf')).toBe('/api/documents/verification/b.pdf');
      // Public (non-private) and already-private URLs pass through unchanged.
      expect(normalizeDocUrl('/uploads/dishes/c.webp')).toBe('/uploads/dishes/c.webp');
      expect(normalizeDocUrl('/api/documents/identity/d.png')).toBe('/api/documents/identity/d.png');
      expect(normalizeDocUrl(null)).toBe(null);
    });
  });
});
