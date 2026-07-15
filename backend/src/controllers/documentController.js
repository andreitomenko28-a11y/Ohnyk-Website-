import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { privateDocPath, PRIVATE_PREFIX } from '../lib/storage.js';

// Only these two folders hold private PII (ID scans, medical books).
const ALLOWED_FOLDERS = new Set(['identity', 'verification']);

// GET /api/documents/:folder/:name — stream a private cook document.
// Access is limited to an ADMIN (review queue) or the cook who owns it.
export async function getDocument(req, res, next) {
  try {
    const { folder, name } = req.params;
    if (!ALLOWED_FOLDERS.has(folder)) throw httpError(404, 'Документ не знайдено');

    const url = `${PRIVATE_PREFIX}${folder}/${name}`;
    const cook = await prisma.cook.findFirst({
      where: { OR: [{ identityDocUrl: url }, { verificationDocUrl: url }] },
      select: { userId: true },
    });
    if (!cook) throw httpError(404, 'Документ не знайдено');

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = cook.userId === req.user.id;
    if (!isAdmin && !isOwner) throw httpError(403, 'Недостатньо прав');

    const abs = privateDocPath(folder, name);
    if (!abs) throw httpError(404, 'Документ не знайдено');

    res.sendFile(abs, (err) => {
      if (err && !res.headersSent) next(httpError(404, 'Документ не знайдено'));
    });
  } catch (err) {
    next(err);
  }
}
