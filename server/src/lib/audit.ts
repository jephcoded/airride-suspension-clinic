import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export function audit(userId: string | undefined, action: string, entity: string, entityId: string, details?: Prisma.InputJsonValue) {
  return prisma.auditLog.create({ data: { userId, action, entity, entityId, details } });
}
