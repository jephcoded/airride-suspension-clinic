import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { getSettings, publicBusiness } from '../services/settings.js';
import { prisma } from '../lib/prisma.js';
import { samePhone } from '../lib/phone.js';
import { STAGES, STAGE_ORDER, COMPONENT_LABELS } from '../lib/stages.js';
import { formatNaira } from '../lib/money.js';
import { badRequest, HttpError, notFound } from '../lib/http.js';
import { sendStored } from '../services/storage.js';
import { customerContact } from './account.js';
import { STAFF_ROLES } from '../middleware/auth.js';
import { changeStage } from '../services/jobs.js';
import { notifyStaff } from '../services/notify.js';
import { initializePayment, verifyPayment } from '../services/payments.js';
import { background } from '../lib/background.js';
import { pushEnabled, pushToDevice } from '../services/push.js';
import { trackingLink } from '../services/notify.js';

export const trackRouter = Router();

// Slows down anyone trying to guess Repair ID + phone combinations.
// Only failed lookups count, so a customer watching their repair live (polling) is never blocked.
const lookupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false });

const jobInclude = {
  customer: true,
  vehicle: true,
  history: { where: { visibleToCustomer: true }, orderBy: { createdAt: 'asc' as const } },
  media: { where: { visibleToCustomer: true }, orderBy: { createdAt: 'asc' as const } },
  quotations: { where: { status: { not: 'DRAFT' as const } }, include: { items: true }, orderBy: { createdAt: 'desc' as const } },
  payments: { where: { status: 'SUCCESS' as const }, orderBy: { paidAt: 'asc' as const } },
  technician: { select: { name: true } },
  warranty: { include: { claims: { orderBy: { createdAt: 'desc' as const } } } },
};

/**
 * A customer proves ownership with either the secret link token (from WhatsApp/SMS/email)
 * or the phone number / email used when booking.
 */
async function loadAuthorizedJob(req: Request) {
  const repairId = String(String(req.params.repairId)).toUpperCase().trim();
  const token = String(req.query.t ?? req.body?.t ?? '');
  const contact = String(req.query.contact ?? req.body?.contact ?? '').trim();
  const signedIn = customerContact(req); // customer account, verified by one-time code
  if (!token && !contact && !signedIn) throw badRequest('Enter the phone number or email you used when booking');

  const job = await prisma.repairJob.findUnique({ where: { repairId }, include: jobInclude });
  const c = job?.customer;
  const owns = (v: string) => samePhone(v, c!.phone) || samePhone(v, c!.whatsapp) || (!!c!.email && v.toLowerCase() === c!.email);
  const ok = job && ((token && token === job.trackToken) || (contact && owns(contact)) || (signedIn && owns(signedIn)));
  // Same message for "no such repair" and "wrong contact" so IDs can't be enumerated.
  if (!job || !ok) throw new HttpError(404, 'We could not find a repair with those details. Check the Repair ID and phone number.');
  return job;
}

type LoadedJob = Awaited<ReturnType<typeof loadAuthorizedJob>>;

const stageIndex = (s: string) => STAGE_ORDER.indexOf(s as never);

