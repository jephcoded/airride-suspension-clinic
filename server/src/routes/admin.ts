import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../lib/audit.js';
import { badRequest, notFound } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { getSettings, saveSettings } from '../services/settings.js';
import { getSiteContent, imagesInUse, saveSiteContent } from '../services/siteContent.js';
import { upload } from '../middleware/upload.js';
import { deleteStored, discardUploads, persistUploads, verifyDirectUploads } from '../services/storage.js';

export const adminRouter = Router();

/** Management dashboard numbers. Advisors see it too so the front desk knows what's pending. */
adminRouter.get('/stats', requireRole('ADMIN', 'ADVISOR'), async (_req, res) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [total, completed, cancelled, revenueAll, revenueMonth, pendingQuotes, openClaims, newRequests, finished, approvedQuotes, recentPayments, byComponent] =
    await Promise.all([
      prisma.repairJob.count(),
      prisma.repairJob.count({ where: { stage: { in: ['COMPLETED', 'DELIVERED'] } } }),
      prisma.repairJob.count({ where: { stage: 'CANCELLED' } }),
      prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'SUCCESS', paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.quotation.count({ where: { status: { in: ['SENT', 'CLARIFICATION_REQUESTED'] } } }),
      prisma.warrantyClaim.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      prisma.repairJob.count({ where: { stage: 'REQUEST_SUBMITTED' } }),
      prisma.repairJob.findMany({
        where: { completedAt: { not: null }, receivedAt: { not: null } },
        select: { receivedAt: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 200,
      }),
      // Jobs with an approved quote that still owe money.
      prisma.quotation.findMany({
        where: { status: 'APPROVED', job: { paymentStatus: { in: ['AWAITING', 'PARTIAL'] }, stage: { not: 'CANCELLED' } } },
        select: { total: true, job: { select: { amountPaid: true } } },
      }),
      prisma.payment.findMany({
        where: { status: 'SUCCESS' },
        orderBy: { paidAt: 'desc' },
        take: 8,
        include: { job: { select: { repairId: true, customer: { select: { fullName: true } } } } },
      }),
      prisma.repairJob.groupBy({ by: ['component'], _count: true }),
    ]);

  const avgRepairDays = finished.length
    ? finished.reduce((s, j) => s + (j.completedAt!.getTime() - j.receivedAt!.getTime()), 0) / finished.length / 86400000
    : null;

  res.json({
    totalRepairs: total,
    inProgress: total - completed - cancelled,
    completed,
    cancelled,
    newRequests,
    revenue: revenueAll._sum.amount ?? 0,
    revenueThisMonth: revenueMonth._sum.amount ?? 0,
    pendingPayments: approvedQuotes.reduce((s, q) => s + Math.max(0, q.total - q.job.amountPaid), 0),
    pendingPaymentJobs: approvedQuotes.length,
    quotesAwaitingApproval: pendingQuotes,
    openWarrantyClaims: openClaims,
    avgRepairDays: avgRepairDays === null ? null : Math.round(avgRepairDays * 10) / 10,
    recentPayments: recentPayments.map((p) => ({
      amount: p.amount,
      paidAt: p.paidAt,
      channel: p.channel,
      receiptNumber: p.receiptNumber,
      repairId: p.job.repairId,
      customer: p.job.customer.fullName,
    })),
    byComponent: byComponent.map((g) => ({ component: g.component, count: g._count })),
  });
});

adminRouter.get('/warranty-claims', requireRole('ADMIN', 'ADVISOR'), async (_req, res) => {
  res.json(
    await prisma.warrantyClaim.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { warranty: { include: { job: { select: { repairId: true, customer: { select: { fullName: true, phone: true } } } } } } },
    }),
  );
});

// ---------- Staff accounts (admin only) ----------

adminRouter.use('/users', requireRole('ADMIN'));

adminRouter.get('/users', async (_req, res) => {
  res.json(
    await prisma.user.findMany({
      where: { role: { not: 'CUSTOMER' } },
      select: { id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  );
});

const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(['TECHNICIAN', 'ADVISOR', 'ADMIN']),
  password: z.string().min(8, 'Use at least 8 characters'),
});

adminRouter.post('/users', async (req, res) => {
  const d = userSchema.parse(req.body);
  const user = await prisma.user.create({
    data: { name: d.name, email: d.email, phone: d.phone, role: d.role, passwordHash: await bcrypt.hash(d.password, 12) },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  await audit(req.user!.id, 'CREATE_USER', 'User', user.id, { role: user.role });
  res.status(201).json(user);
});

adminRouter.patch('/users/:id', async (req, res) => {
  const d = userSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body);
  if (String(req.params.id) === req.user!.id && (d.active === false || (d.role && d.role !== 'ADMIN'))) {
    throw badRequest("You can't deactivate or demote your own account");
  }
  const { password, ...rest } = d;
  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  await audit(req.user!.id, 'UPDATE_USER', 'User', user.id, { ...rest, passwordChanged: !!password });
  res.json(user);
});

adminRouter.get('/settings', requireRole('ADMIN'), async (_req, res) => {
  res.json(await getSettings());
});

adminRouter.put('/settings', requireRole('ADMIN'), async (req, res) => {
  const saved = await saveSettings(req.body);
  await audit(req.user!.id, 'UPDATE_SETTINGS', 'Setting', 'default');
  res.json(saved);
});

// ---- Website photos (slideshow + page photos) ----
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

adminRouter.get('/site', requireRole('ADMIN'), async (_req, res) => {
  const [content, library] = await Promise.all([
    getSiteContent(),
    prisma.siteImage.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, originalName: true, size: true, createdAt: true } }),
  ]);
  res.json({ content, library: library.map((i) => ({ ...i, src: `/api/site-images/${i.id}` })) });
});

