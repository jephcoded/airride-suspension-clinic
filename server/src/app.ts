import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { loadUser } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { publicRouter } from './routes/public.js';
import { trackRouter } from './routes/track.js';
import { authRouter } from './routes/auth.js';
import { staffRouter } from './routes/staff.js';
import { adminRouter } from './routes/admin.js';
import { accountRouter } from './routes/account.js';
import { uploadsRouter } from './routes/uploads.js';
import { applySuccessfulPayment, verifyPaystackSignature } from './services/payments.js';
import { getSettings, publicBusiness } from './services/settings.js';
import { getSiteContent } from './services/siteContent.js';
import { uploadMode } from './services/storage.js';
import { prisma } from './lib/prisma.js';

export function createApp() {
  const app = express();
  // How many proxies (load balancer / CDN) sit in front of the app. Wrong values let visitors fake their IP and dodge rate limits.
  app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : config.isProd ? 1 : false);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          // https: covers photos served from the storage bucket via short-lived links
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'https:'],
          frameSrc: ['https://www.google.com', 'https://maps.google.com'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
    }),
  );
  app.use(compression());
  app.use(cors({ origin: config.clientUrl, credentials: true }));

  // Paystack webhook needs the raw body to verify the signature, so it's mounted before express.json().
  app.post('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!verifyPaystackSignature(req.body, req.header('x-paystack-signature'))) return res.sendStatus(401);
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'charge.success' && event.data?.currency === 'NGN') {
      try {
        await applySuccessfulPayment(event.data.reference, event.data.amount, event.data.channel, event.data);
      } catch (e) {
        console.error('Webhook payment failed', e);
        return res.sendStatus(500); // Paystack will retry
      }
    }
    res.sendStatus(200);
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(loadUser);

  // Used by the host's load balancer: only report healthy when the database answers.
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app.use('/api', publicRouter);
  app.use('/api', trackRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Short tracking links used in SMS: /t/<token> → the full tracking page.
  app.get('/t/:token', async (req, res) => {
    const job = await prisma.repairJob.findUnique({ where: { trackToken: String(req.params.token) }, select: { repairId: true, trackToken: true } });
    res.redirect(302, job ? `/track/${job.repairId}?t=${job.trackToken}` : '/track');
  });

  serveWebsite(app);
  app.use(errorHandler);
  return app;
}

/**
 * Production: this server also serves the built website (client/dist).
 * Hashed assets are cached for a year; the page itself is never cached and carries the
 * live business details, so changes in admin → Settings show on the next page load.
 */
function serveWebsite(app: express.Express) {
  const dist = path.resolve(process.env.CLIENT_DIST || '../client/dist');
  const indexFile = path.join(dist, 'index.html');
  if (!fs.existsSync(indexFile)) return; // development: Vite serves the website
  const template = fs.readFileSync(indexFile, 'utf8');

  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '365d', index: false }));
  app.use(express.static(dist, { index: false, maxAge: '7d' }));

  app.get(/^\/(?!api\/).*/, async (_req, res, next) => {
    try {
      const [settings, site] = await Promise.all([getSettings(), getSiteContent()]);
      const boot = { workshop: publicBusiness(settings), uploadMode, pushKey: config.push.publicKey || null, site };
      // JSON in a data block (not a script), so the strict Content-Security-Policy stays intact.
      // Escape "<" so a value like "</script>" in the settings can't break out of the block.
      const json = JSON.stringify(boot).replace(/</g, String.fromCharCode(92) + 'u003c');
      const html = template.replace('</head>', `<script id="__business__" type="application/json">${json}</script></head>`);
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(html);
    } catch (e) {
      next(e);
    }
  });
}
