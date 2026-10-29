import nodemailer from 'nodemailer';
import type { Customer, RepairJob } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '../lib/phone.js';
import { getSettings, type BusinessSettings } from './settings.js';
import { pushToJob } from './push.js';

type JobWithCustomer = RepairJob & { customer: Customer };

export function trackingLink(job: Pick<RepairJob, 'repairId' | 'trackToken'>) {
  return `${config.clientUrl}/track/${job.repairId}?t=${job.trackToken}`;
}

/** Short form of the tracking link for SMS (opens the same page via /t/<token>). */
export function shortTrackingLink(job: Pick<RepairJob, 'trackToken'>) {
  return `${config.clientUrl}/t/${job.trackToken}`;
}

/**
 * SMS pages hold 160 plain characters, but a single symbol like ₦ or a curly quote switches the
 * whole message to 70 per page. Keep texts to plain characters so each update costs one page.
 */
export function smsSafe(text: string) {
  return text
    .replace(/₦/g, 'NGN ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** "Airride ARC-2026-00015: Ready for Collection. <message> <link>", dropping the message if it would need a second page. */
export function smsUpdate(job: Pick<RepairJob, 'repairId' | 'trackToken'>, headline: string, body: string) {
  const link = shortTrackingLink(job);
  const full = smsSafe(`Airride ${job.repairId}: ${headline}. ${body} Track: ${link}`);
  return full.length <= 160 ? full : smsSafe(`Airride ${job.repairId}: ${headline}. Track: ${link}`);
}

const mailer = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

async function log(jobId: string | null, channel: string, recipient: string, message: string, status: string, subject?: string, error?: string) {
  await prisma.notificationLog.create({ data: { jobId, channel, recipient, message, status, subject, error } });
}

async function sendEmail(jobId: string | null, to: string, subject: string, text: string, html: string) {
  if (!mailer) {
    console.log(`[email:skipped] to=${to} subject="${subject}"\n${text}\n`);
    return log(jobId, 'EMAIL', to, text, 'SKIPPED', subject, 'SMTP not configured');
  }
  try {
    // Customer replies go to the business's own inbox (Settings → Email), not the sending account.
    const replyTo = (await getSettings()).email || undefined;
    await mailer.sendMail({ from: config.smtp.from, to, subject, text, html, replyTo });
    await log(jobId, 'EMAIL', to, text, 'SENT', subject);
  } catch (e) {
    await log(jobId, 'EMAIL', to, text, 'FAILED', subject, String(e));
  }
}

/**
 * Termii channels: 'generic' is cheaper but Nigerian networks block it for numbers on Do-Not-Disturb;
 * 'dnd' reaches every number, so repair updates and sign-in codes both use it.
 */
async function sendSms(jobId: string | null, phone: string, text: string, channel: 'generic' | 'dnd' = 'dnd') {
  const to = normalizePhone(phone);
  // The workshop's own Android phone, when connected, sends instead of Termii (normal SIM rates, no Sender ID).
  if (config.phoneGateway.user) return sendViaPhone(jobId, to, text);
  if (!config.termii.apiKey) {
    console.log(`[sms:skipped] to=${to}: ${text}`);
    return log(jobId, 'SMS', to, text, 'SKIPPED', undefined, 'SMS not configured');
  }
  try {
    const res = await fetch(`${config.termii.baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: config.termii.apiKey, to, from: config.termii.senderId, sms: text, type: 'plain', channel }),
    });
    if (!res.ok) throw new Error(`Termii ${res.status}: ${await res.text()}`);
    await log(jobId, 'SMS', to, text, 'SENT');
  } catch (e) {
    await log(jobId, 'SMS', to, text, 'FAILED', undefined, String(e));
  }
}

/**
 * SMS through an Android phone running the free "SMS Gateway for Android" app (sms-gate.app):
 * the website asks the phone to send, the phone sends from its own SIM like a normal text.
 */
async function sendViaPhone(jobId: string | null, to: string, text: string) {
  const { url, user, pass } = config.phoneGateway;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') },
      body: JSON.stringify({ message: text, phoneNumbers: [`+${to}`] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Phone gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await log(jobId, 'SMS', to, text, 'SENT', undefined, 'via workshop phone');
  } catch (e) {
    await log(jobId, 'SMS', to, text, 'FAILED', undefined, String(e));
  }
}

/**
 * WhatsApp Business messages started by the business must use a Meta-approved template.
 * Expected template body params: {{1}} customer name, {{2}} repair ID, {{3}} update text, {{4}} tracking link.
 */
async function sendWhatsApp(jobId: string | null, phone: string, params: string[], previewText: string) {
  const to = normalizePhone(phone);
  const { token, phoneNumberId, templateName, templateLang } = config.whatsapp;
  if (!token || !phoneNumberId) {
    console.log(`[whatsapp:skipped] to=${to}: ${previewText}`);
    return log(jobId, 'WHATSAPP', to, previewText, 'SKIPPED', undefined, 'WhatsApp not configured');
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
        },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
    await log(jobId, 'WHATSAPP', to, previewText, 'SENT');
  } catch (e) {
    await log(jobId, 'WHATSAPP', to, previewText, 'FAILED', undefined, String(e));
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function emailHtml(biz: BusinessSettings, name: string, headline: string, body: string, link: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#0f1b2d">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#0f1b2d;padding:20px 28px;color:#fff;font-size:18px;font-weight:bold">AIRRIDE <span style="color:#1a66e0">Suspension Clinic</span></td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 8px">Hello ${escapeHtml(name)},</p>
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(headline)}</h1>
      <p style="margin:0 0 24px;line-height:1.5">${escapeHtml(body).replace(/\n/g, '<br>')}</p>
      <a href="${link}" style="display:inline-block;background:#1a66e0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Track My Repair</a>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8f9fb;font-size:12px;color:#5b6575">${escapeHtml(biz.name)} · ${escapeHtml(biz.address)} · ${escapeHtml(biz.phone)}</td></tr>
  </table></td></tr></table></body></html>`;
}

/**
 * Sends an update about a job on every channel we have contact details for.
 * Failures are logged, never thrown — a broken SMS gateway must not break a status update.
 */
/** Phone alert only (free): for small updates that don't warrant an SMS or email. */
export function pushUpdate(job: Pick<RepairJob, 'id' | 'repairId' | 'trackToken'>, headline: string, body: string) {
  return pushToJob(job.id, { title: headline, body, url: trackingLink(job), tag: job.repairId });
}

export async function notifyCustomer(job: JobWithCustomer, headline: string, body: string) {
  const c = job.customer;
  const link = trackingLink(job);
  const firstName = c.fullName.split(' ')[0];
  const shortText = `Airride: ${headline} Repair ID ${job.repairId}. ${body} Track: ${link}`;
  const biz = await getSettings();

  const tasks: Promise<unknown>[] = [];
  if (c.email) tasks.push(sendEmail(job.id, c.email, `${headline} — ${job.repairId}`, `${body}\n\nTrack your repair: ${link}`, emailHtml(biz, firstName, headline, `${body}\n\nRepair ID: ${job.repairId}`, link)));
  const wa = c.whatsapp || c.phone;
  if (wa) tasks.push(sendWhatsApp(job.id, wa, [firstName, job.repairId, `${headline} ${body}`, link], shortText));
  if (c.phone && (c.preferredContact === 'SMS' || c.preferredContact === 'PHONE')) tasks.push(sendSms(job.id, c.phone, smsUpdate(job, headline, body)));
  tasks.push(pushToJob(job.id, { title: headline, body, url: link, tag: job.repairId }));

  await Promise.allSettled(tasks);
}

/** New bookings, quote replies, warranty claims: to the office staff plus the extra alert emails in Settings. */
export async function notifyStaff(subject: string, text: string) {
  const [staff, biz] = await Promise.all([
    prisma.user.findMany({ where: { active: true, role: { in: ['ADMIN', 'ADVISOR'] } }, select: { email: true } }),
    getSettings(),
  ]);
  const to = [...new Set([...staff.map((s) => s.email), ...biz.alertEmails].map((e) => e.trim().toLowerCase()).filter(Boolean))];
  await Promise.allSettled(to.map((email) => sendEmail(null, email, subject, text, `<pre style="font-family:inherit">${escapeHtml(text)}</pre>`)));
}

/** Sends a one-time sign-in code to a phone (SMS) or email address. */
export async function sendOtp(contact: string, code: string) {
  const biz = await getSettings();
  const text = `Your ${biz.name} sign-in code is ${code}. It expires in 10 minutes. Never share this code.`;
  if (contact.includes('@')) {
    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0b1b33;padding:24px">
      <p>Your sign-in code for <strong>${escapeHtml(biz.name)}</strong>:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
      <p style="color:#5b6575">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p></body></html>`;
    await sendEmail(null, contact, `${code} is your sign-in code`, text, html);
  } else {
    await sendSms(null, contact, smsSafe(text), 'dnd');
  }
}
