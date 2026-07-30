import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { request, registerUser, authHeader } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import {
  UPLOAD_ROOT,
  PRIVATE_UPLOAD_ROOT,
  migratePrivateUploads,
  privateDocPath,
  saveDocument,
} from '../src/lib/storage.js';

// ID scans and medical books are meant to be reachable only through the
// authenticated /api/documents route. Blocking `/uploads/identity` in front of
// express.static looked like it did that, but the block matched the raw path
// while express.static decodes it, so several spellings walked straight past.

const SECRET = 'ID-SCAN-CONTENTS';
let planted; // a file in the old, in-uploads location

beforeAll(async () => {
  await fs.mkdir(path.join(UPLOAD_ROOT, 'identity'), { recursive: true });
  planted = `legacy-${Date.now()}.txt`;
  await fs.writeFile(path.join(UPLOAD_ROOT, 'identity', planted), SECRET);
});

afterAll(async () => {
  for (const root of [UPLOAD_ROOT, PRIVATE_UPLOAD_ROOT]) {
    await fs.rm(path.join(root, 'identity', planted), { force: true });
  }
});

describe('Private documents are never served statically', () => {
  // Every spelling that reaches the same file on disk. The first was already
  // blocked; the rest were not.
  const spellings = [
    ['plain', `/uploads/identity/`],
    ['percent-encoded first letter', `/uploads/%69dentity/`],
    ['double slash', `/uploads//identity/`],
    ['dot segment', `/uploads/./identity/`],
    ['encoded slash before the folder', `/uploads/%2Fidentity/`],
  ];

  for (const [name, prefix] of spellings) {
    it(`refuses ${name}`, async () => {
      const res = await request.get(prefix + planted);
      expect(res.status).not.toBe(200);
      expect(res.text ?? '').not.toContain(SECRET);
    });
  }

  it('still serves public media', async () => {
    await fs.mkdir(path.join(UPLOAD_ROOT, 'dishes'), { recursive: true });
    const name = `public-${Date.now()}.txt`;
    await fs.writeFile(path.join(UPLOAD_ROOT, 'dishes', name), 'public');
    const res = await request.get(`/uploads/dishes/${name}`);
    expect(res.status).toBe(200);
    await fs.rm(path.join(UPLOAD_ROOT, 'dishes', name), { force: true });
  });
});

describe('New private documents land outside the static root', () => {
  it('writes them to the private root, not under uploads/', async () => {
    const url = await saveDocument(Buffer.from(SECRET), 'identity', 'scan.pdf', { private: true });
    expect(url.startsWith('/api/documents/')).toBe(true);

    const name = url.split('/').pop();
    // On disk in the private root...
    await expect(fs.readFile(path.join(PRIVATE_UPLOAD_ROOT, 'identity', name), 'utf8')).resolves.toBe(SECRET);
    // ...and absent from the served one.
    await expect(fs.access(path.join(UPLOAD_ROOT, 'identity', name))).rejects.toThrow();

    // And unreachable through the static mount by any spelling.
    for (const prefix of ['/uploads/identity/', '/uploads/%69dentity/', '/uploads//identity/']) {
      const res = await request.get(prefix + name);
      expect(res.status).not.toBe(200);
    }

    await fs.rm(path.join(PRIVATE_UPLOAD_ROOT, 'identity', name), { force: true });
  });
});

describe('The startup migration moves legacy documents', () => {
  it('relocates them and keeps /api/documents working', async () => {
    // A cook who owns the legacy document, so the authenticated route resolves.
    const cook = await registerUser({
      role: 'COOK',
      phone: `+38063${Math.floor(1000000 + Math.random() * 8999999)}`,
      kitchenAddress: 'вул. Тестова, 1, Черкаси',
    });
    await prisma.cook.update({
      where: { id: cook.user.cook.id },
      data: { identityDocUrl: `/api/documents/identity/${planted}` },
    });

    // Readable through the authenticated route before the move...
    const before = await request
      .get(`/api/documents/identity/${planted}`)
      .set(authHeader(cook.accessToken));
    expect(before.status).toBe(200);

    const moved = await migratePrivateUploads();
    expect(moved).toContain(`identity/${planted}`);

    // ...gone from the static tree...
    await expect(fs.access(path.join(UPLOAD_ROOT, 'identity', planted))).rejects.toThrow();
    // ...and still readable by its owner afterwards.
    const after = await request
      .get(`/api/documents/identity/${planted}`)
      .set(authHeader(cook.accessToken));
    expect(after.status).toBe(200);
    expect(after.text).toContain(SECRET);

    // Running it again is a no-op rather than an error.
    expect(await migratePrivateUploads()).not.toContain(`identity/${planted}`);
  });
});

describe('privateDocPath keeps its traversal guard', () => {
  it('refuses names that try to climb out', () => {
    expect(privateDocPath('identity', '../../etc/passwd')).toBeNull();
    expect(privateDocPath('identity', 'a/b')).toBeNull();
    expect(privateDocPath('identity', '')).toBeNull();
    expect(privateDocPath('identity', 'ok.pdf')).toContain(path.join('identity', 'ok.pdf'));
  });
});
