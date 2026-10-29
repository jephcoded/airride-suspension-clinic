/** Kobo -> "₦185,000" */
export function naira(kobo: number | null | undefined) {
  if (kobo == null) return '—';
  return '₦' + (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

const TZ = 'Africa/Lagos';

export function date(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

export function dateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ });
}

export function shortDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: TZ });
}

export function displayPhone(p: string | null | undefined) {
  if (!p) return '—';
  return p.startsWith('234') && p.length === 13 ? `0${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p;
}

export function timeAgo(d: string | Date) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return date(d);
}
