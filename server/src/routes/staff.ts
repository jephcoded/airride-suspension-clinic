import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, RepairStage } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { STAGES, STAGE_ORDER } from '../lib/stages.js';
import { audit } from '../lib/audit.js';
import { formatNaira, toKobo } from '../lib/money.js';
import { normalizePhone } from '../lib/phone.js';
import { generateReceiptNumber, randomToken } from '../lib/ids.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { requireRole, STAFF_ROLES } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { discardUploads, persistUploads, verifyDirectUploads } from '../services/storage.js';
import { getSettings } from '../services/settings.js';
import { changeStage, findJobOr404 } from '../services/jobs.js';
import { notifyCustomer, pushUpdate } from '../services/notify.js';
import { recalcJobPayments } from '../services/payments.js';
import { background } from '../lib/background.js';

export const staffRouter = Router();
staffRouter.use(requireRole(...STAFF_ROLES));

const officeOnly = requireRole('ADVISOR', 'ADMIN');

const stageEnum = z.enum(STAGE_ORDER as [RepairStage, ...RepairStage[]]);

/** Technicians only see jobs assigned to them (or unassigned new ones); office staff see everything. */
function scopeFor(user: Express.Request['user']): Prisma.RepairJobWhereInput {
  if (user?.role === 'TECHNICIAN') return { OR: [{ technicianId: user.id }, { technicianId: null }] };
  return {};
}

async function loadScopedJob(req: Express.Request & { params: Record<string, string | string[]> }) {
  const job = await findJobOr404(String(req.params.repairId));
  if (req.user!.role === 'TECHNICIAN' && job.technicianId && job.technicianId !== req.user!.id) throw forbidden('This job is assigned to another technician');
  return job;
}

// ---------- Lists & dashboard ----------

const listSchema = z.object({
  stages: z.string().optional().transform((s) => (s ? s.split(",").filter(Boolean) : [])).pipe(z.array(stageEnum)),
  bucket: z.enum(['active', 'completed', 'cancelled', 'all']).default('active'),
  q: z.string().trim().max(100).optional(),
  technicianId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

staffRouter.get('/jobs', async (req, res) => {
  const { stages, bucket, q, technicianId, page, pageSize } = listSchema.parse(req.query);
  const where: Prisma.RepairJobWhereInput = { AND: [scopeFor(req.user)] };
  const and = where.AND as Prisma.RepairJobWhereInput[];

  if (stages.length) and.push({ stage: { in: stages } });
  else if (bucket === 'active') and.push({ stage: { notIn: ['COMPLETED', 'CANCELLED', 'DELIVERED'] } });
  else if (bucket === 'completed') and.push({ stage: { in: ['COMPLETED', 'DELIVERED'] } });
  else if (bucket === 'cancelled') and.push({ stage: 'CANCELLED' });
  if (technicianId) and.push({ technicianId });

  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const };
    const digits = q.replace(/\D/g, '');
    and.push({
      OR: [
        { repairId: contains },
        { customer: { fullName: contains } },
        { customer: { email: contains } },
        ...(digits.length >= 4 ? [{ customer: { phone: { contains: normalizePhone(digits).slice(-10) } } }] : []),
        { vehicle: { make: contains } },
        { vehicle: { model: contains } },
        { vehicle: { registration: { contains: q.replace(/\s+/g, ''), mode: 'insensitive' as const } } },
        { vehicle: { vin: contains } },
        { componentOther: contains },
        { position: contains },
      ],
    });
  }

  const [total, jobs] = await Promise.all([
    prisma.repairJob.count({ where }),
    prisma.repairJob.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { fullName: true, phone: true } },
        vehicle: { select: { make: true, model: true, year: true, registration: true } },
        technician: { select: { id: true, name: true } },
      },
    }),
  ]);
  res.json({ total, page, pageSize, jobs });
});

staffRouter.get('/jobs/counts', async (req, res) => {
  const groups = await prisma.repairJob.groupBy({ by: ['stage'], where: scopeFor(req.user), _count: true });
  const counts = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<RepairStage, number>;
  for (const g of groups) counts[g.stage] = g._count;
  res.json(counts);
});

