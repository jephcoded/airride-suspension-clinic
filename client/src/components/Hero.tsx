import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { slides, sized } from '../lib/site';
import { ArrowRight, Camera, FileCheck2, Gauge, Search, ShieldCheck, Smartphone, Truck } from 'lucide-react';

/** Quick links along the bottom of the hero: what customers get, each leading to the page about it. */
const FEATURES = [
  { icon: ShieldCheck, label: 'Warranty on every repair', to: '/warranty' },
  { icon: FileCheck2, label: 'Approve quotes online', to: '/quote' },
  { icon: Smartphone, label: 'Live repair tracking', to: '/track' },
  { icon: Camera, label: 'Before & after photos', to: '/track' },
  { icon: Truck, label: 'Pickup or courier', to: '/book' },
  { icon: Gauge, label: 'Bench-tested repairs', to: '/services' },
];


const SLIDE_MS = 6500;

/** Staggered rise-in for hero content on first paint. */
const rise = (i: number) => ({ style: { animationDelay: `${150 + i * 110}ms` } });

export function Hero() {
  // Set by the admin in Website Photos (built-in suspension photos until then).
  const [SLIDES] = useState(slides);
  // `prev` stays fully visible underneath while `index` fades in on top: no dark dip mid-transition.
  const [{ index, prev }, setSlides] = useState({ index: 0, prev: -1 });
  // Bumped each time a slide becomes active, to restart its slow zoom from the beginning.
  const [runs, setRuns] = useState(() => SLIDES.map(() => 0));
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const indexRef = useRef(0);

  const show = useCallback((n: number) => {
    if (n === indexRef.current) return;
    setSlides({ index: n, prev: indexRef.current });
    setRuns((r) => r.map((v, i) => (i === n ? v + 1 : v)));
    indexRef.current = n;
  }, []);
  const go = useCallback((dir: 1 | -1) => show((indexRef.current + dir + SLIDES.length) % SLIDES.length), [show]);

  // Auto-advance; restarting the timer on every change keeps manual navigation in rhythm.
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, paused, go]);

  // Warm the browser cache for the next slide so the crossfade never shows a blank frame.
  useEffect(() => {
    const next = SLIDES[(index + 1) % SLIDES.length];
    const img = new Image();
    img.src = sized(next.src) ? next.src.replace('-1920.', window.innerWidth > 960 ? '-1920.' : '-960.') : next.src;
  }, [index, SLIDES]);

  return (
    <section
      className="relative isolate flex h-svh min-h-[560px] overflow-hidden bg-navy-950 sm:h-[100svh] sm:max-h-[940px] sm:min-h-[640px]"
      aria-roledescription="carousel"
      aria-label="Airride workshop"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {/* ---------- Slides ---------- */}
      {SLIDES.map((s, i) => {
        const v = sized(s.src);
        return (
        <picture
          key={s.src + i}
          aria-hidden={i !== index}
          className={clsx(
            'absolute inset-0 transition-opacity duration-[1800ms] ease-[cubic-bezier(.4,0,.2,1)]',
            i === index || i === prev ? 'opacity-100' : 'opacity-0',
          )}
          style={{ zIndex: i === index ? -28 : i === prev ? -29 : -30 }}
        >
          {v && <source type="image/webp" srcSet={v.webp} sizes="100vw" />}
          <img
            src={v ? v.fallback : s.src}
            srcSet={v?.jpg}
            sizes="100vw"
            alt={s.alt}
            fetchPriority={i === 0 ? 'high' : 'low'}
            loading={i === 0 ? 'eager' : 'lazy'}
            // The outgoing slide keeps zooming while it's covered, so nothing snaps back during the fade.
            key={runs[i]}
            className={clsx('size-full object-cover will-change-transform', (i === index || i === prev) && 'animate-kenburns')}
            style={{ objectPosition: s.position }}
          />
        </picture>
        );
      })}

      {/* Dark navy wash: strongest behind the text (left/bottom), lighter on the right so the photo still shows */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-black/20" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_42%_at_50%_45%,rgb(0_0_0/0.55),transparent)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-transparent via-35% to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 via-45% to-transparent sm:hidden" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-black/50 to-transparent" />

      {/* ---------- Content ---------- */}
      <div className="container-x flex w-full flex-col justify-end pt-24 pb-24 sm:justify-center sm:pb-36 lg:pb-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="animate-rise" {...rise(0)}>
            <span className="eyebrow eyebrow-light after:h-0.5 after:w-6 after:rounded after:bg-brand-500 after:content-['']">
              <span className="sm:hidden">Suspension Specialists</span>
              <span className="hidden sm:inline">Air & Hydraulic Suspension Specialists</span>
            </span>
          </p>
          <h1 className="animate-rise mt-4 text-[clamp(2rem,9.6vw,2.6rem)] leading-[1.05] font-extrabold tracking-tight text-white [text-shadow:0_2px_24px_rgb(0_0_0/0.45)] sm:text-6xl xl:text-[4.25rem]" {...rise(1)}>
            Get Back the Ride
            <span className="block pb-1 text-brand-400">You Paid For.</span>
          </h1>
          <p className="animate-rise mx-auto mt-5 hidden max-w-lg text-left text-[15px] leading-relaxed text-white/85 xl:text-base [text-shadow:0_1px_12px_rgb(0_0_0/0.6)] sm:block" {...rise(2)}>
            Sinking, leaking or bouncing? We rebuild air and hydraulic suspension to factory performance,{' '}
            <span className="font-semibold text-white">tested, warranted and tracked live from your phone.</span>
          </p>
          <div className="animate-rise mt-7 flex w-full flex-col justify-center gap-3 sm:mt-9 sm:w-auto sm:flex-row" {...rise(3)}>
            <Link
              to="/book"
              className="group inline-flex h-13 items-center justify-center gap-2 rounded-md bg-white px-8 text-base font-bold text-black shadow-lg shadow-black/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 hover:text-white"
            >
              Book a Repair <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/track"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-md border-2 border-white bg-black/30 px-8 text-base font-bold text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-black"
            >
              <Search className="size-4" /> Track My Repair
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- Bottom bar: trust cards ---------- */}
      <div className="absolute inset-x-0 bottom-0 hidden sm:block">
        <div className="container-x flex items-end justify-between gap-6 pb-8">
          <ul className="animate-rise hidden w-full grid-cols-4 gap-3 pr-16 lg:grid xl:grid-cols-6 2xl:pr-0" {...rise(4)}>
            {FEATURES.map((t, i) => (
              <li key={t.label} className={clsx(i >= 4 && 'hidden xl:block')}>
                <Link
                  to={t.to}
                  className="group flex h-full items-center gap-3 rounded-lg bg-white py-3 pr-3 pl-3 text-[13px] leading-snug font-semibold text-navy-950 shadow-[0_12px_30px_-12px_rgb(0_0_0/0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_-12px_rgb(0_0_0/0.55)]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition-transform duration-300 group-hover:scale-105">
                    <t.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">{t.label}</span>
                  <ArrowRight className="size-3.5 shrink-0 -translate-x-1 text-brand-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>

        </div>
      </div>

      {/* Progress: per-slide bars on phones, one thin line across the bottom on larger screens */}
      <div className="absolute inset-x-0 top-[104px] flex gap-1 px-4 sm:hidden">
        {SLIDES.map((s, i) => (
          <button key={s.src + i} onClick={() => show(i)} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20" aria-label={`Show photo ${i + 1}`}>
            <span
              key={i === index ? index : 'idle'}
              className={clsx('block h-full origin-left rounded-full bg-brand-500', i < index && 'scale-x-100', i > index && 'scale-x-0')}
              style={i === index ? { animation: `slide-progress ${SLIDE_MS}ms linear both`, animationPlayState: paused ? 'paused' : 'running' } : undefined}
            />
          </button>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 hidden h-[3px] bg-white/10 sm:block">
        <span
          key={index}
          className="block h-full origin-left bg-brand-500"
          style={{ animation: `slide-progress ${SLIDE_MS}ms linear both`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      </div>
    </section>
  );
}
