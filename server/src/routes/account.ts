import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '../lib/phone.js';
import { COMPONENT_LABELS, STAGES } from '../lib/stages.js';
import { HttpError } from '../lib/http.js';
import { sendOtp } from '../services/notify.js';

/**
 * Customer accounts (spec §8 + §16): passwordless sign-in with a one-time code sent to the
 * phone or email the customer booked with. All of their repairs are then available in one place.
 */
export const accountRouter = Router();

export const CUSTOMER_COOKIE = 'airride_customer';
const cookieOptions = { httpOnly: true, secure: config.isProd, sameSite: 'lax' as const, maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' };
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

const contactSchema = z.object({ contact: z.string().trim().min(5, 'Enter your phone number or email').max(120) });

function normalizeContact(raw: string) {
  const v = raw.trim();
  return v.includes('@') ? v.toLowerCase() : normalizePhone(v);
}

function hashCode(contact: string, code: string) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${contact}:${code}`).digest('hex');
}

/** Every customer record that uses this phone or email (people sometimes book more than once). */
async function customersFor(contact: string) {
  const where: Prisma.CustomerWhereInput = contact.includes('@') ? { email: contact } : { OR: [{ phone: contact }, { whatsapp: contact }] };
  return prisma.customer.findMany({ where, select: { id: true, fullName: true } });
}

accountRouter.post('/otp', otpLimiter, async (req, res) => {
  const contact = normalizeContact(contactSchema.parse(req.body).contact);
  const customers = await customersFor(contact);
  // Same response whether or not we know this contact, so nobody can probe who is a customer.
  const response: { ok: true; devCode?: string } = { ok: true };
  if (customers.length) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await prisma.otpCode.create({ data: { contact, codeHash: hashCode(contact, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) } });
    await sendOtp(contact, code);
    if (!config.isProd) {
      console.log(`[otp] ${contact}: ${code}`);
      response.devCode = code; // local testing only, never in production
    }
  }
  res.json(response);
});

const verifySchema = contactSchema.extend({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') });

accountRouter.post('/verify', verifyLimiter, async (req, res) => {
  const body = verifySchema.parse(req.body);
  const contact = normalizeContact(body.contact);
  const otp = await prisma.otpCode.findFirst({ where: { contact, usedAt: null }, orderBy: { createdAt: 'desc' } });
  const invalid = new HttpError(400, 'That code is incorrect or has expired. Request a new one.');
  if (!otp || otp.expiresAt < new Date() || otp.attempts >= MAX_ATTEMPTS) throw invalid;

  const a = Buffer.from(otp.codeHash);
  const b = Buffer.from(hashCode(contact, body.code));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw invalid;
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

  const token = jwt.sign({ kind: 'customer', contact }, config.jwtSecret, { expiresIn: '30d' });
  res.cookie(CUSTOMER_COOKIE, token, cookieOptions);
  res.json({ ok: true });
});

accountRouter.post('/logout', (_req, res) => {
  res.clearCookie(CUSTOMER_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

/** The signed-in customer's verified phone/email, or null. */
export function customerContact(req: Request): string | null {
  const token = req.cookies?.[CUSTOMER_COOKIE];
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.jwtSecret) as { kind?: string; contact?: string };
    return p.kind === 'customer' && p.contact ? p.contact : null;
  } catch {
    return null;
  }
}

function requireCustomer(req: Request, _res: Response, next: NextFunction) {
  if (!customerContact(req)) return next(new HttpError(401, 'Please sign in'));
  next();
}

accountRouter.get('/me', requireCustomer, async (req, res) => {
  const contact = customerContact(req)!;
  const customers = await customersFor(contact);
  if (!customers.length) throw new HttpError(401, 'Please sign in');
  const ids = customers.map((c) => c.id);

  const [jobs, vehicles] = await Promise.all([
    prisma.repairJob.findMany({
      where: { customerId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        vehicle: true,
        quotations: {
          where: { status: { notIn: ['DRAFT', 'SUPERSEDED'] } },
          orderBy: { createdAt: 'desc' },
          select: { number: true, status: true, total: true, sentAt: true, validUntil: true },
        },
        payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' }, select: { receiptNumber: true, amount: true, channel: true, paidAt: true } },
        warranty: { select: { months: true, startDate: true, expiryDate: true } },
      },
    }),
    prisma.vehicle.findMany({ where: { customerId: { in: ids } }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { jobs: true } } } }),
  ]);

  const done = new Set(['DELIVERED', 'COMPLETED', 'CANCELLED']);
  const now = new Date();
  res.json({
    name: customers[0].fullName,
    contact,
    repairs: jobs.map((j) => ({
      repairId: j.repairId,
      token: j.trackToken,
      active: !done.has(j.stage),
      stage: j.stage,
      stageLabel: STAGES[j.stage].label,
      component: j.component === 'OTHER' && j.componentOther ? j.componentOther : COMPONENT_LABELS[j.component],
      position: j.position,
      vehicle: [j.vehicle.year, j.vehicle.make, j.vehicle.model].filter(Boolean).join(' '),
      registration: j.vehicle.registration,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      paymentStatus: j.paymentStatus,
      amountPaid: j.amountPaid,
      quotes: j.quotations,
      receipts: j.payments,
      warranty: j.warranty ? { ...j.warranty, active: j.warranty.expiryDate > now } : null,
    })),
    vehicles: vehicles.map((v) => ({
      id: v.id,
      name: [v.year, v.make, v.model].filter(Boolean).join(' '),
      registration: v.registration,
      type: v.type,
      repairs: v._count.jobs,
    })),
  });
});
