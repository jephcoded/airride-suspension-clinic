import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Phone, ShieldCheck } from 'lucide-react';
import { BUSINESS } from '../lib/constants';
import { photo } from '../lib/site';
import { WhatsAppGlyph } from './LiveTracker';

const PARTS = [
  { key: 'tx-gears', label: 'Gear sets & clutch packs' },
  { key: 'tx-converter', label: 'Torque converter' },
  { key: 'tx-selector', label: 'Shifting & controls' },
] as const;

/** Feature block for the automatic transmission rebuilding service (Home and Services pages). */
export function TransmissionFeature() {
  const whatsapp = `${BUSINESS.whatsappHref}?text=${encodeURIComponent(`Hello ${BUSINESS.name}, I'd like to ask about an automatic transmission rebuild.`)}`;
  const actions = [
    { to: '/book?service=transmission', icon: CalendarCheck, title: 'Book a repair', text: 'Schedule your transmission repair today.', tone: 'bg-brand-600 text-white' },
    { href: BUSINESS.phoneHref, icon: Phone, title: 'Call us', text: 'Speak with our team about your gearbox.', tone: 'bg-brand-600 text-white' },
    { href: whatsapp, icon: null, title: 'Chat on WhatsApp', text: 'Get quick answers and book a service.', tone: 'bg-[#1faa53] text-white' },
  ];

  return (
    <section id="transmission-rebuild" className="relative scroll-mt-28 overflow-hidden bg-gradient-to-br from-white via-navy-50/60 to-brand-50">
      {/* Blue sweep behind the photo, echoing the client's banner */}
      <div aria-hidden className="pointer-events-none absolute top-0 -right-40 hidden h-full w-[55%] skew-x-[-12deg] bg-gradient-to-b from-brand-600 to-brand-800 lg:block" />
      <div className="container-x relative py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div data-reveal>
            <p className="eyebrow">New service</p>
            <h2 className="mt-3 font-display text-[2.4rem] leading-[1.02] font-extrabold tracking-[-0.03em] text-navy-950 uppercase sm:text-6xl">
              Automatic
              <span className="block text-brand-600">Transmission</span>
              Rebuild
            </h2>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-navy-600">
              Slipping gears, harsh or late shifts, limp mode or no drive? We strip, clean and rebuild automatic gearboxes with new clutch packs, seals and
              solenoids, then road-test before handing it back, with the same live tracking and warranty as every Airride repair.
            </p>
            <ul data-stagger className="mt-7 grid grid-cols-3 gap-3">
              {PARTS.map((p) => (
                <li key={p.key} className="overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-navy-100">
                  <img src={photo(p.key)} alt={p.label} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  <p className="px-2.5 py-2 text-[12px] leading-tight font-semibold text-navy-800 sm:text-[13px]">{p.label}</p>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal="zoom" className="relative">
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_40px_80px_-30px_rgb(7_18_38/0.55)] ring-1 ring-white/60">
              <img src={photo('tx-main')} alt="Cutaway of an automatic transmission showing gears and clutch packs" loading="lazy" className="aspect-[3/2] w-full object-cover" />
            </div>
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-xl bg-navy-950 px-4 py-3 text-white shadow-xl sm:left-8">
              <ShieldCheck className="size-6 text-emerald-400" />
              <span className="text-sm leading-tight font-semibold">
                Road-tested &amp;
                <span className="block text-navy-300">warranted</span>
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div data-stagger className="mt-14 grid gap-4 md:grid-cols-3">
          {actions.map((a) => {
            const inner = (
              <>
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${a.tone}`}>
                  {a.icon ? <a.icon className="size-5" /> : <WhatsAppGlyph className="size-6" />}
                </span>
                <span className="min-w-0 flex-1 border-l border-navy-100 pl-4">
                  <span className="block text-[15px] font-extrabold tracking-wide text-navy-950 uppercase">{a.title}</span>
                  <span className="block text-sm text-navy-500">{a.text}</span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowRight className="size-4" />
                </span>
              </>
            );
            const cls = 'group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-100 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5';
            return a.to ? (
              <Link key={a.title} to={a.to} className={cls}>{inner}</Link>
            ) : (
              <a key={a.title} href={a.href} target={a.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={cls}>{inner}</a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
