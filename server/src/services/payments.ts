import crypto from 'node:crypto';
import type { PaymentStatus, Prisma } from '@prisma/client';
import { config, paymentsMocked } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { generateReceiptNumber, randomToken } from '../lib/ids.js';
import { badRequest, HttpError } from '../lib/http.js';
import { formatNaira } from '../lib/money.js';
import { notifyCustomer, notifyStaff } from './notify.js';
import { background } from '../lib/background.js';

const PAYSTACK = 'https://api.paystack.co';

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(PAYSTACK + path, {
    ...init,
    headers: { Authorization: `Bearer ${config.paystackSecret}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !body.status) throw new HttpError(502, `Payment provider error: ${body.message}`);
  return body.data;
}

export function verifyPaystackSignature(rawBody: Buffer, signature: string | undefined) {
  if (!signature || !config.paystackSecret) return false;
  const hash = crypto.createHmac('sha512', config.paystackSecret).update(rawBody).digest('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function initializePayment(opts: { jobId: string; quotationId: string; amount: number; email: string; callbackUrl: string }) {
  if (opts.amount <= 0) throw badRequest('Nothing to pay');
  const reference = `ARP-${Date.now()}-${randomToken(6)}`;
  await prisma.payment.create({
    data: { jobId: opts.jobId, quotationId: opts.quotationId, reference, amount: opts.amount, provider: paymentsMocked ? 'MOCK' : 'PAYSTACK' },
  });

  if (paymentsMocked) {
    const url = new URL(opts.callbackUrl);
    url.searchParams.set('reference', reference);
    return { reference, authorizationUrl: url.toString(), mocked: true };
  }

  const data = await paystack<{ authorization_url: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amount,
      reference,
      currency: 'NGN',
      callback_url: opts.callbackUrl,
      metadata: { jobId: opts.jobId, quotationId: opts.quotationId },
    }),
  });
  return { reference, authorizationUrl: data.authorization_url, mocked: false };
}

/** Confirms with Paystack (never trusts the browser) and applies the payment. Safe to call repeatedly. */
export async function verifyPayment(reference: string) {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) throw badRequest('Unknown payment reference');
  if (payment.status === 'SUCCESS') return payment;

  if (payment.provider === 'MOCK') {
    if (!paymentsMocked) throw badRequest('Mock payments are disabled');
    return applySuccessfulPayment(reference, payment.amount, 'mock', { mock: true });
  }

  const data = await paystack<{ status: string; amount: number; channel: string; currency: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  if (data.status === 'success' && data.currency === 'NGN') return applySuccessfulPayment(reference, data.amount, data.channel, data);
  if (data.status === 'failed' || data.status === 'abandoned') {
    return prisma.payment.update({ where: { reference }, data: { status: 'FAILED', raw: data as Prisma.InputJsonValue } });
  }
  return payment;
}

/** Records a successful payment exactly once and recalculates the job's payment status. */
export async function applySuccessfulPayment(reference: string, amountPaid: number, channel: string, raw: object) {
  const result = await prisma.$transaction(async (tx) => {
    // Guards against the webhook and the browser redirect both applying the same payment.
    const claimed = await tx.payment.updateMany({ where: { reference, status: { not: 'SUCCESS' } }, data: { status: 'SUCCESS' } });
    const payment = await tx.payment.findUniqueOrThrow({ where: { reference } });
    if (claimed.count === 0) return { payment, applied: false };

    const receiptNumber = await generateReceiptNumber();
    const updatedPayment = await tx.payment.update({
      where: { reference },
      data: { amount: amountPaid, channel, paidAt: new Date(), receiptNumber, raw: raw as Prisma.InputJsonValue },
    });
    await recalcJobPayments(payment.jobId, tx);
    await tx.statusHistory.create({
      data: { jobId: payment.jobId, title: 'Payment Received', note: `${formatNaira(amountPaid)} received. Receipt ${receiptNumber}.` },
    });
    return { payment: updatedPayment, applied: true };
  });

  if (result.applied) {
    const job = await prisma.repairJob.findUniqueOrThrow({ where: { id: result.payment.jobId }, include: { customer: true } });
    background(notifyCustomer(job, 'Payment Received', `Thank you! We received ${formatNaira(amountPaid)}. Receipt ${result.payment.receiptNumber}.`));
    background(notifyStaff(
      `Payment received — ${job.repairId}`,
      `${formatNaira(amountPaid)} received via ${channel} for ${job.repairId} (${job.customer.fullName}).`,
    ));
  }
  return result.payment;
}

export async function recalcJobPayments(jobId: string, tx: Prisma.TransactionClient = prisma) {
  const [paidAgg, refundedAgg, quote] = await Promise.all([
    tx.payment.aggregate({ where: { jobId, status: 'SUCCESS' }, _sum: { amount: true } }),
    tx.payment.aggregate({ where: { jobId, status: 'REFUNDED' }, _sum: { amount: true } }),
    tx.quotation.findFirst({ where: { jobId, status: 'APPROVED' }, orderBy: { createdAt: 'desc' } }),
  ]);
  const paid = paidAgg._sum.amount ?? 0;
  const refunded = refundedAgg._sum.amount ?? 0;
  let status: PaymentStatus = 'AWAITING';
  if (refunded > 0 && paid === 0) status = 'REFUNDED';
  else if (quote && paid >= quote.total) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';
  await tx.repairJob.update({ where: { id: jobId }, data: { amountPaid: paid, paymentStatus: status } });
}
