import clsx from 'clsx';
import { NavLink, useLocation } from 'react-router-dom';
import { Phone, Search, Wrench } from 'lucide-react';
import { BUSINESS } from '../../lib/constants';

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.47 9.47 0 01-4.83-1.32l-.35-.21-3.59.94.96-3.5-.23-.36a9.45 9.45 0 01-1.45-5.04c0-5.23 4.26-9.49 9.5-9.49 2.54 0 4.92.99 6.71 2.79a9.43 9.43 0 012.78 6.71c0 5.24-4.26 9.49-9.49 9.49zm8.08-17.57A11.35 11.35 0 0012.04.5C5.74.5.62 5.62.62 11.92c0 2.01.53 3.98 1.53 5.71L.5 23.5l6.02-1.58a11.4 11.4 0 005.45 1.39h.01c6.3 0 11.42-5.12 11.42-11.42 0-3.05-1.19-5.92-3.35-8.08z" />
    </svg>
  );
}

/** Pages with their own pinned buttons at the bottom don't show the bar. */
const HIDDEN_ON = ['/book'];

/**
 * Phone-only action bar pinned to the bottom of the screen, in easy thumb reach:
 * Book (primary) · Track · WhatsApp · Call. Respects the iPhone home-indicator area.
 */
export function MobileBar() {
  const { pathname } = useLocation();
  if (HIDDEN_ON.includes(pathname)) return null;
  const item = 'flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-colors active:scale-95 active:bg-navy-50';
  return (
    <nav
      aria-label="Quick actions"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_-12px_rgb(7_18_38/0.25)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch gap-1">
        <NavLink to="/book" className="mr-1 flex flex-[1.7] items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-2.5 text-[13.5px] font-bold whitespace-nowrap text-white shadow-md shadow-brand-600/30 transition-transform active:scale-95">
          <Wrench className="size-[18px]" /> Book a Repair
        </NavLink>
        <NavLink to="/track" className={({ isActive }) => clsx(item, isActive || pathname.startsWith('/track/') ? 'text-brand-600' : 'text-navy-700')}>
          <Search className="size-5" strokeWidth={2} /> Track
        </NavLink>
        <a href={BUSINESS.whatsappHref} target="_blank" rel="noreferrer" className={clsx(item, 'text-[#128C4B]')}>
          <WhatsAppGlyph className="size-5" /> WhatsApp
        </a>
        <a href={BUSINESS.phoneHref} className={clsx(item, 'text-navy-700')}>
          <Phone className="size-5" strokeWidth={2} /> Call
        </a>
      </div>
    </nav>
  );
}
