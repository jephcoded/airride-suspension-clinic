import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STAGE_LABELS, type Stage } from '../../lib/constants';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-10 text-navy-400', className)}>
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

const tone = {
  gray: 'bg-navy-50 text-navy-600 ring-navy-200',
  orange: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
};

export function Badge({ children, color = 'gray', className }: { children: ReactNode; color?: keyof typeof tone; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tone[color], className)}>{children}</span>;
}

export function stageColor(stage: Stage): keyof typeof tone {
  if (stage === 'CANCELLED') return 'red';
  if (['COMPLETED', 'DELIVERED', 'READY_FOR_COLLECTION', 'DISPATCHED'].includes(stage)) return 'green';
  if (['QUOTE_SENT', 'AWAITING_APPROVAL'].includes(stage)) return 'amber';
  if (['REQUEST_SUBMITTED', 'AWAITING_COMPONENT'].includes(stage)) return 'blue';
  return 'orange';
}

export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge color={stageColor(stage)}>{STAGE_LABELS[stage]}</Badge>;
}

export function Alert({ kind = 'info', title, children, className }: { kind?: 'info' | 'error' | 'success'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = kind === 'error' ? AlertCircle : kind === 'success' ? CheckCircle2 : Info;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={clsx(
        'flex gap-3 rounded-xl border p-4 text-sm',
        kind === 'error' && 'border-red-200 bg-red-50 text-red-800',
        kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        kind === 'info' && 'border-sky-200 bg-sky-50 text-sky-900',
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('rounded-2xl border border-navy-100 bg-white shadow-card', className)}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, intro, align = 'left', dark, action }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; align?: 'left' | 'center'; dark?: boolean; action?: ReactNode }) {
  return (
    <div data-reveal className={clsx('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', align === 'center' && 'items-center text-center sm:flex-col sm:items-center')}>
      <div className={clsx(align === 'center' && 'mx-auto max-w-2xl')}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className={clsx('mt-3 text-3xl font-bold sm:text-4xl', dark ? 'text-white' : 'text-navy-900')}>{title}</h2>
        {intro && <p className={clsx('mt-3 text-base sm:text-lg', dark ? 'text-navy-200' : 'text-navy-500')}>{intro}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Photo slot: shows /images/<name> when the client's photo exists, otherwise a branded placeholder
 * so the layout never breaks while real workshop photos are being collected.
 */
export function ImageSlot({ src, alt, className, label }: { src: string; alt: string; className?: string; label?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={clsx('relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy-700 via-navy-900 to-navy-950', className)} role="img" aria-label={alt}>
        <div className="absolute inset-0 bg-tread" />
        <div className="absolute -right-10 -bottom-10 size-48 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-2 text-navy-300">
          <Wrench className="size-8 text-brand-400" />
          {label && <span className="px-4 text-center text-xs font-medium tracking-wide uppercase">{label}</span>}
        </div>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={clsx('object-cover', className)} />;
}

/** Brand blue sampled from the client's logo. */
export const LOGO_BLUE = '#0058c4';

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={clsx('group flex shrink-0 items-center gap-2.5', className)} aria-label="Airride Suspension Clinic — home">
      {/* The emblem has a black background, so it sits in a dark rounded badge. */}
      <span className="flex h-10 w-[62px] items-center justify-center overflow-hidden rounded-lg bg-black ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.04]">
        <img src="/logo-mark.png" alt="" className="h-full w-full object-contain" />
      </span>
      <span className={clsx('leading-none', light && '[text-shadow:0_1px_8px_rgb(0_0_0/0.6)]')}>
        <span className={clsx('block font-brand text-[22px] font-extrabold tracking-wide italic', light ? 'text-white' : 'text-navy-950')}>
          <span style={{ color: light ? '#4f86ff' : LOGO_BLUE }}>AIR</span>RIDE
        </span>
        <span className={clsx('mt-0.5 block text-[9px] font-semibold tracking-[0.32em] uppercase', light ? 'text-white/85' : 'text-navy-400')}>
          Suspension <span style={{ color: light ? '#93b4ff' : LOGO_BLUE }}>Clinic</span>
        </span>
      </span>
    </Link>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-navy-50 text-navy-400">{icon}</div>}
      <p className="font-semibold text-navy-800">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-navy-500">{children}</div>}
    </div>
  );
}

/** Shimmering placeholder block shown while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('skeleton rounded-lg', className)} />;
}

/** Outline of an inner page (banner + content) while it loads. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="bg-navy-950">
        <div className="container-x space-y-4 pt-12 pb-14">
          <div className="skeleton-dark h-3 w-28 rounded" />
          <div className="skeleton-dark h-10 w-3/4 max-w-xl rounded-lg" />
          <div className="skeleton-dark h-4 w-2/3 max-w-lg rounded" />
        </div>
      </div>
      <div className="container-x grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-navy-100 p-6">
            <Skeleton className="size-12" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Outline of the repair tracker while a repair loads. */
export function TrackSkeleton() {
  return (
    <div role="status" aria-label="Loading your repair" className="bg-navy-50/60 pb-16">
      <div className="bg-navy-950">
        <div className="container-x space-y-3 py-8 sm:py-12">
          <div className="skeleton-dark h-8 w-56 rounded-lg" />
          <div className="skeleton-dark h-4 w-72 max-w-full rounded" />
        </div>
      </div>
      <div className="container-x space-y-6 pt-6">
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-48" />
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl bg-white p-6 shadow-card">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      </div>
    </div>
  );
}
