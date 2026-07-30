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

// Private document folders (served only via the authenticated /api/documents route).
const PRIVATE_FOLDERS = ['identity', 'verification'];

// Back-compat: rewrite a legacy public /uploads/(identity|verification)/… URL to
// the authenticated /api/documents/… form, so documents stored before private
// serving are still reachable. Non-private URLs pass through unchanged.
export function normalizeDocUrl(url) {
  if (!url || !url.startsWith(PUBLIC_PREFIX)) return url;
  const rel = url.slice(PUBLIC_PREFIX.length);
  return PRIVATE_FOLDERS.some((f) => rel.startsWith(`${f}/`)) ? `${PRIVATE_PREFIX}${rel}` : url;
}

// Resolve a path under UPLOAD_ROOT, or null if it would escape it.
// The single traversal guard for this module — every path built from a URL goes
// through it, so reading and deleting cannot disagree about what is in bounds.
function resolveUnderRoot(...segments) {
  if (segments.some((s) => !s)) return null;
  const abs = path.resolve(UPLOAD_ROOT, ...segments);
  return abs.startsWith(UPLOAD_ROOT + path.sep) ? abs : null;
}

// Resolve a private document URL to a safe absolute path under UPLOAD_ROOT.
// Returns null if the URL is malformed or would escape the upload root.
export function privateDocPath(folder, name) {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return resolveUnderRoot(folder, name);
}

// Best-effort delete of a previously stored file by its public or private URL.
//
// Guarded like privateDocPath: today every caller passes a URL this module
// produced, but an unguarded delete a few lines below a guarded read is a trap
// for whoever wires up the next caller.
export async function deleteByUrl(url) {
  if (!url) return;
  const rel = url.startsWith(PUBLIC_PREFIX)
    ? url.slice(PUBLIC_PREFIX.length)
    : url.startsWith(PRIVATE_PREFIX)
      ? url.slice(PRIVATE_PREFIX.length)
      : null;
  const abs = rel ? resolveUnderRoot(rel) : null;
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch {
    // ignore — file may already be gone
  }
}

export { UPLOAD_ROOT };
