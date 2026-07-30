import { promises as fs, existsSync } from 'node:fs';
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

// Private documents live OUTSIDE the statically-served root, not in a
// blocked-by-name folder inside it. Keeping them in `uploads/identity` and
// denying that URL prefix looked equivalent, but the deny ran on the raw path
// while express.static decodes it — `/uploads/%69dentity/x` and
// `/uploads//identity/x` both walked straight past the block and served the
// file unauthenticated. A path denylist in front of a static mount is always
// one encoding trick from failing; a separate directory cannot be reached by
// any spelling of the URL.
const PRIVATE_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads-private');

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
  const dir = path.join(isPrivate ? PRIVATE_UPLOAD_ROOT : UPLOAD_ROOT, folder);
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

// Resolve a path under a given root, or null if it would escape it.
// The single traversal guard for this module — every path built from a URL goes
// through it, so reading and deleting cannot disagree about what is in bounds.
function resolveUnder(root, ...segments) {
  if (segments.some((s) => !s)) return null;
  const abs = path.resolve(root, ...segments);
  return abs.startsWith(root + path.sep) ? abs : null;
}

// Resolve a private document URL to a safe absolute path.
// Returns null if the URL is malformed or would escape the root.
//
// Falls back to the old in-uploads location so documents stored before private
// files moved out are still readable through /api/documents. Those files are
// relocated at startup (migratePrivateUploads), so the fallback only covers a
// process that has not restarted yet.
export function privateDocPath(folder, name) {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  const current = resolveUnder(PRIVATE_UPLOAD_ROOT, folder, name);
  if (current && existsSync(current)) return current;
  // Existence decides, not resolution order: resolveUnder answers for any name,
  // so returning the private path unconditionally would hide legacy files that
  // have not been migrated yet behind a 404.
  const legacy = resolveUnder(UPLOAD_ROOT, folder, name);
  if (legacy && existsSync(legacy)) return legacy;
  return current;
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
  if (!rel) return;
  // A private URL points at the private root; try the legacy location too, for
  // documents stored before the move.
  const roots = url.startsWith(PRIVATE_PREFIX) ? [PRIVATE_UPLOAD_ROOT, UPLOAD_ROOT] : [UPLOAD_ROOT];
  for (const root of roots) {
    const abs = resolveUnder(root, rel);
    if (!abs) continue;
    try {
      await fs.unlink(abs);
      return;
    } catch {
      // keep trying the next root; the file may already be gone
    }
  }
}

// Relocate documents written before private files moved out of the static tree.
// Idempotent and best-effort: a failure here must not stop the server, it only
// means those files stay where the (still present) URL-prefix block guards them.
export async function migratePrivateUploads() {
  const moved = [];
  for (const folder of PRIVATE_FOLDERS) {
    const from = path.join(UPLOAD_ROOT, folder);
    const to = path.join(PRIVATE_UPLOAD_ROOT, folder);
    let names;
    try {
      names = await fs.readdir(from);
    } catch {
      continue; // nothing stored in the old location
    }
    if (names.length === 0) continue;
    await ensureDir(to);
    for (const name of names) {
      try {
        await fs.rename(path.join(from, name), path.join(to, name));
        moved.push(`${folder}/${name}`);
      } catch {
        // leave it; the URL-prefix block still covers it
      }
    }
  }
  return moved;
}

// True when a request path under /uploads resolves into a private folder.
//
// Decodes and normalises first: the old check compared the raw path, so
// `/uploads/%69dentity/x`, `/uploads//identity/x` and `/uploads/./identity/x`
// all slipped past it and were then served by express.static, which decodes.
export function isPrivateUploadPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath || '');
  } catch {
    return true; // undecodable — refuse rather than guess
  }
  const normalised = path.posix.normalize(decoded.replace(/\\/g, '/')).replace(/^\/+/, '');
  const top = normalised.split('/')[0].toLowerCase();
  return PRIVATE_FOLDERS.includes(top);
}

export { UPLOAD_ROOT, PRIVATE_UPLOAD_ROOT, PRIVATE_FOLDERS };
