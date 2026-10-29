import crypto from 'node:crypto';
import { prisma } from './prisma.js';

/** Atomically increments and returns the next value for a named counter. */
export async function nextSequence(key: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

/** ARC-2026-00125 — sequence restarts each year. */
export async function generateRepairId(date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const n = await nextSequence(`repair-${year}`);
  return `ARC-${year}-${String(n).padStart(5, '0')}`;
}

export async function generateReceiptNumber(date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const n = await nextSequence(`receipt-${year}`);
  return `RCT-${year}-${String(n).padStart(5, '0')}`;
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
