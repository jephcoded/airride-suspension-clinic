import { TransmissionFeature } from '../components/TransmissionFeature';
import { photo } from '../lib/site';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SERVICES } from '../lib/content';
import { PageHero } from '../components/layout/SiteLayout';
import { LinkButton } from '../components/ui/Button';
import { ImageSlot } from '../components/ui/misc';

export default function Services() {
  return (
    <>
      <PageHero
        eyebrow="Our Services"
        title="Specialist suspension repair & rebuilding"
        intro="Air suspension, hydraulic suspension, shock absorbers and automatic transmissions: diagnosed, rebuilt and tested by specialists, with a warranty on every repair."
      />
      <section className="container-x py-16 sm:py-20">
        <div data-stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <article
              id={s.id}
              key={s.id}
              className="group relative flex scroll-mt-32 flex-col overflow-hidden rounded-xl border border-navy-100 bg-white p-6 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-1 hover:border-navy-200 hover:shadow-[0_24px_50px_-24px_rgb(7_18_38/0.35)] sm:p-7"
            >
              {/* Blue bar draws across the top on hover */}
              <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-brand-600 transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-x-100" />
              <div className="flex items-start justify-between">
                <span className="flex size-12 items-center justify-center rounded-lg bg-navy-50 text-navy-900 transition-colors duration-500 group-hover:bg-brand-600 group-hover:text-white">
                  <s.icon className="size-[22px]" strokeWidth={1.75} />
                </span>
                <span className="font-display text-sm font-semibold text-navy-300 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h2 className="mt-6 text-[1.3rem] leading-snug font-semibold tracking-[-0.02em] text-navy-950">{s.title}</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-navy-600">{s.text}</p>
              <ul className="mt-5 flex-1 space-y-2.5 border-t border-navy-100 pt-5">
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[14.5px] text-navy-800">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-600" strokeWidth={2.5} /> {p}
                  </li>
                ))}
              </ul>
              <Link to="/book" className="mt-7 inline-flex items-center gap-2 self-start text-[14.5px] font-semibold text-navy-950 transition-colors group-hover:text-brand-600">
                Book this service
                <span className="flex size-8 items-center justify-center rounded-full border border-navy-200 transition-all duration-300 group-hover:translate-x-1 group-hover:border-brand-600 group-hover:bg-brand-600 group-hover:text-white">
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <TransmissionFeature />
      <section className="bg-navy-50/70 py-16">
        <div className="container-x grid items-center gap-10 lg:grid-cols-2">
          <ImageSlot src={photo('vehicles')} alt="Vehicles we work on" label="Vehicles we service" className="aspect-[16/10] w-full rounded-2xl" />
          <div>
            <p className="eyebrow">Vehicles We Service</p>
            <h2 className="mt-3 text-3xl font-bold">Luxury cars, SUVs, trucks & buses</h2>
            <p className="mt-3 text-navy-500">
              Mercedes-Benz, Range Rover & Land Rover, Lexus, Toyota, BMW, Audi, Porsche, Volkswagen, Bentley and more — plus commercial trucks and buses with air or hydraulic suspension.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <LinkButton to="/book">Book a Repair <ArrowRight className="size-4" /></LinkButton>
              <LinkButton to="/quote" variant="outline">Get a Quote</LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
