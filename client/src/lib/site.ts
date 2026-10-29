/**
 * Website photos the admin can change (Admin → Website Photos). Loaded at startup with the
 * business details; anything the admin hasn't changed uses the built-in photo below.
 */
export type Slide = { src: string; caption: string; alt: string; position: string };

/** Built-in slideshow: suspension parts, not people (see docs/IMAGE_CREDITS.md). */
export const DEFAULT_SLIDES: Slide[] = [
  { src: '/images/slide-shock-1920.webp', caption: 'Shock Absorber Rebuilding', alt: 'Close-up of a chrome coil-over shock absorber', position: '50% 50%' },
  { src: '/images/slide-spring-1920.webp', caption: 'Shock & Coil Spring Repair', alt: 'Shock absorber and coil spring mounted beside a wheel', position: '55% 50%' },
  { src: '/images/slide-bilstein-1920.webp', caption: 'Heavy-Duty Shock Repair', alt: 'Off-road shock absorber mounted behind a wheel', position: '45% 50%' },
  { src: '/images/slide-coilover-1920.webp', caption: 'Coil-Over Strut Repair', alt: 'Red coil spring and strut on an SUV front suspension', position: '55% 50%' },
];

/** Photo spots on the pages, in the order the admin sees them. */
export const PHOTO_SPOTS = [
  { key: 'svc-air', label: 'Service card: Air suspension', page: 'Home', src: '/images/svc-air.webp' },
  { key: 'svc-hydraulic', label: 'Service card: Hydraulic suspension', page: 'Home', src: '/images/svc-hydraulic.webp' },
  { key: 'svc-shock', label: 'Service card: Shock absorbers', page: 'Home', src: '/images/svc-shock.webp' },
  { key: 'svc-transmission', label: 'Service card: Automatic transmission', page: 'Home', src: '/images/svc-transmission.webp' },
  { key: 'tx-main', label: 'Transmission feature: large photo', page: 'Home & Services', src: '/images/tx-main.webp' },
  { key: 'tx-gears', label: 'Transmission feature: small photo 1', page: 'Home & Services', src: '/images/tx-gears.webp' },
  { key: 'tx-selector', label: 'Transmission feature: small photo 2', page: 'Home & Services', src: '/images/tx-selector.webp' },
  { key: 'tx-converter', label: 'Transmission feature: small photo 3', page: 'Home & Services', src: '/images/tx-converter.webp' },
  { key: 'why-inspect', label: 'Why choose Airride', page: 'Home', src: '/images/why-inspect.webp' },
  { key: 'shop-mechanic', label: 'Our workshop: large photo', page: 'Home', src: '/images/shop-mechanic.webp' },
  { key: 'shop-underbody', label: 'Our workshop: top small photo', page: 'Home', src: '/images/shop-underbody.webp' },
  { key: 'shop-floor', label: 'Our workshop: bottom small photo', page: 'Home', src: '/images/shop-floor.webp' },
  { key: 'cta-lifts', label: '"Book your repair today" banner', page: 'Home', src: '/images/cta-lifts.webp' },
  { key: 'about-team', label: 'About us: left photo', page: 'About', src: '/images/about-team.webp' },
  { key: 'about-wheel', label: 'About us: right photo', page: 'About', src: '/images/about-wheel.webp' },
  { key: 'vehicles', label: 'Vehicles we service', page: 'Services', src: '/images/vehicles.webp' },
] as const;

export type PhotoSpot = (typeof PHOTO_SPOTS)[number]['key'];

/** Built-in photos the admin can pick again (including the client's own workshop shots). */
export const BUILT_IN_PHOTOS = [
  ...DEFAULT_SLIDES.map((s) => s.src),
  '/images/hero-1-1920.webp',
  '/images/hero-2-1920.webp',
  '/images/slide-team-1920.webp',
  ...PHOTO_SPOTS.map((p) => p.src),
];

export type SiteContent = { slides: Slide[] | null; photos: Partial<Record<PhotoSpot, string>> };

const SITE: SiteContent = { slides: null, photos: {} };

export function setSite(s: Partial<SiteContent> | undefined | null) {
  if (!s) return;
  SITE.slides = s.slides?.length ? s.slides : null;
  SITE.photos = s.photos ?? {};
}

export const slides = () => SITE.slides ?? DEFAULT_SLIDES;

export function photo(key: PhotoSpot) {
  return SITE.photos[key] ?? PHOTO_SPOTS.find((p) => p.key === key)!.src;
}

/** Built-in slides come in two sizes; uploaded photos are a single file. */
export function sized(src: string) {
  const m = src.match(/^\/images\/(.+)-1920\.webp$/);
  if (!m) return null;
  return {
    webp: `/images/${m[1]}-960.webp 960w, /images/${m[1]}-1920.webp 1920w`,
    jpg: `/images/${m[1]}-960.jpg 960w, /images/${m[1]}-1920.jpg 1920w`,
    fallback: `/images/${m[1]}-1920.jpg`,
  };
}