staffRouter.get('/technicians', async (_req, res) => {
  res.json(await prisma.user.findMany({ where: { role: 'TECHNICIAN', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }));
});



staffRouter.get('/jobs/:repairId', async (req, res) => {
  const base = await loadScopedJob(req);
  const job = await prisma.repairJob.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      customer: true,
      vehicle: true,
      technician: { select: { id: true, name: true } },
      history: { orderBy: { createdAt: 'asc' }, include: { createdBy: { select: { name: true } } } },
      media: { orderBy: { createdAt: 'asc' }, include: { uploadedBy: { select: { name: true } } } },
      quotations: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      warranty: { include: { claims: { orderBy: { createdAt: 'desc' } } } },
      notifications: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  const previousJobs = await prisma.repairJob.findMany({
    where: { customerId: job.customerId, id: { not: job.id } },
    select: { repairId: true, stage: true, component: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  res.json({ ...job, media: job.media.map((m) => ({ ...m, url: `/api/media/${m.id}` })), previousJobs });
});

const stageSchema = z.object({
  stage: stageEnum,
  note: z.string().trim().max(2000).optional(),
  visibleToCustomer: z.boolean().default(true),
  notify: z.boolean().optional(),
});

staffRouter.patch('/jobs/:repairId/stage', async (req, res) => {
  const job = await loadScopedJob(req);
  const body = stageSchema.parse(req.body);
  if (req.user!.role === 'TECHNICIAN' && ['CANCELLED', 'QUOTE_SENT', 'DELIVERED', 'COMPLETED'].includes(body.stage)) {
    throw forbidden('Ask a service advisor to make this change');
  }
  const updated = await changeStage({ repairId: job.repairId, userId: req.user!.id, ...body });
  // A technician who moves an unassigned job takes ownership of it.
  if (req.user!.role === 'TECHNICIAN' && !job.technicianId) await prisma.repairJob.update({ where: { id: job.id }, data: { technicianId: req.user!.id } });
  await audit(req.user!.id, 'CHANGE_STAGE', 'RepairJob', job.id, { from: job.stage, to: body.stage });
  // What the customer sees for this step, so staff can forward the same words on WhatsApp.
  res.json({ stage: updated.stage, label: STAGES[body.stage].label, message: body.note || STAGES[body.stage].customerMessage });
});

const jobCardSchema = z.object({
  componentCondition: z.string().trim().max(4000).nullish(),
  faultFound: z.string().trim().max(4000).nullish(),
  diagnosis: z.string().trim().max(4000).nullish(),
  partsRequired: z.string().trim().max(4000).nullish(),
  repairProcedure: z.string().trim().max(4000).nullish(),
  technicianNotes: z.string().trim().max(8000).nullish(),
  testResults: z.string().trim().max(4000).nullish(),
  qcResult: z.enum(['PASS', 'FAIL']).nullish(),
  position: z.string().trim().max(60).nullish(),
  estimatedCompletion: z.coerce.date().nullish(),
});

staffRouter.patch('/jobs/:repairId/job-card', async (req, res) => {
  const job = await loadScopedJob(req);
  const data = jobCardSchema.parse(req.body);
  const updated = await prisma.repairJob.update({ where: { id: job.id }, data });
  await audit(req.user!.id, 'UPDATE_JOB_CARD', 'RepairJob', job.id, Object.keys(data));
  res.json(updated);
});

staffRouter.patch('/jobs/:repairId/assign', officeOnly, async (req, res) => {
  const job = await findJobOr404(String(req.params.repairId));
  const { technicianId } = z.object({ technicianId: z.string().nullable() }).parse(req.body);
  if (technicianId) {
    const tech = await prisma.user.findFirst({ where: { id: technicianId, role: 'TECHNICIAN', active: true } });
    if (!tech) throw badRequest('Unknown technician');
  }
  await prisma.repairJob.update({ where: { id: job.id }, data: { technicianId } });
  await audit(req.user!.id, 'ASSIGN', 'RepairJob', job.id, { technicianId });
  res.json({ ok: true });
});

const noteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(4000).optional(),
  visibleToCustomer: z.boolean().default(false),
  notify: z.boolean().default(false),
});

staffRouter.post('/jobs/:repairId/notes', async (req, res) => {
  const job = await loadScopedJob(req);
  const body = noteSchema.parse(req.body);
  const entry = await prisma.statusHistory.create({
    data: { jobId: job.id, title: body.title, note: body.note, visibleToCustomer: body.visibleToCustomer, createdById: req.user!.id },
  });
  if (body.notify && body.visibleToCustomer) background(notifyCustomer(job, body.title, body.note ?? ''));
  else if (body.visibleToCustomer) background(pushUpdate(job, body.title, body.note ?? 'New update on your repair.'));
  res.status(201).json(entry);
});

staffRouter.post('/jobs/:repairId/media', upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const job = await loadScopedJob(req);
    const { phase, caption, visibleToCustomer } = z
      .object({
        phase: z.enum(['BEFORE', 'DURING', 'AFTER', 'CUSTOMER']),
        caption: z.string().trim().max(300).optional(),
        visibleToCustomer: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).default(true),
      })
      .parse(req.body);
    const direct = await verifyDirectUploads(req.body.uploads);
    if (!files.length && !direct.length) throw badRequest('Choose at least one file');
    await persistUploads(files);
    const rows = [
      ...files.map((f) => ({ fileName: f.filename, originalName: f.originalname.slice(0, 200), mimeType: f.mimetype, size: f.size })),
      ...direct,
    ];
    await prisma.media.createMany({
      data: rows.map((r) => ({ jobId: job.id, phase, caption, visibleToCustomer, uploadedById: req.user!.id, ...r })),
    });
    if (visibleToCustomer) {
      const what = rows.length === 1 ? 'A new photo' : `${rows.length} new photos`;
      background(pushUpdate(job, 'New photos of your repair', `${what} from the workshop${caption ? `: ${caption}` : ''}.`));
    }
    res.status(201).json({ uploaded: rows.length });
  } catch (e) {
    await discardUploads(files);
    throw e;
  }
});

