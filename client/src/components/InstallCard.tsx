import { Share, X } from 'lucide-react';
import { useInstallPrompt } from '../lib/install';

/** Offers to add Airride to the phone's home screen (shown only on phones that support it). */
export function InstallCard({ className = '' }: { className?: string }) {
  const { canShow, ios, install, dismiss } = useInstallPrompt();
  if (!canShow) return null;
  return (
    <div className={`relative flex items-center gap-4 rounded-2xl bg-navy-950 p-4 text-white shadow-lift md:hidden ${className}`}>
      <img src="/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-semibold">Get the Airride app</p>
        {ios ? (
          <p className="mt-0.5 text-[13px] leading-snug text-navy-200">
            Tap <Share className="inline size-3.5 align-[-2px]" /> Share, then <strong className="text-white">Add to Home Screen</strong> to track repairs in one tap.
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] leading-snug text-navy-200">Track your repairs in one tap from your home screen.</p>
        )}
      </div>
      {!ios && (
        <button onClick={install} className="shrink-0 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-bold active:scale-95">
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Not now" className="absolute top-2 right-2 rounded-full p-1 text-navy-300">
        <X className="size-4" />
      </button>
    </div>
  );
}
