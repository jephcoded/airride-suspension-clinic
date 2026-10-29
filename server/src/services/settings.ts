import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export const DEFAULT_WARRANTY_TERMS =
  'Covers workmanship and parts replaced by Airride Suspension Clinic on the repaired component. ' +
  'Excludes accident damage, misuse, overloading, failure of other suspension components, ' +
  'repairs or tampering by third parties, and normal wear of non-replaced parts. ' +
  'Claims must quote the original Repair ID.';

const text = (max: number) => z.string().trim().max(max);

export const settingsSchema = z.object({
  name: text(120).min(2),
  phone: text(30).min(7),
  whatsapp: text(30).min(7),
  email: z.string().trim().email().or(z.literal('')),
  address: text(300),
  hours: text(120),
  mapsUrl: z.string().trim().url().or(z.literal('')),
  warrantyMonths: z.coerce.number().int().min(0).max(60),
  warrantyTerms: text(4000).min(10),
  depositPercent: z.coerce.number().int().min(0).max(100),
  // Extra inboxes that get new-booking / quote / warranty alerts (besides admin and advisor accounts).
  alertEmails: z.array(z.string().trim().toLowerCase().email('Enter valid email addresses')).max(10).default([]),
  // Spec §18: warranty period per repair type (months). Missing types use warrantyMonths.
  warrantyByComponent: z
    .partialRecord(
      z.enum(['SHOCK_ABSORBER', 'AIR_STRUT', 'HYDRAULIC_STRUT', 'AIR_SPRING', 'HYDRAULIC_CYLINDER', 'VALVE_BLOCK', 'COMPRESSOR', 'PUMP', 'AUTOMATIC_TRANSMISSION', 'OTHER']),
      z.coerce.number().int().min(0).max(60),
    )
    .default({}),
});

export type BusinessSettings = z.infer<typeof settingsSchema>;

/** Used until the admin saves their own details (env values win over these). */
function defaults(): BusinessSettings {
  const env = process.env;
  return {
    name: env.WORKSHOP_NAME || 'Airride Suspension Clinic',
    phone: env.WORKSHOP_PHONE || '0703 306 0775',
    whatsapp: env.WORKSHOP_WHATSAPP || env.WORKSHOP_PHONE || '0703 306 0775',
    email: env.WORKSHOP_EMAIL || '',
    address: env.WORKSHOP_ADDRESS || '',
    hours: env.WORKSHOP_HOURS || 'Mon – Sat, 8:00am – 6:00pm',
    mapsUrl: '',
    warrantyMonths: Number(env.DEFAULT_WARRANTY_MONTHS ?? 6),
    warrantyTerms: DEFAULT_WARRANTY_TERMS,
    depositPercent: 50,
    alertEmails: (env.STAFF_ALERT_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    warrantyByComponent: {},
  };
}

// Read on almost every request, changed rarely: keep it in memory.
let cache: { value: BusinessSettings; at: number } | null = null;
const TTL_MS = 60_000;

export async function getSettings(): Promise<BusinessSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await prisma.setting.findUnique({ where: { id: 'default' } });
  const merged = { ...defaults(), ...((row?.data as Partial<BusinessSettings> | undefined) ?? {}) };
  cache = { value: merged, at: Date.now() };
  return merged;
}

export async function saveSettings(input: unknown): Promise<BusinessSettings> {
  const value = settingsSchema.parse(input);
  await prisma.setting.upsert({
    where: { id: 'default' },
    create: { id: 'default', data: value as Prisma.InputJsonValue },
    update: { data: value as Prisma.InputJsonValue },
  });
  cache = { value, at: Date.now() };
  return value;
}

/** Shape the website needs (phone/WhatsApp links pre-built). */
export function publicBusiness(s: BusinessSettings) {
  const digits = (p: string) => {
    const d = p.replace(/\D/g, '');
    return d.startsWith('0') ? '234' + d.slice(1) : d;
  };
  return {
    name: s.name,
    phone: s.phone,
    phoneHref: `tel:+${digits(s.phone)}`,
    whatsappHref: `https://wa.me/${digits(s.whatsapp)}`,
    email: s.email,
    address: s.address,
    hours: s.hours,
    mapsHref: s.mapsUrl || (s.address ? `https://maps.google.com/?q=${encodeURIComponent(s.address)}` : ''),
    warrantyMonths: s.warrantyMonths,
  };
}
