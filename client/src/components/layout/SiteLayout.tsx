import clsx from 'clsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowUp, Clock, Mail, MapPin, Phone, Search, User } from 'lucide-react';
import { SiteSearch } from '../SiteSearch';
import { Logo } from '../ui/misc';
import { BUSINESS } from '../../lib/constants';
import { MobileBar } from './MobileBar';
import { useSeo } from '../../lib/useSeo';
import { useParallax, useScrollReveal } from '../../lib/reveal';
import { scrollToTopInstant, scrollToTopSmooth, setScrollLocked, smoothScrollTo, useSmoothScroll } from '../../lib/smoothScroll';

// Matches the client spec order. "Book a Repair" is the orange button beside the menu.
const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About Us' },
  { to: '/services', label: 'Services' },
  { to: '/track', label: 'Track My Repair' },
  { to: '/quote', label: 'Get a Quote' },
  { to: '/warranty', label: 'Warranty' },
  { to: '/faqs', label: 'FAQs' },
  { to: '/contact', label: 'Contact Us' },
];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.47 9.47 0 01-4.83-1.32l-.35-.21-3.59.94.96-3.5-.23-.36a9.45 9.45 0 01-1.45-5.04c0-5.23 4.26-9.49 9.5-9.49 2.54 0 4.92.99 6.71 2.79a9.43 9.43 0 012.78 6.71c0 5.24-4.26 9.49-9.49 9.49zm8.08-17.57A11.35 11.35 0 0012.04.5C5.74.5.62 5.62.62 11.92c0 2.01.53 3.98 1.53 5.71L.5 23.5l6.02-1.58a11.4 11.4 0 005.45 1.39h.01c6.3 0 11.42-5.12 11.42-11.42 0-3.05-1.19-5.92-3.35-8.08z" />
    </svg>
  );
}

type Box = { left: number; width: number };

/**
 * Desktop menu: a soft pill glides behind whichever link is hovered,
 * and the orange underline slides to the active page on navigation.
 */