staffRouter.patch('/media/:id', async (req, res) => {
  const body = z.object({ caption: z.string().trim().max(300).optional(), visibleToCustomer: z.boolean().optional() }).parse(req.body);
  const media = await prisma.media.findUnique({ where: { id: String(req.params.id) }, select: { id: true, job: { select: { technicianId: true } } } });
  if (!media) throw notFound('File');
  // Technicians may only change photos on their own (or unassigned) jobs.
  if (req.user!.role === 'TECHNICIAN' && media.job.technicianId && media.job.technicianId !== req.user!.id) throw forbidden('This job is assigned to another technician');
  res.json(await prisma.media.update({ where: { id: media.id }, data: body }));
});

// ---------- Quotations ----------

const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(['PART', 'LABOUR', 'TESTING', 'OTHER']),
        description: z.string().trim().min(1).max(200),
        quantity: z.coerce.number().int().min(1).max(1000).default(1),
        unitPrice: z.coerce.number().min(0).max(1e9), // naira
      }),
    )
    .min(1, 'Add at least one line item'),
  discount: z.coerce.number().min(0).default(0), // naira
  depositPercent: z.coerce.number().int().min(0).max(100).optional(),
  validDays: z.coerce.number().int().min(1).max(90).default(7),
  estimatedCompletion: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
  send: z.boolean().default(false),
});

staffRouter.post('/jobs/:repairId/quotes', officeOnly, async (req, res) => {
  const job = await findJobOr404(String(req.params.repairId));
  const d = quoteSchema.parse(req.body);
  const items = d.items.map((i) => ({ ...i, unitPrice: toKobo(i.unitPrice), amount: toKobo(i.unitPrice) * i.quantity }));
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const discount = Math.min(toKobo(d.discount), subtotal);
  const count = await prisma.quotation.count({ where: { jobId: job.id } });

  const quote = await prisma.$transaction(async (tx) => {
    // Only one live quote at a time — older unanswered ones are replaced.
    await tx.quotation.updateMany({ where: { jobId: job.id, status: { in: ['DRAFT', 'SENT', 'CLARIFICATION_REQUESTED'] } }, data: { status: 'SUPERSEDED' } });
    return tx.quotation.create({
      data: {
        jobId: job.id,
        number: `Q-${job.repairId}-${count + 1}`,
        status: 'DRAFT',
        subtotal,
        discount,
        total: subtotal - discount,
        depositPercent: d.depositPercent ?? (await getSettings()).depositPercent,
        validUntil: new Date(Date.now() + d.validDays * 86400000),
        estimatedCompletion: d.estimatedCompletion,
        notes: d.notes,
        items: { create: items },
      },
      include: { items: true },
    });
  });
  if (d.estimatedCompletion) await prisma.repairJob.update({ where: { id: job.id }, data: { estimatedCompletion: d.estimatedCompletion } });
  await audit(req.user!.id, 'CREATE_QUOTE', 'Quotation', quote.id, { total: quote.total });

  if (d.send) await sendQuote(job.repairId, quote.id, req.user!.id);
  res.status(201).json(quote);
});

