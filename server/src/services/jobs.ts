import type { Prisma, RepairStage } from '@prisma/client';
import { getSettings } from './settings.js';
import { prisma } from '../lib/prisma.js';
import { STAGES } from '../lib/stages.js';
import { notFound } from '../lib/http.js';
import { notifyCustomer, pushUpdate } from './notify.js';
import { background } from '../lib/background.js';

export async function findJobOr404(repairId: string) {
  const job = await prisma.repairJob.findUnique({ where: { repairId: repairId.toUpperCase() }, include: { customer: true } });
  if (!job) throw notFound('Repair');
  return job;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export { DEFAULT_WARRANTY_TERMS } from './settings.js';

const FINISHED: RepairStage[] = ['READY_FOR_COLLECTION', 'DELIVERED', 'COMPLETED'];

/** Creates the warranty the first time a job is finished. Idempotent. */
export async function ensureWarranty(jobId: string, tx: Prisma.TransactionClient = prisma) {
  const existing = await tx.warranty.findUnique({ where: { jobId } });
  if (existing) return existing;
  const start = new Date();
  const [{ warrantyMonths, warrantyTerms, warrantyByComponent }, job] = await Promise.all([
    getSettings(),
    tx.repairJob.findUniqueOrThrow({ where: { id: jobId }, select: { component: true } }),
  ]);
  // Period set for this repair type in Settings, otherwise the default period.
  const months = warrantyByComponent?.[job.component] ?? warrantyMonths;
  return tx.warranty.create({
    data: {
      jobId,
      months,
      startDate: start,
      expiryDate: addMonths(start, months),
      terms: warrantyTerms,
    },
  });
}

/**
 * The single place where a job's stage changes: records the timeline entry,
 * sets lifecycle timestamps, creates the warranty on completion and notifies the customer.
 */
export async function changeStage(opts: {
  repairId: string;
  stage: RepairStage;
  note?: string;
  title?: string;
  userId?: string;
  visibleToCustomer?: boolean;
  notify?: boolean;
}) {
  const job = await findJobOr404(opts.repairId);
  const info = STAGES[opts.stage];
  const now = new Date();

  const data: Prisma.RepairJobUpdateInput = { stage: opts.stage };
  if (opts.stage === 'RECEIVED' && !job.receivedAt) data.receivedAt = now;
  if (FINISHED.includes(opts.stage) && !job.completedAt) data.completedAt = now;
  if (opts.stage === 'CANCELLED') {
    data.cancelledAt = now;
    data.cancelReason = opts.note;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const j = await tx.repairJob.update({ where: { id: job.id }, data, include: { customer: true } });
    await tx.statusHistory.create({
      data: {
        jobId: job.id,
        stage: opts.stage,
        title: opts.title ?? info.label,
        note: opts.note || info.customerMessage,
        visibleToCustomer: opts.visibleToCustomer ?? true,
        createdById: opts.userId,
      },
    });
    if (FINISHED.includes(opts.stage)) await ensureWarranty(job.id, tx);
    return j;
  });

  const shouldNotify = (opts.notify ?? info.notify) && (opts.visibleToCustomer ?? true);
  if (shouldNotify) {
    // Fire and forget: staff shouldn't wait on SMS/email gateways.
    background(notifyCustomer(updated, info.label, opts.note || info.customerMessage));
  } else if (opts.visibleToCustomer ?? true) {
    // Every visible step still reaches the customer's phone (push alerts cost nothing).
    background(pushUpdate(updated, info.label, opts.note || info.customerMessage));
  }
  return updated;
}