function DesktopNav({ onDark }: { onDark: boolean }) {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<Box & { visible: boolean; instant: boolean }>({ left: 0, width: 0, visible: false, instant: true });
  const [active, setActive] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const el = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setActive(el && el.offsetWidth ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    update();
    // Widths change once the web font loads and when the menu appears at the xl breakpoint.
    document.fonts?.ready.then(update);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [pathname]);

  return (
    <nav ref={navRef} className="relative hidden items-center xl:flex" aria-label="Main" onMouseLeave={() => setHover((h) => ({ ...h, visible: false }))}>
      <span
        aria-hidden
        className={clsx(
          'pointer-events-none absolute top-1/2 h-8 -translate-y-1/2 rounded-md duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
          onDark ? 'bg-white/12' : 'bg-navy-50',
          hover.instant ? 'transition-opacity' : 'transition-[left,width,opacity]',
        )}
        style={{ left: hover.left, width: hover.width, opacity: hover.visible ? 1 : 0 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-0.5 h-[2px] rounded-full bg-brand-500 transition-[left,width,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{ left: (active?.left ?? 0) + 12, width: Math.max(0, (active?.width ?? 0) - 24), opacity: active ? 1 : 0 }}
      />
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            // First hover: appear in place. After that: glide between links.
            setHover((h) => ({ left: el.offsetLeft, width: el.offsetWidth, visible: true, instant: !h.visible }));
          }}
          className={({ isActive }) =>
            clsx(
              'relative z-10 rounded-md px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors duration-200',
              isActive ? (onDark ? 'text-brand-400' : 'text-brand-600') : onDark ? 'text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.5)] hover:text-brand-300' : 'text-navy-600 hover:text-navy-950',
            )
          }
        >
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  const line = 'absolute left-0 h-[2px] w-5 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)]';
  return (
    <span className="relative block h-4 w-5" aria-hidden>
      <span className={clsx(line, open ? 'top-[7px] rotate-45' : 'top-0')} />
      <span className={clsx(line, 'top-[7px]', open && 'scale-x-0 opacity-0')} />
      <span className={clsx(line, open ? 'top-[7px] -rotate-45' : 'top-[14px]')} />
    </span>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();

  // Ctrl/Cmd+K or "/" opens search from anywhere (except while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]');
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen(false);
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Always visible. Once the page scrolls, the bar morphs into a floating "island".
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setScrollLocked(open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // The bar keeps its shape while the menu is open, so opening it never makes the bar jump.
  const island = scrolled;
  // On the home page the bar starts transparent over the hero photo.
  const overlay = pathname === '/' && !scrolled && !open;

  return (
    <>
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-40 transition-[padding,background-color] duration-500 ease-[cubic-bezier(.22,1,.36,1)]',
          island ? 'bg-transparent px-2.5 pt-2.5 sm:px-4 sm:pt-3' : overlay ? 'bg-transparent px-0 pt-0' : 'bg-white px-0 pt-0',
        )}
      >
        <div className={clsx('grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.22,1,.36,1)]', island ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
          <div className="overflow-hidden">
            <TopBar />
          </div>
        </div>
        <div
          className={clsx(
            'mx-auto flex items-center justify-between gap-4 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]',
            island
              ? 'h-14 max-w-[1240px] rounded-2xl bg-white/95 px-3 shadow-[0_12px_40px_-12px_rgb(7_18_38/0.28)] ring-1 ring-navy-900/[0.06] backdrop-blur-xl backdrop-saturate-150 sm:px-5'
              : clsx('h-[60px] max-w-7xl rounded-none px-4 sm:px-6 lg:px-8 xl:h-16', overlay ? 'bg-transparent' : 'bg-white'),
          )}
        >
          <Logo light={overlay} />
          <DesktopNav onDark={overlay} />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
              aria-label="Search the website"
              title="Search (Ctrl + K)"
              className={clsx(
                'group flex size-10 items-center justify-center rounded-full transition-colors duration-200',
                overlay ? 'text-white hover:bg-white/15' : 'text-navy-700 hover:bg-navy-50 hover:text-navy-950',
              )}
            >
              <Search className="size-[19px] transition-transform duration-200 group-hover:scale-110" />
            </button>
            <a href={BUSINESS.phoneHref} className={clsx('group hidden items-center gap-2 text-[13px] font-bold transition-colors duration-200 hover:text-brand-500 2xl:flex', overlay ? 'text-white' : 'text-navy-800')}>
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-all duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-brand-500/30">
                <Phone className="size-3.5 group-hover:animate-[ring_0.6s_ease-in-out]" />
              </span>
              {BUSINESS.phone}
            </a>
            <Link
              to="/book"
              className="group relative hidden h-9 items-center gap-1.5 overflow-hidden rounded-md bg-brand-600 px-4.5 text-[13px] font-bold text-white shadow-sm shadow-brand-500/30 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/35 active:translate-y-0 sm:inline-flex"
            >
              {/* Light sweep across the button on hover */}
              <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[300%]" />
              <span className="relative">Book a Repair</span>
              <ArrowRight className="relative size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <button
              className={clsx('flex size-10 items-center justify-center rounded-full transition-colors duration-200 xl:hidden', overlay ? 'text-white hover:bg-white/10' : 'text-navy-900 hover:bg-navy-50')}
              onClick={() => setOpen(!open)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </header>
      <SiteSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile menu: dimmed backdrop + floating panel that drops down from the bar */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={clsx(
          'fixed inset-0 z-30 bg-navy-950/40 backdrop-blur-[3px] transition-[opacity,visibility] duration-400 ease-out xl:hidden',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      />
      <div
        id="mobile-menu"
        data-lenis-prevent
        className={clsx(
          'fixed inset-x-2.5 z-40 origin-top-right overflow-y-auto overscroll-contain rounded-3xl bg-white p-2 shadow-[0_30px_60px_-20px_rgb(7_18_38/0.45)] ring-1 ring-navy-900/5 will-change-transform sm:inset-x-4 sm:left-auto sm:w-[400px] xl:hidden',
          'transition-[opacity,translate,scale,visibility] duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)]',
          island ? 'top-[74px] max-h-[calc(100svh-86px)] sm:top-[78px]' : 'top-[104px] max-h-[calc(100svh-116px)]',
          open ? 'visible translate-x-0 translate-y-0 scale-100 opacity-100' : 'invisible translate-x-10 -translate-y-4 scale-[0.94] opacity-0',
        )}
      >
        <nav className="flex flex-col" aria-label="Mobile">
          {NAV.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              style={{ transitionDelay: open ? `${120 + i * 40}ms` : '0ms' }}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center justify-between rounded-2xl px-4 py-3 text-[16px] font-semibold transition-[opacity,translate,background-color,color] duration-500 ease-[cubic-bezier(.22,1,.36,1)]',
                  open ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
                  isActive ? 'bg-brand-50 text-brand-600' : 'text-navy-900 hover:bg-navy-50 active:bg-navy-100',
                )
              }
            >
              {n.label}
              <ArrowRight className="size-4 opacity-30 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:opacity-60" />
            </NavLink>
          ))}
          <div
            style={{ transitionDelay: open ? `${120 + NAV.length * 40}ms` : '0ms' }}
            className={clsx(
              'mt-2 grid gap-2 border-t border-navy-100 p-2 pt-4 transition-[opacity,translate] duration-500 ease-[cubic-bezier(.22,1,.36,1)]',
              open ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
            )}
          >
            <Link
              to="/book"
              className="flex h-12 items-center justify-center gap-2 rounded-md bg-brand-600 font-bold text-white shadow-lg shadow-brand-500/30 transition-colors active:bg-brand-600"
            >
              Book a Repair <ArrowRight className="size-4" />
            </Link>
            <a href={BUSINESS.phoneHref} className="flex h-11 items-center justify-center gap-2 rounded-md font-semibold text-navy-700 active:bg-navy-50">
              <Phone className="size-4" /> {BUSINESS.phone}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="bg-navy-950 text-navy-200">
      <div data-stagger className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-300">
            Air Suspension • Hydraulic Suspension • Shock Absorber Repair & Rebuilding. Book online, approve your quote and track every repair from intake to completion.
          </p>
          <div className="mt-5 flex gap-2">
            <a href={BUSINESS.whatsappHref} target="_blank" rel="noreferrer" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-[#25D366]" aria-label="WhatsApp">
              <WhatsAppIcon className="size-5" />
            </a>
            {BUSINESS.email && (
              <a href={`mailto:${BUSINESS.email}`} className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-brand-500" aria-label="Email">
                <Mail className="size-5" />
              </a>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold tracking-wider text-white uppercase">Services</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {['Air Suspension Repair', 'Hydraulic Suspension Repair', 'Shock Absorber Rebuilding', 'Automatic Transmission Rebuilding', 'Air Strut Rebuilding', 'Compressor Repair', 'Suspension Diagnostics'].map((s) => (
              <li key={s}>
                <Link to="/services" className="hover:text-brand-400">{s}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold tracking-wider text-white uppercase">Customers</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ['/book', 'Book a Repair'],
              ['/track', 'Track My Repair'],
              ['/quote', 'Get a Quote'],
              ['/warranty', 'Warranty'],
              ['/faqs', 'FAQs'],
              ['/about', 'About Us'],
            ].map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="hover:text-brand-400">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold tracking-wider text-white uppercase">Visit the Workshop</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {BUSINESS.address && <li className="flex gap-3"><MapPin className="size-5 shrink-0 text-brand-400" /> {BUSINESS.address}</li>}
            <li className="flex gap-3"><Phone className="size-5 shrink-0 text-brand-400" /> <a href={BUSINESS.phoneHref} className="hover:text-white">{BUSINESS.phone}</a></li>
            {BUSINESS.email && <li className="flex gap-3"><Mail className="size-5 shrink-0 text-brand-400" /> <a href={`mailto:${BUSINESS.email}`} className="hover:text-white">{BUSINESS.email}</a></li>}
            <li className="flex gap-3"><Clock className="size-5 shrink-0 text-brand-400" /> {BUSINESS.hours}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-navy-400 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
          <Link to="/staff" className="hover:text-navy-200">Staff login</Link>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  useSeo();
  useSmoothScroll();
  useScrollReveal();
  useParallax();
  const { pathname } = useLocation();
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      scrollToTopInstant();
      return;
    }
    // Pages load lazily, so wait for the target to exist before scrolling to it.
    let tries = 0;
    const id = setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el || ++tries > 30) {
        clearInterval(id);
        if (el) smoothScrollTo(el);
      }
    }, 60);
    return () => clearInterval(id);
  }, [pathname, hash]);

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <Header />
      <main id="main" className={clsx('flex-1', pathname !== '/' && 'pt-[96px] xl:pt-[100px]')}>
        {/* Keyed by path so each page fades in on navigation */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <Footer />
      <a
        href={BUSINESS.whatsappHref}
        target="_blank"
        rel="noreferrer"
        className="no-print fixed right-4 bottom-4 z-30 hidden size-14 md:flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:scale-105 sm:right-6 sm:bottom-6"
        aria-label="Chat with us on WhatsApp"
      >
        <WhatsAppIcon className="size-7" />
      </a>
      <BackToTop />
      <MobileBar />
    </div>
  );
}

