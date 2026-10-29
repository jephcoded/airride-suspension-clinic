import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * Website photos the admin can change: the home slideshow and named photo spots on the pages.
 * Each picture is either a built-in file (/images/…) or one the admin uploaded (/api/site-images/<id>).
 */
export const PHOTO_SPOTS = [
  'svc-air',
  'svc-hydraulic',
  'svc-shock',
  'svc-transmission',
  'tx-main',
  'tx-gears',
  'tx-selector',
  'tx-converter',
  'why-inspect',
  'shop-mechanic',
  'shop-underbody',
  'shop-floor',
  'cta-lifts',
  'about-team',
  'about-wheel',
  'vehicles',
] as const;

const src = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/images\/[\w.-]+|\/api\/site-images\/[a-z0-9]+)$/, 'Choose a photo');

const slideSchema = z.object({
  src,
  caption: z.string().trim().max(80).default(''),
  alt: z.string().trim().max(200).default(''),
  // Which part of the photo stays in view when it is cropped to the screen ("x% y%").
  position: z.string().trim().regex(/^\d{1,3}% \d{1,3}%$/).default('50% 50%'),
});

export const siteContentSchema = z.object({
  // null = use the built-in slideshow
  slides: z.array(slideSchema).min(1, 'Keep at least one slide').max(8, 'Up to 8 slides').nullable().default(null),
  photos: z.partialRecord(z.enum(PHOTO_SPOTS), src).default({}),
});

export type SiteContent = z.infer<typeof siteContentSchema>;

const ROW_ID = 'site';
let cache: { value: SiteContent; at: number } | null = null;
const TTL_MS = 60_000;

export async function getSiteContent(): Promise<SiteContent> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await prisma.setting.findUnique({ where: { id: ROW_ID } });
  const parsed = siteContentSchema.safeParse(row?.data ?? {});
  const value = parsed.success ? parsed.data : siteContentSchema.parse({});
  cache = { value, at: Date.now() };
  return value;
}

export async function saveSiteContent(input: unknown): Promise<SiteContent> {
  const value = siteContentSchema.parse(input);
  await prisma.setting.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, data: value as Prisma.InputJsonValue },
    update: { data: value as Prisma.InputJsonValue },
  });
  cache = { value, at: Date.now() };
  return value;
}

/** Ids of uploaded photos the website currently shows (these can't be deleted). */
export function imagesInUse(c: SiteContent): Set<string> {
  const all = [...(c.slides ?? []).map((s) => s.src), ...Object.values(c.photos)];
  return new Set(all.filter((s): s is string => !!s?.startsWith('/api/site-images/')).map((s) => s.split('/').pop()!));
}
