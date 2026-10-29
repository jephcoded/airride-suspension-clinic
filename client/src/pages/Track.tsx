import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { PageHero } from '../components/layout/SiteLayout';
import { TrackForm } from '../components/TrackForm';
import { BUSINESS } from '../lib/constants';

export default function Track() {
  // Warm up stage labels etc. for the detail page.
  useQuery({ queryKey: ['meta'], queryFn: () => api.get('/meta').then((r) => r.data), staleTime: Infinity });
  return (
    <>
      <PageHero eyebrow="Repair Tracking" title="Track My Repair" intro="Enter your Repair ID and the phone number or email you booked with to see live progress, your quotation, photos and warranty." />
      <section className="container-x -mt-10 pb-20">
        <div className="relative mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-lift sm:p-8">
          <TrackForm layout="stacked" />
        </div>
        <div data-stagger className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { icon: Smartphone, title: 'Real-time status', text: 'See exactly what stage your component is at, from receipt to delivery.' },
            { icon: MessageCircle, title: 'WhatsApp updates', text: 'We message you at every important step — no need to keep calling.' },
            { icon: ShieldCheck, title: 'Warranty on record', text: 'Your repair history and warranty stay available under your Repair ID.' },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500"><f.icon className="size-6" /></span>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-navy-500">{f.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-sm text-navy-500">
          Lost your Repair ID? <Link to="/account" className="font-semibold text-brand-600">Sign in with a one-time code</Link> to see all your repairs, or <a href={BUSINESS.whatsappHref} className="font-semibold text-brand-600">message us on WhatsApp</a>.
        </p>
      </section>
    </>
  );
}