/** Shapes a job for the customer: internal notes and staff-only data are never included. */
function customerView(job: LoadedJob, workshop: ReturnType<typeof publicBusiness>) {
  const approved = job.quotations.find((q) => q.status === 'APPROVED');
  const showDiagnosis = stageIndex(job.stage) >= stageIndex('DIAGNOSIS') && job.stage !== 'CANCELLED';
  const w = job.warranty;
  return {
    repairId: job.repairId,
    token: job.trackToken,
    stage: job.stage,
    stageLabel: STAGES[job.stage].label,
    stageMessage: STAGES[job.stage].customerMessage,
    technician: job.technician?.name.split(' ')[0] ?? null,
    createdAt: job.createdAt,
    receivedAt: job.receivedAt,
    completedAt: job.completedAt,
    estimatedCompletion: job.estimatedCompletion,
    customer: { name: job.customer.fullName, email: job.customer.email },
    vehicle: {
      make: job.vehicle.make,
      model: job.vehicle.model,
      year: job.vehicle.year,
      registration: job.vehicle.registration,
      type: job.vehicle.type,
    },
    suspensionType: job.suspensionType,
    component: job.component === 'OTHER' && job.componentOther ? job.componentOther : COMPONENT_LABELS[job.component],
    position: job.position,
    symptoms: job.symptoms,
    description: job.description,
    deliveryOption: job.deliveryOption,
    pickup: job.deliveryOption === 'PICKUP' ? { address: job.pickupAddress, date: job.pickupDate, time: job.pickupTime } : null,
    workshop,
    diagnosis: showDiagnosis
      ? { faultFound: job.faultFound, diagnosis: job.diagnosis, partsRequired: job.partsRequired, repairProcedure: job.repairProcedure, testResults: job.testResults, qcResult: job.qcResult }
      : null,
    timeline: job.history.map((h) => ({ id: h.id, stage: h.stage, title: h.title, note: h.note, at: h.createdAt })),
    media: job.media.map((m) => ({
      id: m.id,
      phase: m.phase,
      mimeType: m.mimeType,
      caption: m.caption,
      url: `/api/media/${m.id}?t=${job.trackToken}`,
      at: m.createdAt,
    })),
    quotations: job.quotations.map((q) => ({
      id: q.id,
      number: q.number,
      status: q.status,
      items: q.items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.amount })),
      subtotal: q.subtotal,
      discount: q.discount,
      total: q.total,
      depositPercent: q.depositPercent,
      validUntil: q.validUntil,
      estimatedCompletion: q.estimatedCompletion,
      notes: q.notes,
      sentAt: q.sentAt,
      respondedAt: q.respondedAt,
    })),
    payment: {
      status: job.paymentStatus,
      amountPaid: job.amountPaid,
      total: approved?.total ?? null,
      balance: approved ? Math.max(0, approved.total - job.amountPaid) : null,
      receipts: job.payments.map((p) => ({ receiptNumber: p.receiptNumber, amount: p.amount, channel: p.channel, paidAt: p.paidAt, reference: p.reference })),
    },
    warranty: w
      ? {
          months: w.months,
          startDate: w.startDate,
          expiryDate: w.expiryDate,
          terms: w.terms,
          active: w.expiryDate > new Date(),
          claims: w.claims.map((c) => ({ id: c.id, description: c.description, status: c.status, resolution: c.resolution, at: c.createdAt })),
        }
      : null,
  };
}

// ---- Phone alerts (Web Push) for one repair ----
const pushSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000).startsWith('https://'),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
});

trackRouter.post('/track/:repairId/push', lookupLimiter, async (req, res) => {
  if (!pushEnabled) throw badRequest('Phone alerts are not available yet');
  const job = await loadAuthorizedJob(req);
  const { subscription } = pushSchema.parse(req.body);
  const keys = { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth };
  if ((await prisma.pushSubscription.count({ where: { jobId: job.id } })) >= 20) throw badRequest('Too many devices are following this repair');
  await prisma.pushSubscription.upsert({
    where: { endpoint_jobId: { endpoint: subscription.endpoint, jobId: job.id } },
    create: { jobId: job.id, endpoint: subscription.endpoint, ...keys },
    update: keys,
  });
  background(
    pushToDevice({ endpoint: subscription.endpoint, ...keys }, {
      title: 'Live alerts are on',
      body: `We'll alert you here at every step of repair ${job.repairId}.`,
      url: trackingLink(job),
      tag: job.repairId,
    }),
    'push confirmation',
  );
  res.status(201).json({ ok: true });
});

trackRouter.delete('/track/:repairId/push', async (req, res) => {
  const job = await loadAuthorizedJob(req);
  const endpoint = z.object({ endpoint: z.string().max(1000) }).parse(req.body).endpoint;
  await prisma.pushSubscription.deleteMany({ where: { jobId: job.id, endpoint } });
  res.json({ ok: true });
});

trackRouter.get('/track/:repairId', lookupLimiter, async (req, res) => {
  res.json(customerView(await loadAuthorizedJob(req), publicBusiness(await getSettings())));
});

const respondSchema = z.object({
  action: z.enum(['APPROVE', 'DECLINE', 'CLARIFY']),
  message: z.string().trim().max(2000).optional(),
});

