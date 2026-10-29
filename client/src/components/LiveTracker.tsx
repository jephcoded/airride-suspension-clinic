import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  Camera,
  Check,
  Copy,
  CreditCard,
  FileText,
  Hourglass,
  Share,
  UserCog,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { BUSINESS, CUSTOMER_MILESTONES, type Stage } from '../lib/constants';
import { dateTime, naira, shortDate } from '../lib/format';
import { disablePush, enablePush, pushState, type PushState } from '../lib/push';
import { AxiosError } from 'axios';
import { errorMessage } from '../lib/api';
import { StageBadge } from './ui/misc';
import type { TrackView } from '../pages/TrackDetail';

/** Re-renders every `ms` so "updated 8s ago" style labels keep counting. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function duration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return `${m || 1} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function progress(stage: Stage) {
  const finished = stage === 'COMPLETED' || stage === 'DELIVERED';
  const current = CUSTOMER_MILESTONES.findIndex((m) => m.stages.includes(stage));
  const pct = finished ? 100 : Math.round(((current + 1) / CUSTOMER_MILESTONES.length) * 100);
  return { finished, current, pct };
}

/** When each customer milestone was first reached (from the repair timeline). */
function milestoneTimes(data: TrackView) {
  return CUSTOMER_MILESTONES.map((m, i) => {
    if (i === 0) return data.createdAt;
    return data.timeline.find((t) => t.stage && m.stages.includes(t.stage))?.at ?? null;
  });
}

// ---------------------------------------------------------------------------

export function LiveHeader({ data, lastSync, online, syncing }: { data: TrackView; lastSync: number; online: boolean; syncing: boolean }) {
  const now = useNow(1000);
  const { pct, current, finished } = progress(data.stage);
  const cancelled = data.stage === 'CANCELLED';
  const vehicle = [data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(' ');
  const enteredStage = [...data.timeline].reverse().find((t) => t.stage === data.stage)?.at ?? data.createdAt;
  const eta = data.estimatedCompletion ? new Date(data.estimatedCompletion) : null;
  const daysLeft = eta ? Math.ceil((eta.getTime() - now) / 86_400_000) : null;
  const stale = now - lastSync > 45_000;
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Repair ${data.repairId}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <section className="relative overflow-hidden bg-navy-950 bg-tread text-white">
      <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-brand-600/25 blur-3xl" />
      <div className="container-x relative py-7 sm:py-10">
        {/* Live connection bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-brand-300 uppercase">
            <span className="h-px w-6 bg-brand-400" /> Live repair tracking
          </p>
          <div
            className={clsx(
              'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1',
              !online || stale ? 'bg-amber-400/10 text-amber-200 ring-amber-300/30' : 'bg-emerald-400/10 text-emerald-200 ring-emerald-300/25',
            )}
            role="status"
            aria-live="polite"
          >
            {!online ? (
              <><WifiOff className="size-3.5" /> Offline. Reconnecting…</>
            ) : (
              <>
                <span className="relative flex size-2">
                  {!stale && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className={clsx('relative inline-flex size-2 rounded-full', stale ? 'bg-amber-300' : 'bg-emerald-400')} />
                </span>
                {syncing ? 'Checking for updates…' : stale ? 'Reconnecting…' : `Live · updated ${ago(lastSync, now)}`}
                <Wifi className="size-3.5 opacity-60" />
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid items-center gap-7 md:grid-cols-[auto_1fr] md:gap-10">
          {/* Progress ring */}
          <div className="flex items-center gap-5 md:block">
            <ProgressRing pct={cancelled ? 0 : pct} done={finished} cancelled={cancelled} />
            <div className="md:hidden">
              <RepairId id={data.repairId} />
              <p className="mt-1 text-sm text-navy-300">{vehicle}</p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="hidden flex-wrap items-center gap-3 md:flex">
              <RepairId id={data.repairId} />
              <StageBadge stage={data.stage} />
            </div>
            <p className="mt-1 hidden text-navy-300 md:block">
              {vehicle} · {data.component}
              {data.position ? ` (${data.position})` : ''}
            </p>
            <p className="mt-0 text-sm font-semibold text-navy-300 md:mt-5">
              {cancelled ? 'Repair cancelled' : finished ? 'All steps complete' : `Step ${current + 1} of ${CUSTOMER_MILESTONES.length}`}
            </p>
            <h1 className="mt-1 text-[28px] leading-tight font-bold sm:text-4xl">{data.stageLabel}</h1>
            <p className="mt-2 max-w-2xl text-[15px] text-navy-200 sm:text-base">{data.stageMessage}</p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {!finished && !cancelled && (
                <Chip icon={<Hourglass className="size-4" />} label="In this step" value={duration(now - new Date(enteredStage).getTime())} />
              )}
              {eta && !data.completedAt && !cancelled && (
                <Chip
                  icon={<CalendarClock className="size-4" />}
                  label="Estimated ready"
                  value={`${shortDate(eta)}${daysLeft != null ? (daysLeft > 1 ? ` · in ${daysLeft} days` : daysLeft === 1 ? ' · tomorrow' : daysLeft === 0 ? ' · today' : '') : ''}`}
                  tone="brand"
                />
              )}
              {data.completedAt && <Chip icon={<Check className="size-4" />} label="Completed" value={shortDate(data.completedAt)} tone="green" />}
              {data.technician && <Chip icon={<UserCog className="size-4" />} label="Technician" value={data.technician} />}
              <button onClick={share} className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-navy-100 ring-1 ring-white/10 transition hover:bg-white/10">
                {copied ? <Check className="size-4 text-emerald-300" /> : <Share className="size-4" />} {copied ? 'Link copied' : 'Share tracking'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RepairId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(id).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="group inline-flex items-center gap-2 font-mono text-xl font-bold tracking-wide sm:text-3xl"
      aria-label={`Copy Repair ID ${id}`}
    >
      {id}
      {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4 text-navy-400 transition group-hover:text-white" />}
    </button>
  );
}

function Chip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'brand' | 'green' }) {
  return (
    <div className={clsx('flex items-center gap-2.5 rounded-lg px-3 py-2 ring-1', tone === 'brand' ? 'bg-brand-500/15 ring-brand-400/30' : tone === 'green' ? 'bg-emerald-500/15 ring-emerald-400/30' : 'bg-white/5 ring-white/10')}>
      <span className={clsx(tone === 'brand' ? 'text-brand-300' : tone === 'green' ? 'text-emerald-300' : 'text-navy-300')}>{icon}</span>
      <span className="leading-tight">
        <span className="block text-[11px] font-semibold tracking-wide text-navy-400 uppercase">{label}</span>
        <span className="block text-sm font-semibold text-white">{value}</span>
      </span>
    </div>
  );
}