/** Clean white strip above the navbar: phone, opening hours and a quick link. Hidden once the page scrolls. */
function TopBar() {
  return (
    <div className="border-b border-navy-100 bg-white">
      <div className="container-x flex h-9 items-center justify-between gap-4 text-[12.5px] text-navy-700">
        <div className="flex min-w-0 items-center gap-5">
          <a href={BUSINESS.phoneHref} className="flex items-center gap-1.5 font-semibold text-navy-950 transition-colors hover:text-brand-600">
            <Phone className="size-3.5 text-brand-600" strokeWidth={2} /> {BUSINESS.phone}
          </a>
          {BUSINESS.hours && (
            <span className="hidden items-center gap-1.5 truncate sm:flex">
              <Clock className="size-3.5 text-brand-600" strokeWidth={2} /> {BUSINESS.hours}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          <Link to="/account" className="flex items-center gap-1.5 font-semibold text-navy-950 transition-colors hover:text-brand-600">
            <User className="size-3.5 text-brand-600" strokeWidth={2} /> My repairs
          </Link>
          <Link to="/contact" className="group flex items-center gap-1.5 font-semibold text-navy-950 transition-colors hover:text-brand-600">
            <span className="hidden sm:inline">Visit the workshop</span>
            <span className="sm:hidden">Contact</span>
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Thin, round back-to-top button with a scroll-progress ring. Appears only after scrolling down. */
function BackToTop() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setVisible(window.scrollY > 600);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  const C = 2 * Math.PI * 21;
  return (
    <button
      onClick={scrollToTopSmooth}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      className={clsx(
        'no-print group fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-30 sm:right-[30px] md:right-[22px] md:bottom-[84px] flex size-12 items-center justify-center rounded-full bg-white/90 text-navy-950 shadow-[0_8px_24px_-8px_rgb(7_18_38/0.35)] backdrop-blur transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] hover:bg-navy-950 hover:text-white lg:right-[30px] lg:bottom-[92px]',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1.25" />
        <circle cx="24" cy="24" r="21" fill="none" stroke="var(--color-brand-600)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
      </svg>
      <ArrowUp className="size-[18px] transition-transform duration-300 group-hover:-translate-y-0.5" strokeWidth={1.5} />
    </button>
  );
}

/** Dark banner used at the top of inner pages: breadcrumb, masked word-by-word title reveal, fine grid texture. */
export function PageHero({ eyebrow, title, intro, children }: { eyebrow?: string; title: React.ReactNode; intro?: React.ReactNode; children?: React.ReactNode }) {
  const words = typeof title === 'string' ? title.split(' ') : null;
  return (
    <section className="relative overflow-hidden bg-navy-950 text-white">
      {/* Fine engineering grid, fading out to the right */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_right,black,transparent_75%)]"
      />
      <div aria-hidden className="absolute -top-40 right-[-10%] size-[520px] rounded-full bg-brand-600/25 blur-[110px]" />
      <div className="container-x relative pt-12 pb-14 sm:pt-16 sm:pb-20">
        <nav aria-label="Breadcrumb" className="animate-rise flex items-center gap-2 text-[13px] text-navy-300">
          <Link to="/" className="transition-colors hover:text-white">Home</Link>
          <span className="text-navy-500">/</span>
          <span className="text-white">{eyebrow}</span>
        </nav>
        <h1 className="mt-5 max-w-4xl text-[2.35rem] leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-6xl">
          {words
            ? words.map((w, i) => (
                <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                  <span className="animate-word inline-block" style={{ animationDelay: `${120 + i * 70}ms` }}>
                    {w}
                    {i < words.length - 1 ? ' ' : ''}
                  </span>
                </span>
              ))
            : title}
        </h1>
        {intro && (
          <p className="animate-rise mt-5 max-w-2xl text-[16.5px] leading-relaxed text-navy-200 sm:text-lg" style={{ animationDelay: `${250 + (words?.length ?? 3) * 70}ms` }}>
            {intro}
          </p>
        )}
        <span aria-hidden className="animate-line absolute bottom-0 left-4 h-[3px] w-24 origin-left bg-brand-500 sm:left-6 lg:left-8" />
        {children}
      </div>
    </section>
  );
}
