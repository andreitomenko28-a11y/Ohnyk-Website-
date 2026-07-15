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