function ProgressRing({ pct, done, cancelled }: { pct: number; done: boolean; cancelled: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  // Animate from 0 on first paint, then smoothly to each new value.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className="relative size-[112px] shrink-0 sm:size-[136px]">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={cancelled ? '#f87171' : done ? '#34d399' : 'url(#ring-grad)'}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (shown / 100) * c}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)' }}
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#4f86ff" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {cancelled ? (
          <X className="size-8 text-red-300" />
        ) : done ? (
          <Check className="size-9 text-emerald-300" strokeWidth={3} />
        ) : (
          <>
            <span className="text-3xl font-bold tabular-nums sm:text-4xl">{pct}%</span>
            <span className="text-[10px] font-semibold tracking-widest text-navy-400 uppercase">complete</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The 8 customer steps, with the date/time each was reached. */
export function MilestoneTrack({ data }: { data: TrackView }) {
  const { current, finished } = progress(data.stage);
  const times = useMemo(() => milestoneTimes(data), [data]);
  if (data.stage === 'CANCELLED') return null;
  const n = CUSTOMER_MILESTONES.length;
  const fill = finished ? 100 : (current / (n - 1)) * 100;
  return (
    <div>
      {/* Desktop: horizontal */}
      <div className="relative hidden md:block">
        <div className="absolute top-[18px] right-[6.25%] left-[6.25%] h-1.5 overflow-hidden rounded-full bg-navy-100">
          <div className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand-500 transition-[width] duration-1000 ease-out" style={{ width: `${fill}%` }}>
            {!finished && <span className="progress-sheen absolute inset-0" />}
          </div>
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {CUSTOMER_MILESTONES.map((m, i) => {
            const done = i < current || finished;
            const now = i === current && !finished;
            return (
              <li key={m.label} className="flex flex-col items-center text-center">
                <span
                  className={clsx(
                    'flex size-10 items-center justify-center rounded-full border-4 border-white transition-colors duration-500',
                    done ? 'bg-emerald-500 text-white' : now ? 'animate-pulse-ring bg-brand-500 text-white' : 'bg-navy-100 text-navy-400',
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : now ? <Wrench className="size-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </span>
                <span className={clsx('mt-2 text-[13px] font-semibold', now ? 'text-brand-600' : done ? 'text-navy-900' : 'text-navy-400')}>{m.label}</span>
                <span className="mt-0.5 h-4 text-[11px] text-navy-400">{(done || now) && times[i] ? shortDate(times[i]!) : now ? 'Now' : ''}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {/* Phone: vertical */}
      <ol className="md:hidden">
        {CUSTOMER_MILESTONES.map((m, i) => {
          const done = i < current || finished;
          const now = i === current && !finished;
          return (
            <li key={m.label} className="relative flex items-start gap-3.5 pb-4 last:pb-0">
              {i < n - 1 && <span className={clsx('absolute top-8 left-[15px] h-[calc(100%-24px)] w-0.5 transition-colors duration-500', done ? 'bg-emerald-500' : 'bg-navy-100')} />}
              <span
                className={clsx(
                  'relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-500',
                  done ? 'bg-emerald-500 text-white' : now ? 'animate-pulse-ring bg-brand-500 text-white' : 'border-2 border-navy-200 bg-white text-navy-300',
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : now ? <Wrench className="size-3.5" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
              </span>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pt-1">
                <span className={clsx('text-[15px] font-semibold', now ? 'text-brand-600' : done ? 'text-navy-900' : 'text-navy-400')}>{m.label}</span>
                {now ? (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200">In progress</span>
                ) : done && times[i] ? (
                  <span className="text-xs text-navy-400">{dateTime(times[i])}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------

type FeedItem = { id: string; at: string; kind: 'stage' | 'note' | 'photos' | 'payment'; title: string; text?: string | null; photos?: TrackView['media'] };

/** Everything that happened on this repair, newest first: steps, notes, photos and payments. */
export function ActivityFeed({ data, seenAt, onOpenPhoto }: { data: TrackView; seenAt: number; onOpenPhoto?: (id: string) => void }) {
  const now = useNow(30_000);
  const items = useMemo(() => {
    const out: FeedItem[] = data.timeline.map((t) => ({ id: t.id, at: t.at, kind: t.stage ? 'stage' : 'note', title: t.title, text: t.note }));
    // Photos uploaded within a few minutes of each other become one entry.
    const photos = data.media.filter((m) => m.phase !== 'CUSTOMER');
    let group: FeedItem | null = null;
    for (const m of photos) {
      if (group && Math.abs(new Date(m.at).getTime() - new Date(group.at).getTime()) < 10 * 60_000) group.photos!.push(m);
      else {
        group = { id: 'ph-' + m.id, at: m.at, kind: 'photos', title: '', photos: [m] };
        out.push(group);
      }
    }
    for (const g of out) if (g.kind === 'photos') g.title = g.photos!.length === 1 ? 'New photo from the workshop' : `${g.photos!.length} new photos from the workshop`;
    for (const r of data.payment.receipts) out.push({ id: 'pay-' + r.receiptNumber, at: r.paidAt, kind: 'payment', title: `Payment received: ${naira(r.amount)}`, text: `Receipt ${r.receiptNumber}` });
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [data]);

  const icon = (k: FeedItem['kind']) =>
    k === 'photos' ? <Camera className="size-4" /> : k === 'payment' ? <CreditCard className="size-4" /> : k === 'note' ? <FileText className="size-4" /> : <Check className="size-4" strokeWidth={3} />;

  return (
    <ol className="mt-6">
      {items.map((t, i) => {
        const fresh = new Date(t.at).getTime() > seenAt;
        return (
          <li key={t.id} className={clsx('relative flex gap-4 pb-6 last:pb-0', fresh && 'animate-feed-in')}>
            {i < items.length - 1 && <span className="absolute top-9 left-[17px] h-[calc(100%-28px)] w-0.5 bg-navy-100" />}
            <span
              className={clsx(
                'relative flex size-9 shrink-0 items-center justify-center rounded-full',
                i === 0 ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' : t.kind === 'payment' ? 'bg-emerald-50 text-emerald-600' : t.kind === 'photos' ? 'bg-sky-50 text-sky-600' : 'bg-navy-50 text-navy-500',
              )}
            >
              {icon(t.kind)}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-semibold text-navy-900">{t.title}</p>
                {fresh && <span className="rounded bg-brand-500 px-1.5 py-px text-[10px] font-bold tracking-wide text-white uppercase">New</span>}
              </div>
              <p className="mt-0.5 text-xs text-navy-400" title={dateTime(t.at)}>
                {ago(new Date(t.at).getTime(), now)} · {dateTime(t.at)}
              </p>
              {t.text && <p className="mt-1.5 text-[15px] whitespace-pre-line text-navy-600">{t.text}</p>}
              {t.photos && (
                <div className="mt-2.5 flex gap-2">
                  {t.photos.slice(0, 4).map((m, j) => (
                    <button key={m.id} onClick={() => onOpenPhoto?.(m.id)} className="relative size-16 overflow-hidden rounded-lg bg-navy-100 sm:size-20" aria-label="View photo">
                      {m.mimeType.startsWith('image/') ? <img src={m.url} alt={m.caption ?? ''} loading="lazy" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-xs text-navy-500">Video</span>}
                      {j === 3 && t.photos!.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-navy-950/60 text-sm font-bold text-white">+{t.photos!.length - 4}</span>}
                    </button>
                  ))}
                </div>
              )}
              {i === 0 && t.kind !== 'payment' && (
                <a
                  href={replyLink(data.repairId, t.title)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1 text-[13px] font-semibold text-emerald-700 transition hover:bg-[#25D366]/20"
                >
                  <WhatsAppGlyph className="size-3.5" /> Reply on WhatsApp
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Opens a WhatsApp chat with the workshop, with the repair and update already typed. Free for everyone. */
export function replyLink(repairId: string, about: string) {
  return `${BUSINESS.whatsappHref}?text=${encodeURIComponent(`Hello ${BUSINESS.name}, about my repair ${repairId} ("${about}"): `)}`;
}

export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5a9.47 9.47 0 01-4.83-1.32l-.35-.21-3.59.94.96-3.5-.23-.36a9.45 9.45 0 01-1.45-5.04c0-5.23 4.26-9.49 9.5-9.49 2.54 0 4.92.99 6.71 2.79a9.43 9.43 0 012.78 6.71c0 5.24-4.26 9.49-9.49 9.49zm8.08-17.57A11.35 11.35 0 0012.04.5C5.74.5.62 5.62.62 11.92c0 2.01.53 3.98 1.53 5.71L.5 23.5l6.02-1.58a11.4 11.4 0 005.45 1.39c6.3 0 11.42-5.12 11.42-11.42 0-3.05-1.19-5.92-3.35-8.08z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------

/** "Get live alerts on this phone" (Web Push). */
export function AlertsCard({ repairId, auth }: { repairId: string; auth: Record<string, string> }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    pushState(repairId).then(setState).catch(() => setState('unsupported'));
  }, [repairId]);
  if (!state || state === 'unsupported') return null;

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await fn());
    } catch (e) {
      // Server problems get the server's message; browser push failures get one plain explanation.
      setError(
        e instanceof AxiosError
          ? errorMessage(e)
          : e instanceof Error && e.message.startsWith('Alerts')
            ? e.message
            : 'Alerts could not be turned on in this browser. Try Chrome, or open the site outside private mode.',
      );
    } finally {
      setBusy(false);
    }
  };

  const on = state === 'on';
  return (
    <div className={clsx('flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:p-6', on ? 'border-emerald-200 bg-emerald-50' : 'border-brand-200 bg-white shadow-card')}>
      <span className={clsx('flex size-12 shrink-0 items-center justify-center rounded-xl', on ? 'bg-emerald-500 text-white' : 'bg-brand-50 text-brand-600')}>
        {on ? <BellRing className="size-6" /> : state === 'blocked' ? <BellOff className="size-6" /> : <Bell className="size-6" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-navy-900">{on ? 'Live alerts are on for this phone' : 'Get live alerts on this phone'}</p>
        <p className="mt-0.5 text-sm text-navy-600">
          {on
            ? 'We will alert you the moment anything changes: each step, new photos, quotes and payments.'
            : state === 'blocked'
              ? 'Notifications are blocked for this site. Allow them in your browser settings (tap the lock icon by the address), then try again.'
              : state === 'ios-install'
                ? 'On iPhone: tap Share, then "Add to Home Screen". Open Airride from your Home Screen and turn on alerts there.'
                : 'Be notified instantly when your repair moves to the next step, even when this page is closed.'}
        </p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      {state === 'off' && (
        <button onClick={() => run(() => enablePush(repairId, auth))} disabled={busy} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
          <Bell className="size-4" /> {busy ? 'Turning on…' : 'Turn on alerts'}
        </button>
      )}
      {on && (
        <button onClick={() => run(() => disablePush(repairId, auth))} disabled={busy} className="shrink-0 text-sm font-semibold text-navy-500 hover:text-navy-900">
          {busy ? 'Turning off…' : 'Turn off'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function UpdateToast({ title, text, repairId, onClose }: { title: string; text: string; repairId?: string; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 9000);
    return () => clearTimeout(id);
  }, [onClose, title, text]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3" role="status" aria-live="assertive">
      <div className="animate-toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-navy-950 p-4 text-white shadow-2xl ring-1 ring-white/10">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-widest text-emerald-300 uppercase">Repair update</p>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-navy-300">{text}</p>
          {repairId && (
            <a href={replyLink(repairId, title)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-300 hover:text-emerald-200">
              <WhatsAppGlyph className="size-3.5" /> Reply on WhatsApp
            </a>
          )}
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-navy-400 hover:bg-white/10 hover:text-white" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
