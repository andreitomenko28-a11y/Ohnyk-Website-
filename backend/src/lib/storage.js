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

// Store a non-image document (e.g. a verification permit PDF/JPG) as-is.
export async function saveDocument(buffer, folder, originalName) {
  const dir = path.join(UPLOAD_ROOT, folder);
  await ensureDir(dir);
  const ext = (path.extname(originalName || '').replace('.', '') || 'bin').toLowerCase();
  const filename = randomName(ext);
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

// Best-effort delete of a previously stored file by its public URL.
export async function deleteByUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const rel = url.replace('/uploads/', '');
  try {
    await fs.unlink(path.join(UPLOAD_ROOT, rel));
  } catch {
    // ignore — file may already be gone
  }
}

export { UPLOAD_ROOT };