async function sendQuote(repairId: string, quoteId: string, userId: string) {
  const quote = await prisma.quotation.findUnique({ where: { id: quoteId } });
  if (!quote) throw notFound('Quotation');
  if (quote.status !== 'DRAFT') throw badRequest('Only draft quotations can be sent');
  await prisma.quotation.update({ where: { id: quoteId }, data: { status: 'SENT', sentAt: new Date() } });
  await changeStage({
    repairId,
    stage: 'AWAITING_APPROVAL',
    title: 'Quote Sent',
    note: `Repair estimate: ${formatNaira(quote.total)}. Please review and approve to continue.`,
    userId,
  });
}

staffRouter.post('/jobs/:repairId/quotes/:quoteId/send', officeOnly, async (req, res) => {
  await sendQuote(String(req.params.repairId).toUpperCase(), String(req.params.quoteId), req.user!.id);
  await audit(req.user!.id, 'SEND_QUOTE', 'Quotation', String(req.params.quoteId));
  res.json({ ok: true });
});

// ---------- Manual payments (cash / transfer at the counter) ----------

const manualPaymentSchema = z.object({
  amount: z.coerce.number().positive(), // naira
  method: z.enum(['CASH', 'TRANSFER', 'POS']),
  note: z.string().trim().max(300).optional(),
});

staffRouter.post('/jobs/:repairId/payments', officeOnly, async (req, res) => {
  const job = await findJobOr404(String(req.params.repairId));
  const d = manualPaymentSchema.parse(req.body);
  const quote = await prisma.quotation.findFirst({ where: { jobId: job.id, status: 'APPROVED' }, orderBy: { createdAt: 'desc' } });
  const amount = toKobo(d.amount);
  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        jobId: job.id,
        quotationId: quote?.id,
        reference: `MAN-${Date.now()}-${randomToken(4)}`,
        provider: d.method,
        channel: d.method.toLowerCase(),
        amount,
        status: 'SUCCESS',
        paidAt: new Date(),
        receiptNumber: await generateReceiptNumber(),
        raw: { recordedBy: req.user!.id, note: d.note ?? null },
      },
    });
    await recalcJobPayments(job.id, tx);
    await tx.statusHistory.create({ data: { jobId: job.id, title: 'Payment Received', note: `${formatNaira(amount)} received. Receipt ${p.receiptNumber}.`, createdById: req.user!.id } });
    return p;
  });
  await audit(req.user!.id, 'RECORD_PAYMENT', 'Payment', payment.id, { amount, method: d.method });
  background(notifyCustomer(job, 'Payment Received', `Thank you! We received ${formatNaira(amount)}. Receipt ${payment.receiptNumber}.`));
  res.status(201).json(payment);
});

// ---------- Warranty ----------

staffRouter.patch('/jobs/:repairId/warranty', officeOnly, async (req, res) => {
  const job = await findJobOr404(String(req.params.repairId));
  const d = z.object({ months: z.coerce.number().int().min(0).max(60), terms: z.string().trim().min(1).max(4000) }).parse(req.body);
  const start = job.completedAt ?? new Date();
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + d.months);
  const w = await prisma.warranty.upsert({
    where: { jobId: job.id },
    create: { jobId: job.id, months: d.months, terms: d.terms, startDate: start, expiryDate: expiry },
    update: { months: d.months, terms: d.terms, expiryDate: expiry },
  });
  await audit(req.user!.id, 'UPDATE_WARRANTY', 'Warranty', w.id, d);
  res.json(w);
});

staffRouter.patch('/warranty-claims/:id', officeOnly, async (req, res) => {
  const d = z.object({ status: z.enum(['OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED']), resolution: z.string().trim().max(2000).optional() }).parse(req.body);
  const claim = await prisma.warrantyClaim.update({ where: { id: String(req.params.id) }, data: d });
  await audit(req.user!.id, 'UPDATE_CLAIM', 'WarrantyClaim', claim.id, d);
  res.json(claim);
});

// ---------- Enquiries (Get a Quote / Contact) ----------

staffRouter.get('/enquiries', officeOnly, async (_req, res) => {
  res.json(await prisma.enquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
});

staffRouter.patch('/enquiries/:id', officeOnly, async (req, res) => {
  const { handled } = z.object({ handled: z.boolean() }).parse(req.body);
  res.json(await prisma.enquiry.update({ where: { id: String(req.params.id) }, data: { handled } }));
});