trackRouter.post('/track/:repairId/quotes/:quoteId/respond', async (req, res) => {
  const job = await loadAuthorizedJob(req);
  const { action, message } = respondSchema.parse(req.body);
  const quote = job.quotations.find((q) => q.id === String(req.params.quoteId));
  if (!quote) throw notFound('Quotation');
  if (quote.status !== 'SENT' && quote.status !== 'CLARIFICATION_REQUESTED') throw badRequest('This quotation has already been answered');
  if (action === 'APPROVE' && quote.validUntil < new Date()) throw badRequest('This quotation has expired. Please request an updated quote.');
  if (action === 'CLARIFY' && !message) throw badRequest('Please type your question');

  const now = new Date();
  const status = action === 'APPROVE' ? 'APPROVED' : action === 'DECLINE' ? 'DECLINED' : 'CLARIFICATION_REQUESTED';
  const when = now.toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Lagos' });

  await prisma.quotation.update({
    where: { id: quote.id },
    data: { status, respondedAt: now, respondedBy: job.customer.fullName, respondedIp: req.ip, customerMessage: message },
  });

  if (action === 'APPROVE') {
    // Approval moves the job into the repair workflow.
    await changeStage({
      repairId: job.repairId,
      stage: 'PARTS_SOURCING',
      title: 'Quote Approved',
      note: `${job.customer.fullName} approved the repair (${formatNaira(quote.total)}) on ${when}.`,
      notify: false,
    });
  } else {
    await prisma.statusHistory.create({
      data: {
        jobId: job.id,
        title: action === 'DECLINE' ? 'Quote Declined' : 'Clarification Requested',
        note: action === 'DECLINE' ? `Customer declined the quotation on ${when}.` : `Customer asked: "${message}"`,
      },
    });
  }

  background(notifyStaff(
    `${job.repairId}: quote ${status.toLowerCase().replace('_', ' ')}`,
    `${job.customer.fullName} responded to ${quote.number}: ${action}${message ? `\n\n"${message}"` : ''}`,
  ));

  res.json(customerView(await loadAuthorizedJob(req), publicBusiness(await getSettings())));
});

const paySchema = z.object({ quotationId: z.string(), mode: z.enum(['DEPOSIT', 'FULL']).default('FULL') });

trackRouter.post('/track/:repairId/pay', async (req, res) => {
  if (!config.onlinePayments) throw badRequest('Online payment is not available. Please pay at the workshop by cash or bank transfer.');
  const job = await loadAuthorizedJob(req);
  const { quotationId, mode } = paySchema.parse(req.body);
  const quote = job.quotations.find((q) => q.id === quotationId);
  if (!quote || quote.status !== 'APPROVED') throw badRequest('Please approve the quotation before paying');

  const balance = Math.max(0, quote.total - job.amountPaid);
  if (balance === 0) throw badRequest('This repair is fully paid. Thank you!');
  const amount =
    mode === 'DEPOSIT' && quote.depositPercent > 0 && job.amountPaid === 0 ? Math.round((quote.total * quote.depositPercent) / 100) : balance;

  const callbackUrl = `${config.clientUrl}/track/${job.repairId}?t=${job.trackToken}`;
  // Paystack requires an email; customers who booked with phone only get a placeholder.
  const email = job.customer.email ?? `${job.customer.phone}@customers.airride.ng`;
  const result = await initializePayment({ jobId: job.id, quotationId: quote.id, amount, email, callbackUrl });
  res.json(result);
});

trackRouter.get('/payments/verify/:reference', async (req, res) => {
  const p = await verifyPayment(req.params.reference);
  res.json({ status: p.status, amount: p.amount, receiptNumber: p.receiptNumber });
});

const claimSchema = z.object({ description: z.string().trim().min(10, 'Please describe the problem').max(4000) });

trackRouter.post('/track/:repairId/warranty-claims', async (req, res) => {
  const job = await loadAuthorizedJob(req);
  const { description } = claimSchema.parse(req.body);
  if (!job.warranty) throw badRequest('This repair does not have a warranty yet');
  if (job.warranty.expiryDate < new Date()) throw badRequest('The warranty for this repair has expired');
  await prisma.warrantyClaim.create({ data: { warrantyId: job.warranty.id, description } });
  await prisma.statusHistory.create({ data: { jobId: job.id, title: 'Warranty Claim Opened', note: description } });
  background(notifyStaff(`Warranty claim — ${job.repairId}`, `${job.customer.fullName}: ${description}`));
  res.status(201).json(customerView(await loadAuthorizedJob(req), publicBusiness(await getSettings())));
});

/** Files are never public: customers need their tracking token, staff need to be signed in. */
trackRouter.get('/media/:id', async (req, res) => {
  const media = await prisma.media.findUnique({ where: { id: String(req.params.id) }, include: { job: { select: { trackToken: true } } } });
  if (!media) throw notFound('File');
  const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
  const customerOk = media.visibleToCustomer && req.query.t === media.job.trackToken;
  if (!isStaff && !customerOk) throw notFound('File');
  await sendStored(req, res, media.fileName, media.mimeType);
});
