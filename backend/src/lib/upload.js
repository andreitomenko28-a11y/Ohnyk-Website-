import multer from 'multer';
import { httpError } from '../middleware/errorHandler.js';

// Multer with in-memory storage: we hand the buffer to sharp/storage.js rather
// than letting multer write raw files to disk. Limits guard against oversized
// uploads (validation requirement).

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per image
const MAX_DOC_BYTES = 8 * 1024 * 1024; // 8 MB per document
const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB per video (kitchen tour)

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const DOC_MIME = new Set([...IMAGE_MIME, 'application/pdf']);
const VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);

function makeUploader(allowed, limitBytes, label) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limitBytes },
    fileFilter: (req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        return cb(httpError(400, `Непідтримуваний формат файлу (${label})`));
      }
      cb(null, true);
    },
  });
}

export const imageUpload = makeUploader(IMAGE_MIME, MAX_IMAGE_BYTES, 'фото');
export const docUpload = makeUploader(DOC_MIME, MAX_DOC_BYTES, 'документ');
export const videoUpload = makeUploader(VIDEO_MIME, MAX_VIDEO_BYTES, 'відео');

// --- Content sniffing -------------------------------------------------------
// multer's fileFilter only sees the client-declared Content-Type, which can be
// spoofed. verifyFileSignature inspects the actual bytes and rejects a file
// whose contents don't match its declared type (defence in depth on top of the
// MIME allowlist; images are additionally re-encoded by sharp).

function startsWith(buf, sig, offset = 0) {
  if (!buf || buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false;
  return true;
}

// Top-level atoms a valid ISO-BMFF / QuickTime file may start with. Real .mp4
// and .mov files don't always lead with 'ftyp' (older QuickTime, or a leading
// 'free'/'wide'/'skip' atom), so we accept any known container box at offset 4.
const ISOBMFF_ATOMS = new Set(['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide', 'pnot']);
// HEIC/HEIF share the ISO-BMFF 'ftyp' box; the major brand distinguishes them.
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevm', 'hevs', 'mif1', 'msf1', 'avif']);

function boxTypeAt(buffer, offset) {
  return buffer.length >= offset + 4 ? buffer.slice(offset, offset + 4).toString('ascii') : '';
}

function contentMatches(buffer, mime) {
  switch (mime) {
    case 'image/jpeg':
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && boxTypeAt(buffer, 8) === 'WEBP';
    case 'application/pdf':
      return startsWith(buffer, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'video/webm':
    case 'video/x-matroska':
      return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]); // EBML
    case 'video/mp4':
    case 'video/quicktime':
      // Accept any recognised container atom, not only a leading 'ftyp'.
      return ISOBMFF_ATOMS.has(boxTypeAt(buffer, 4));
    case 'image/heic':
    case 'image/heif':
      return boxTypeAt(buffer, 4) === 'ftyp' && HEIF_BRANDS.has(boxTypeAt(buffer, 8));
    // Fail closed: every MIME the allowlists permit is handled above, so an
    // unhandled type here means the content doesn't match its declared type.
    default:
      return false;
  }
}

// Middleware: run after a multer parser to reject spoofed content.
export function verifyFileSignature(req, res, next) {
  const files = req.file
    ? [req.file]
    : req.files
      ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
      : [];
  for (const f of files) {
    if (f?.buffer && !contentMatches(f.buffer, f.mimetype)) {
      return next(httpError(400, 'Вміст файлу не відповідає його типу'));
    }
  }
  next();
}

// Normalises multer's own errors (e.g. LIMIT_FILE_SIZE) into httpError so the
// central error handler returns a clean 400.
export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Файл завеликий'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Забагато файлів'
          : 'Помилка завантаження файлу';
    return next(httpError(400, msg));
  }
  next(err);
}
