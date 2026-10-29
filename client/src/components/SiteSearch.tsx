import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarCheck, CornerDownLeft, FileText, HelpCircle, Hash, Search, Wrench, X } from 'lucide-react';
import { FAQS, SERVICES } from '../lib/content';
import { BUSINESS } from '../lib/constants';
import { normalizeRepairId } from './TrackForm';
import { setScrollLocked } from '../lib/smoothScroll';

type Kind = 'Action' | 'Page' | 'Service' | 'FAQ';
type Entry = { kind: Kind; title: string; text?: string; to: string; keywords?: string };

const PAGES: Entry[] = [
  { kind: 'Action', title: 'Book a Repair', text: 'Send us your suspension details and get a Repair ID', to: '/book', keywords: 'book booking order request start repair send shock strut' },
  { kind: 'Action', title: 'Track My Repair', text: 'Check the live status of your repair', to: '/track', keywords: 'track tracking status progress where is my repair id order' },
  { kind: 'Action', title: 'My Repairs', text: 'Sign in to see all your repairs, receipts and warranties', to: '/account', keywords: 'account login sign in history my repairs receipts invoices warranty vehicles' },
  { kind: 'Action', title: 'Get a Quote', text: 'Ask for a repair estimate', to: '/quote', keywords: 'quote price cost estimate how much charge fee' },
  { kind: 'Page', title: 'Home', to: '/', keywords: 'home start main' },
  { kind: 'Page', title: 'About Us', text: 'Who we are and how we work', to: '/about', keywords: 'about company team who workshop story' },
  { kind: 'Page', title: 'Services', text: 'Everything we repair and rebuild', to: '/services', keywords: 'services repairs list what do you fix' },
  { kind: 'Page', title: 'Warranty', text: "What's covered and how to claim", to: '/warranty', keywords: 'warranty guarantee claim cover covered expiry' },
  { kind: 'Page', title: 'FAQs', text: 'Answers to common questions', to: '/faqs', keywords: 'faq faqs questions help answers' },
  { kind: 'Page', title: 'Contact Us', text: 'Phone, WhatsApp, email and workshop address', to: '/contact', keywords: 'contact phone call whatsapp email address location map directions hours open' },
];

const INDEX: Entry[] = [
  ...PAGES,
  ...SERVICES.map((s) => ({ kind: 'Service' as const, title: s.title, text: s.text, to: `/services#${s.id}`, keywords: s.points.join(' ') })),
  ...FAQS.map(([q, a], i) => ({ kind: 'FAQ' as const, title: q, text: a, to: `/faqs#faq-${i}` })),
];

/** Shown as tappable chips before the visitor types anything. */
const POPULAR = ['Air strut', 'Shock absorber', 'Compressor', 'Hydraulic pump', 'Warranty', 'Payment'];

const KIND_STYLE: Record<Kind, { icon: typeof Search; label: string; tint: string; on: string }> = {
  Action: { icon: CalendarCheck, label: 'Quick actions', tint: 'bg-brand-50 text-brand-600', on: 'bg-brand-500 text-white' },
  Service: { icon: Wrench, label: 'Services', tint: 'bg-brand-50 text-brand-600', on: 'bg-brand-500 text-white' },
  FAQ: { icon: HelpCircle, label: 'Questions', tint: 'bg-sky-50 text-sky-600', on: 'bg-sky-500 text-white' },
  Page: { icon: FileText, label: 'Pages', tint: 'bg-navy-50 text-navy-500', on: 'bg-navy-800 text-white' },
};

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches the start of a word only, so "air" finds "Air strut" but not "Repair". */
const wordStart = (w: string) => new RegExp(`(^|[^a-z0-9])${esc(w)}`, 'i');

function score(e: Entry, words: string[]) {
  const title = e.title;
  const rest = `${e.keywords ?? ''} ${e.text ?? ''}`;
  let total = 0;
  for (const w of words) {
    const re = wordStart(w);
    if (title.toLowerCase().startsWith(w)) total += 6;
    else if (re.test(title)) total += 4;
    else if (re.test(rest)) total += 1;
    else return 0; // every word must match somewhere
  }
  return total + (e.kind === 'Action' ? 0.5 : 0);
}

