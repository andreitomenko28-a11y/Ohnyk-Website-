import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Local-disk storage for uploaded media. Files land under backend/uploads and
// are served statically at /uploads/* (see app.js). The public URL we persist
// is a relative path, so swapping to S3/GCS later only means changing this file
// (return the CDN URL instead) — no schema or controller changes needed.
//
// NOTE: in an ephemeral container the uploads dir is not durable. For
// production, back this with object storage. The abstraction below is the
// single seam where that swap happens.

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function randomName(ext) {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
}

// Resize + re-encode an image buffer to webp and store it under
// uploads/<folder>/. Returns the public relative URL (e.g. /uploads/dishes/x.webp).
export async function saveImage(buffer, folder, { width = 1280, quality = 82 } = {}) {
  const dir = path.join(UPLOAD_ROOT, folder);
  await ensureDir(dir);
  const filename = randomName('webp');
  const processed = await sharp(buffer)
    .rotate() // respect EXIF orientation
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  await fs.writeFile(path.join(dir, filename), processed);
  return `/uploads/${folder}/${filename}`;
}

// Public assets (dish/cook/kitchen media) are served statically at /uploads/*.
// Private documents (identity, verification) are NEVER served statically —
// they are streamed through the authenticated /api/documents route instead.
export const PUBLIC_PREFIX = '/uploads/';
export const PRIVATE_PREFIX = '/api/documents/';

// Store a non-image document (e.g. an ID scan or a medical book PDF/JPG) as-is.
// Pass { private: true } for sensitive PII, which returns a /api/documents URL
// so access is gated by the documents route rather than the public static mount.
export async function saveDocument(buffer, folder, originalName, { private: isPrivate = false } = {}) {
  const dir = path.join(UPLOAD_ROOT, folder);
  await ensureDir(dir);
  const ext = (path.extname(originalName || '').replace('.', '') || 'bin').toLowerCase();
  const filename = randomName(ext);
  await fs.writeFile(path.join(dir, filename), buffer);
  return `${isPrivate ? PRIVATE_PREFIX : PUBLIC_PREFIX}${folder}/${filename}`;
}

// Resolve a private document URL to a safe absolute path under UPLOAD_ROOT.
// Returns null if the URL is malformed or would escape the upload root
// (path-traversal guard).
export function privateDocPath(folder, name) {
  if (!folder || !name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  const abs = path.join(UPLOAD_ROOT, folder, name);
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return abs;
}

// Best-effort delete of a previously stored file by its public or private URL.
export async function deleteByUrl(url) {
  if (!url) return;
  const rel = url.startsWith(PUBLIC_PREFIX)
    ? url.slice(PUBLIC_PREFIX.length)
    : url.startsWith(PRIVATE_PREFIX)
      ? url.slice(PRIVATE_PREFIX.length)
      : null;
  if (!rel) return;
  try {
    await fs.unlink(path.join(UPLOAD_ROOT, rel));
  } catch {
    // ignore — file may already be gone
  }
}

export { UPLOAD_ROOT };
