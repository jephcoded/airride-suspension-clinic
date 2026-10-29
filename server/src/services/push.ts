import webpush from 'web-push';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

/** Web Push: alerts on the customer's phone/computer, even when the website is closed. */
export const pushEnabled = !!(config.push.publicKey && config.push.privateKey);
if (pushEnabled) webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);

export type PushMessage = { title: string; body: string; url: string; tag?: string };

export async function pushToJob(jobId: string, msg: PushMessage) {
  if (!pushEnabled) return;
  const subs = await prisma.pushSubscription.findMany({ where: { jobId } });
  if (!subs.length) return;
  const payload = JSON.stringify(msg);
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: 'high' });
        await prisma.notificationLog.create({ data: { jobId, channel: 'PUSH', recipient: new URL(s.endpoint).host, message: `${msg.title}: ${msg.body}`, status: 'SENT' } });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The browser unsubscribed or the app was removed: forget this device.
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else await prisma.notificationLog.create({ data: { jobId, channel: 'PUSH', recipient: new URL(s.endpoint).host, message: msg.title, status: 'FAILED', error: String(e).slice(0, 500) } });
      }
    }),
  );
}

/** One device only: confirms alerts work right after the customer turns them on. */
export async function pushToDevice(sub: { endpoint: string; p256dh: string; auth: string }, msg: PushMessage) {
  if (!pushEnabled) return;
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(msg), { TTL: 600 });
}