/** Highlights the matched words in a result title. */
function Mark({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  // Highlight only word-start matches, consistent with how results are found.
  const re = new RegExp(`\\b(${words.map(esc).join('|')})`, 'ig');
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} className="text-brand-600 underline decoration-brand-300 decoration-2 underline-offset-[3px]">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

export function SiteSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    setScrollLocked(true);
    return () => {
      clearTimeout(id);
      setScrollLocked(false);
    };
  }, [open]);

  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter((w) => w.length > 0), [query]);

  const results = useMemo(() => {
    const out: Entry[] = [];
    // Someone pasting their Repair ID goes straight to tracking it.
    const id = normalizeRepairId(query);
    if (/^ARC-\d{4}-\d{5}$/.test(id)) out.push({ kind: 'Action', title: `Track repair ${id}`, text: 'Open the live status of this repair', to: `/track/${id}` });
    if (!words.length) return out;
    return [
      ...out,
      ...INDEX.map((e) => ({ e, s: score(e, words) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 9)
        .map((r) => r.e),
    ];
  }, [query, words]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(e: Entry | undefined) {
    if (!e) return;
    onClose();
    navigate(e.to);
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      choose(results[active]);
    } else if (ev.key === 'Escape') {
      onClose();
    }
  }

  // Group results under headings while keeping one continuous keyboard order.
  const groups: { kind: Kind; items: { e: Entry; i: number }[] }[] = [];
  results.forEach((e, i) => {
    const g = groups.find((x) => x.kind === e.kind);
    if (g) g.items.push({ e, i });
    else groups.push({ kind: e.kind, items: [{ e, i }] });
  });

  const showHome = !words.length && results.length === 0;

  return (
    <div
      className={clsx('fixed inset-0 z-50 transition-[opacity,visibility] duration-300', open ? 'visible opacity-100' : 'invisible opacity-0')}
      role="dialog"
      aria-modal="true"
      aria-label="Search the website"
    >
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-md" onClick={onClose} />

      <div
        className={clsx(
          'relative mx-auto mt-2.5 flex max-h-[calc(100svh-20px)] w-[calc(100%-1.25rem)] max-w-[640px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_40px_100px_-30px_rgb(7_18_38/0.7)] ring-1 ring-white/10 transition-[opacity,translate,scale] duration-300 ease-[cubic-bezier(.22,1,.36,1)] sm:mt-[11vh] sm:max-h-[78vh]',
          open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-4 scale-[0.97] opacity-0',
        )}
      >
        {/* ---------- Input ---------- */}
        <div className="p-3 sm:p-4">
          <label className="group flex h-14 items-center gap-3 rounded-2xl bg-navy-50/80 px-4 ring-1 ring-transparent transition focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgb(26_102_224/0.14)] focus-within:ring-brand-400">
            <Search className="size-5 shrink-0 text-navy-400 transition-colors group-focus-within:text-brand-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="What do you need help with?"
              className="h-full w-full bg-transparent font-display text-[16.5px] font-medium tracking-[-0.01em] text-navy-950 placeholder:font-sans placeholder:font-normal placeholder:text-navy-600 focus:outline-none"
              aria-autocomplete="list"
              aria-controls="site-search-results"
              aria-activedescendant={results.length ? `ssr-${active}` : undefined}
            />
            {query && (
              <button onClick={() => setQuery('')} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy-200/60 text-navy-600 hover:bg-navy-200" aria-label="Clear search">
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            )}
          </label>
        </div>

        <div ref={listRef} data-lenis-prevent id="site-search-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4 sm:pb-4">
          {/* ---------- Empty state ---------- */}
          {showHome && (
            <div className="animate-[rise_.4s_cubic-bezier(.22,1,.36,1)_both]">
              <div className="grid grid-cols-2 gap-2.5">
                <QuickCard
                  onClick={() => choose(PAGES[0])}
                  icon={CalendarCheck}
                  title="Book a Repair"
                  text="Get your Repair ID in 3 minutes"
                  className="bg-brand-600 text-white"
                  iconClass="bg-white/20"
                  textClass="text-white"
                />
                <QuickCard
                  onClick={() => choose(PAGES[1])}
                  icon={Hash}
                  title="Track My Repair"
                  text="Live status with your Repair ID"
                  className="bg-navy-950 text-white"
                  iconClass="bg-white/10 text-brand-400"
                  textClass="text-navy-100"
                />
              </div>

              <p className="mt-6 mb-2.5 px-1 text-[11px] font-bold tracking-[0.12em] text-navy-700 uppercase">Popular searches</p>
              <div className="flex flex-wrap gap-2 px-1">
                {POPULAR.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setQuery(p);
                      inputRef.current?.focus();
                    }}
                    className="rounded-md border border-navy-300 bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-navy-950 transition hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {p}
                  </button>
                ))}
              </div>

              <p className="mt-6 mb-1 px-1 text-[11px] font-bold tracking-[0.12em] text-navy-700 uppercase">Explore</p>
              <div className="grid grid-cols-2 gap-x-2 sm:grid-cols-3">
                {PAGES.filter((p) => p.kind === 'Page' && p.title !== 'Home').map((p) => (
                  <button
                    key={p.to}
                    onClick={() => choose(p)}
                    className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-navy-950 transition hover:bg-navy-50 hover:text-brand-600"
                  >
                    {p.title}
                    <ArrowUpRight className="size-3.5 text-navy-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---------- No results ---------- */}
          {words.length > 0 && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-400">
                <Search className="size-5" />
              </span>
              <p className="mt-4 font-display font-semibold text-navy-900">No results for “{query}”</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-navy-500">Try “air strut”, “warranty” or “payment”. Or ask us directly:</p>
              <a href={BUSINESS.whatsappHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#25D366] px-5 text-sm font-semibold text-white hover:brightness-95">
                Chat on WhatsApp
              </a>
            </div>
          )}

          {/* ---------- Results ---------- */}
          {groups.map((g) => (
            <div key={g.kind} className="mb-1">
              <p className="px-2 pt-2 pb-1.5 text-[11px] font-bold tracking-[0.12em] text-navy-700 uppercase">{KIND_STYLE[g.kind].label}</p>
              {g.items.map(({ e, i }) => {
                const k = KIND_STYLE[e.kind];
                const Icon = e.title.startsWith('Track repair ARC') ? Hash : k.icon;
                const on = i === active;
                return (
                  <div key={e.to + e.title} id={`ssr-${i}`} data-i={i} role="option" aria-selected={on}>
                    <button
                      onMouseMove={() => setActive(i)}
                      onClick={() => choose(e)}
                      className={clsx('relative flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-colors duration-150', on ? 'bg-navy-50' : 'bg-transparent')}
                    >
                      <span className={clsx('absolute top-3 bottom-3 left-0 w-[3px] rounded-full bg-brand-500 transition-opacity', on ? 'opacity-100' : 'opacity-0')} />
                      <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-150', on ? k.on : k.tint)}>
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-navy-950">
                          <Mark text={e.title} words={words} />
                        </span>
                        {e.text && <span className="mt-0.5 block truncate text-[13px] text-navy-700">{e.text}</span>}
                      </span>
                      <span className={clsx('flex size-7 shrink-0 items-center justify-center rounded-lg transition', on ? 'bg-white text-navy-700 shadow-sm' : 'text-navy-300')}>
                        {on ? <CornerDownLeft className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function QuickCard({
  onClick,
  icon: Icon,
  title,
  text,
  className,
  iconClass,
  textClass,
}: {
  onClick: () => void;
  icon: typeof Search;
  title: string;
  text: string;
  className: string;
  iconClass: string;
  textClass: string;
}) {
  return (
    <button onClick={onClick} className={clsx('group relative overflow-hidden rounded-2xl p-3.5 text-left transition duration-300 hover:-translate-y-0.5 sm:p-5', className)}>
      <span className={clsx('relative flex size-10 items-center justify-center rounded-xl', iconClass)}>
        <Icon className="size-5" />
      </span>
      <span className="relative mt-3.5 flex items-center gap-1.5 font-display text-[15px] font-extrabold tracking-[-0.015em] whitespace-nowrap sm:mt-4 sm:text-[15.5px]">
        {title}
        <ArrowRight strokeWidth={2.75} className="hidden size-4 transition-transform duration-300 group-hover:translate-x-1 sm:block" />
      </span>
      <span className={clsx('relative mt-1 block text-[13px] leading-snug font-semibold', textClass)}>{text}</span>
    </button>
  );
}
