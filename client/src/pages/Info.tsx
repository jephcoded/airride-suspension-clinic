import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, Phone, ShieldCheck, ShieldX, FileCheck2, Search } from 'lucide-react';
import clsx from 'clsx';
import { PageHero } from '../components/layout/SiteLayout';
import { LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/misc';
import { TrackForm } from '../components/TrackForm';
import { BUSINESS } from '../lib/constants';
import { FAQS } from '../lib/content';

export function Warranty() {
  return (
    <>
      <PageHero eyebrow="Warranty" title="Every repair is covered" intro="Your warranty is stored digitally against your Repair ID — no paper to lose. Check its status any time." />
      <section data-stagger className="container-x grid gap-6 py-14 md:grid-cols-3">
        <Card className="p-6">
          <ShieldCheck className="size-8 text-emerald-600" />
          <h2 className="mt-4 text-lg font-bold">What's covered</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-navy-600">
            <li>Workmanship on the repaired component</li>
            <li>Parts we replaced during the repair</li>
            <li>Leaks or failures caused by our rebuild</li>
          </ul>
        </Card>
        <Card className="p-6">
          <ShieldX className="size-8 text-red-500" />
          <h2 className="mt-4 text-lg font-bold">What's not covered</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-navy-600">
            <li>Accident or impact damage, misuse or overloading</li>
            <li>Failure of other suspension components</li>
            <li>Repairs or tampering by third parties</li>
            <li>Normal wear of parts we didn't replace</li>
          </ul>
        </Card>
        <Card className="p-6">
          <FileCheck2 className="size-8 text-brand-500" />
          <h2 className="mt-4 text-lg font-bold">How to claim</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] text-navy-600">
            <li>Track your repair with your Repair ID</li>
            <li>Tap "Open a warranty claim" and describe the issue</li>
            <li>We'll contact you to inspect the component</li>
          </ol>
        </Card>
      </section>
      <section className="container-x pb-16">
        <Card className="p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Search className="size-5 text-brand-500" /> Check your warranty</h2>
          <p className="mt-1 mb-5 text-navy-500">Warranty period depends on the repair — shown on your quotation and in your repair tracker.</p>
          <TrackForm />
        </Card>
      </section>
    </>
  );
}

export function Faqs() {
  const { hash } = useLocation();
  const fromHash = () => (hash.startsWith('#faq-') ? Number(hash.slice(5)) : 0);
  const [open, setOpen] = useState<number | null>(fromHash);
  useEffect(() => setOpen(fromHash()), [hash]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <PageHero eyebrow="FAQs" title="Questions, answered." intro="Everything customers usually ask before booking a suspension repair. Can't find yours? We reply fast on WhatsApp." />
      <section className="container-x grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
        {/* Contact panel: stays in view on desktop while reading */}
        <aside data-reveal="left" className="order-2 lg:sticky lg:top-28 lg:order-1 lg:self-start">
          <p className="eyebrow">Still unsure?</p>
          <h2 className="mt-3 text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] text-navy-950">Talk to a suspension specialist.</h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-navy-600">Send a photo or short video of the problem and we'll tell you what we think before you book.</p>
          <div className="mt-6 grid gap-3">
            <a href={BUSINESS.whatsappHref} target="_blank" rel="noreferrer" className="group flex items-center justify-between rounded-lg bg-navy-950 px-5 py-4 text-white transition-colors hover:bg-brand-600">
              <span>
                <span className="block text-[12px] font-medium text-navy-300 group-hover:text-white/80">WhatsApp</span>
                <span className="font-semibold">Chat with us</span>
              </span>
              <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.75} />
            </a>
            <a href={BUSINESS.phoneHref} className="group flex items-center justify-between rounded-lg border border-navy-200 px-5 py-4 transition-colors hover:border-navy-950">
              <span>
                <span className="block text-[12px] font-medium text-navy-500">Call</span>
                <span className="font-semibold text-navy-950">{BUSINESS.phone}</span>
              </span>
              <Phone className="size-5 text-navy-700" strokeWidth={1.75} />
            </a>
          </div>
          {BUSINESS.hours && <p className="mt-4 text-[13px] text-navy-500">Open {BUSINESS.hours}</p>}
        </aside>

        <div data-reveal className="order-1 border-t border-navy-200 lg:order-2">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} id={`faq-${i}`} className="scroll-mt-32 border-b border-navy-200">
                <button className="group flex w-full items-start gap-4 py-6 text-left sm:gap-6" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  <span className={clsx('mt-0.5 w-7 shrink-0 font-display text-sm font-semibold tabular-nums transition-colors', isOpen ? 'text-brand-600' : 'text-navy-300')}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={clsx('flex-1 text-[16.5px] leading-snug font-semibold tracking-[-0.01em] transition-colors sm:text-lg', isOpen ? 'text-navy-950' : 'text-navy-800 group-hover:text-navy-950')}>{q}</span>
                  {/* Thin plus that turns into a minus */}
                  <span className={clsx('relative mt-1 size-5 shrink-0 rounded-full transition-colors', isOpen ? 'text-brand-600' : 'text-navy-500 group-hover:text-navy-950')} aria-hidden>
                    <span className="absolute top-1/2 left-0 h-[1.5px] w-5 -translate-y-1/2 rounded bg-current" />
                    <span className={clsx('absolute top-0 left-1/2 h-5 w-[1.5px] -translate-x-1/2 rounded bg-current transition-transform duration-300', isOpen && 'scale-y-0')} />
                  </span>
                </button>
                <div className={clsx('grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.22,1,.36,1)]', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden">
                    <p className={clsx('pr-8 pb-7 pl-11 text-[15.5px] leading-relaxed text-navy-600 transition-opacity duration-500 sm:pl-[3.25rem]', isOpen ? 'opacity-100' : 'opacity-0')}>{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function NotFound() {
  return (
    <section className="container-x py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-brand-500">404</p>
      <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-navy-500">The page you're looking for doesn't exist or has moved.</p>
      <div className="mt-8 flex justify-center gap-3">
        <LinkButton to="/">Go Home</LinkButton>
        <LinkButton to="/track" variant="outline">Track a Repair</LinkButton>
      </div>
    </section>
  );
}