adminRouter.put('/site', requireRole('ADMIN'), async (req, res) => {
  const saved = await saveSiteContent(req.body);
  await audit(req.user!.id, 'UPDATE_WEBSITE_PHOTOS', 'Setting', 'site');
  res.json(saved);
});

adminRouter.post('/site-images', requireRole('ADMIN'), upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const direct = await verifyDirectUploads(req.body.uploads);
    const rows = [
      ...files.map((f) => ({ fileName: f.filename, originalName: f.originalname.slice(0, 200), mimeType: f.mimetype, size: f.size })),
      ...direct,
    ];
    if (!rows.length) throw badRequest('Choose a photo');
    if (rows.some((r) => !PHOTO_TYPES.includes(r.mimeType) || r.size > MAX_PHOTO_BYTES)) {
      await Promise.all(direct.map((d) => deleteStored(d.fileName)));
      throw badRequest('Upload JPG, PNG or WEBP photos up to 15MB');
    }
    await persistUploads(files);
    const created = await prisma.$transaction(rows.map((r) => prisma.siteImage.create({ data: { ...r, uploadedById: req.user!.id } })));
    await audit(req.user!.id, 'UPLOAD_WEBSITE_PHOTO', 'SiteImage', created.map((c) => c.id).join(','));
    res.status(201).json(created.map((c) => ({ id: c.id, originalName: c.originalName, size: c.size, createdAt: c.createdAt, src: `/api/site-images/${c.id}` })));
  } catch (e) {
    await discardUploads(files);
    throw e;
  }
});

adminRouter.delete('/site-images/:id', requireRole('ADMIN'), async (req, res) => {
  const img = await prisma.siteImage.findUnique({ where: { id: String(req.params.id) } });
  if (!img) throw notFound('Photo');
  if (imagesInUse(await getSiteContent()).has(img.id)) throw badRequest('This photo is on the website. Replace it there first, then delete it.');
  await prisma.siteImage.delete({ where: { id: img.id } });
  await deleteStored(img.fileName);
  await audit(req.user!.id, 'DELETE_WEBSITE_PHOTO', 'SiteImage', img.id);
  res.json({ ok: true });
});

/** Staff activity, with the repair / person each entry is about filled in so it reads as plain English. */
adminRouter.get('/audit', requireRole('ADMIN'), async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { user: { select: { name: true, role: true } } } });
  const ids = (entity: string) => [...new Set(rows.filter((r) => r.entity === entity).map((r) => r.entityId))];
  const techIds = rows.map((r) => (r.details as { technicianId?: string } | null)?.technicianId).filter((x): x is string => !!x);
  const [jobs, quotes, payments, warranties, claims, users] = await Promise.all([
    prisma.repairJob.findMany({ where: { id: { in: ids('RepairJob') } }, select: { id: true, repairId: true } }),
    prisma.quotation.findMany({ where: { id: { in: ids('Quotation') } }, select: { id: true, number: true, job: { select: { repairId: true } } } }),
    prisma.payment.findMany({ where: { id: { in: ids('Payment') } }, select: { id: true, receiptNumber: true, job: { select: { repairId: true } } } }),
    prisma.warranty.findMany({ where: { id: { in: ids('Warranty') } }, select: { id: true, job: { select: { repairId: true } } } }),
    prisma.warrantyClaim.findMany({ where: { id: { in: ids('WarrantyClaim') } }, select: { id: true, warranty: { select: { job: { select: { repairId: true } } } } } }),
    prisma.user.findMany({ where: { id: { in: [...ids('User'), ...techIds] } }, select: { id: true, name: true } }),
  ]);
  const repairOf = new Map<string, string>([
    ...jobs.map((j) => [j.id, j.repairId] as const),
    ...quotes.map((q) => [q.id, q.job.repairId] as const),
    ...payments.map((p) => [p.id, p.job.repairId] as const),
    ...warranties.map((w) => [w.id, w.job.repairId] as const),
    ...claims.map((c) => [c.id, c.warranty.job.repairId] as const),
  ]);
  const label = new Map<string, string | null>([...quotes.map((q) => [q.id, q.number] as const), ...payments.map((p) => [p.id, p.receiptNumber] as const), ...users.map((u) => [u.id, u.name] as const)]);
  res.json(
    rows.map((r) => {
      const techId = (r.details as { technicianId?: string } | null)?.technicianId;
      return { ...r, repairId: repairOf.get(r.entityId) ?? null, subject: label.get(r.entityId) ?? null, technician: techId ? (label.get(techId) ?? null) : null };
    }),
  );
});
