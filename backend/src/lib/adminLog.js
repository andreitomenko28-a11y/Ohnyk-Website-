import { prisma } from './prisma.js';

// Records an admin moderation action (Phase 7.1). Best-effort — a logging
// failure must never block the action itself.
export async function writeAdminLog({ adminId, action, targetType, targetId, meta }) {
  try {
    await prisma.adminLog.create({ data: { adminId, action, targetType, targetId, meta: meta ?? undefined } });
  } catch (err) {
    console.error('[adminLog] failed to record', action, err?.message);
  }
}
