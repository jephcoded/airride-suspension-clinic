import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config, paymentsMocked } from '../config.js';
import { getSettings, publicBusiness } from '../services/settings.js';
import { prisma } from '../lib/prisma.js';
import { generateRepairId, randomToken } from '../lib/ids.js';
import { normalizePhone } from '../lib/phone.js';
import { STAGES, STAGE_ORDER, COMPONENT_LABELS } from '../lib/stages.js';
import { badRequest } from '../lib/http.js';
import { upload } from '../middleware/upload.js';
import { discardUploads, persistUploads, sendStored, uploadMode, verifyDirectUploads } from '../services/storage.js';
import { getSiteContent } from '../services/siteContent.js';
import { notifyCustomer, notifyStaff, trackingLink } from '../services/notify.js';
import { background } from '../lib/background.js';

export const publicRouter = Router();

/** An empty form box means "not given", not zero. */
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema);

const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

const phone = z.string().trim().min(7, 'Enter a valid phone number').max(20);
const optionalText = z.string().trim().max(500).optional().transform((v) => v || undefined);

const bookingSchema = z
  .object({
    customer: z.object({
      fullName: z.string().trim().min(2, 'Enter your full name').max(120),
      phone,
      // Required: repair updates are sent to this number on WhatsApp.
      whatsapp: z.string().trim().min(7, 'Enter your WhatsApp number').max(20),
      email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')).transform((v) => v || undefined),
      location: optionalText,
      preferredContact: z.enum(['PHONE', 'WHATSAPP', 'SMS', 'EMAIL']).default('WHATSAPP'),
    }),
    vehicle: z.object({
      make: z.string().trim().min(1, 'Enter the vehicle make').max(60),
      model: z.string().trim().min(1, 'Enter the vehicle model').max(60),
      year: blankToUndefined(z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional()),
      vin: optionalText,
      registration: optionalText,
      mileage: blankToUndefined(z.coerce.number().int().min(0).max(5_000_000).optional()),
      type: z.enum(['CAR', 'SUV', 'TRUCK', 'BUS', 'OTHER']).default('CAR'),
    }),
    suspension: z.object({
      type: z.enum(['AIR', 'HYDRAULIC', 'ELECTRONIC', 'UNKNOWN']),
      component: z.enum(['SHOCK_ABSORBER', 'AIR_STRUT', 'HYDRAULIC_STRUT', 'AIR_SPRING', 'HYDRAULIC_CYLINDER', 'VALVE_BLOCK', 'COMPRESSOR', 'PUMP', 'AUTOMATIC_TRANSMISSION', 'OTHER']),
      componentOther: optionalText,
      position: optionalText,
      symptoms: z.array(z.string().trim().max(60)).max(20).default([]),
      description: z.string().trim().min(5, 'Please describe the problem').max(4000),
    }),
    delivery: z.object({
      option: z.enum(['DROP_OFF', 'PICKUP', 'SHIP']),
      pickupAddress: optionalText,
      pickupDate: z.coerce.date().optional().or(z.literal('').transform(() => undefined)),
      pickupTime: optionalText,
    }),
  })
  .superRefine((d, ctx) => {
    if (d.delivery.option === 'PICKUP') {
      if (!d.delivery.pickupAddress) ctx.addIssue({ code: 'custom', path: ['delivery', 'pickupAddress'], message: 'Enter the pickup address' });
      if (!d.delivery.pickupDate) ctx.addIssue({ code: 'custom', path: ['delivery', 'pickupDate'], message: 'Choose a pickup date' });
    }
    if (d.suspension.component === 'OTHER' && !d.suspension.componentOther) {
      ctx.addIssue({ code: 'custom', path: ['suspension', 'componentOther'], message: 'Tell us which component' });
    }
  });

/** Public info the website needs (workshop address, stage labels...). */
publicRouter.get('/meta', async (_req, res) => {
  const [settings, site] = await Promise.all([getSettings(), getSiteContent()]);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    workshop: publicBusiness(settings),
    stages: STAGE_ORDER.map((key) => ({ key, label: STAGES[key].label })),
    components: COMPONENT_LABELS,
    paymentsMocked,
    uploadMode,
    pushKey: config.push.publicKey || null,
    defaultWarrantyMonths: settings.warrantyMonths,
    site,
  });
});

/** Website photos uploaded by the admin. Public on purpose; customer files never come through here. */
publicRouter.get('/site-images/:id', async (req, res) => {
  const img = await prisma.siteImage.findUnique({ where: { id: String(req.params.id) } });
  if (!img) return res.sendStatus(404);
  await sendStored(req, res, img.fileName, img.mimeType, { publicCache: true });
});

/** Book a Repair: multipart form with a JSON `data` field and up to 10 `files`. */
publicRouter.post('/bookings', submitLimiter, upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(req.body.data ?? '{}');
    } catch {
      throw badRequest('Invalid form data');
    }
    const d = bookingSchema.parse(raw);
    const phoneNorm = normalizePhone(d.customer.phone);

    await persistUploads(files);
    // Vercel: files were uploaded straight to storage by the browser; check and record them.
    const direct = await verifyDirectUploads((raw as { uploads?: unknown }).uploads);
    const job = await prisma.$transaction(async (tx) => {
      // Returning customers are matched on phone number so their history stays together.
      const existing = await tx.customer.findFirst({ where: { phone: phoneNorm } });
      const customerData = {
        fullName: d.customer.fullName,
        phone: phoneNorm,
        whatsapp: d.customer.whatsapp ? normalizePhone(d.customer.whatsapp) : undefined,
        email: d.customer.email?.toLowerCase(),
        location: d.customer.location,
        preferredContact: d.customer.preferredContact,
      };
      const customer = existing
        ? await tx.customer.update({ where: { id: existing.id }, data: customerData })
        : await tx.customer.create({ data: customerData });

      const reg = d.vehicle.registration?.toUpperCase().replace(/\s+/g, '');
      const sameVehicle = reg ? await tx.vehicle.findFirst({ where: { customerId: customer.id, registration: reg } }) : null;
      const vehicleData = { ...d.vehicle, registration: reg, vin: d.vehicle.vin?.toUpperCase() };
      const vehicle = sameVehicle
        ? await tx.vehicle.update({ where: { id: sameVehicle.id }, data: vehicleData })
        : await tx.vehicle.create({ data: { ...vehicleData, customerId: customer.id } });

      const repairId = await generateRepairId();
      return tx.repairJob.create({
        data: {
          repairId,
          trackToken: randomToken(),
          customerId: customer.id,
          vehicleId: vehicle.id,
          suspensionType: d.suspension.type,
          component: d.suspension.component,
          componentOther: d.suspension.componentOther,
          position: d.suspension.position,
          symptoms: d.suspension.symptoms,
          description: d.suspension.description,
          deliveryOption: d.delivery.option,
          pickupAddress: d.delivery.pickupAddress,
          pickupDate: d.delivery.pickupDate,
          pickupTime: d.delivery.pickupTime,
          stage: 'REQUEST_SUBMITTED',
          history: {
            create: { stage: 'REQUEST_SUBMITTED', title: 'Request Submitted', note: 'Your repair request was received. We will contact you shortly.' },
          },
          media: {
            create: [
              ...files.map((f) => ({ phase: 'CUSTOMER' as const, fileName: f.filename, originalName: f.originalname.slice(0, 200), mimeType: f.mimetype, size: f.size })),
              ...direct.map((d) => ({ phase: 'CUSTOMER' as const, ...d })),
            ],
          },
        },
        include: { customer: true, vehicle: true },
      });
    });

    const link = trackingLink(job);
    background(notifyCustomer(
      job,
      'Repair Request Received',
      `Your Repair ID is ${job.repairId}. Use this number to track your repair.`,
    ));
    background(notifyStaff(
      `New repair request ${job.repairId}`,
      `${job.customer.fullName} (${job.customer.phone}) — ${job.vehicle.make} ${job.vehicle.model}\n` +
        `${COMPONENT_LABELS[job.component]} · ${job.suspensionType}\n${job.description}`,
    ));

    res.status(201).json({ repairId: job.repairId, trackToken: job.trackToken, trackingLink: link, deliveryOption: job.deliveryOption, workshop: publicBusiness(await getSettings()) });
  } catch (e) {
    // Don't keep orphaned uploads from a rejected submission.
    await discardUploads(files);
    throw e;
  }
});

const enquirySchema = z.object({
  type: z.enum(['QUOTE', 'CONTACT']),
  name: z.string().trim().min(2).max(120),
  phone,
  email: z.string().trim().email().optional().or(z.literal('')).transform((v) => v || undefined),
  vehicle: optionalText,
  message: z.string().trim().min(5, 'Please write a short message').max(4000),
});

publicRouter.post('/enquiries', submitLimiter, async (req, res) => {
  const d = enquirySchema.parse(req.body);
  const enquiry = await prisma.enquiry.create({ data: { ...d, phone: normalizePhone(d.phone) } });
  background(notifyStaff(
    `New ${d.type === 'QUOTE' ? 'quote request' : 'message'} from ${d.name}`,
    `${d.name} · ${d.phone} · ${d.email ?? ''}\n${d.vehicle ?? ''}\n\n${d.message}`,
  ));
  res.status(201).json({ id: enquiry.id });
});
