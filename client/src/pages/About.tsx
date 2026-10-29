import { photo } from '../lib/site';
import { ArrowRight, Camera, ClipboardCheck, ShieldCheck, Target, Wrench } from 'lucide-react';
import { PageHero } from '../components/layout/SiteLayout';
import { LinkButton } from '../components/ui/Button';
import { ImageSlot, SectionHeading } from '../components/ui/misc';

const VALUES = [
  { icon: Target, title: 'Specialists, not generalists', text: 'Suspension is all we do. That focus means faster, more accurate diagnosis and better rebuilds.' },
  { icon: Camera, title: 'Full transparency', text: 'Photos and notes at every step, and nothing is repaired until you approve the quotation.' },
  { icon: ClipboardCheck, title: 'Tested before it leaves', text: 'Every unit is pressure, leak and performance tested, and the results are recorded.' },
  { icon: ShieldCheck, title: 'Backed by warranty', text: 'Every repair carries a warranty linked to your Repair ID — no paperwork to lose.' },
];

export default function About() {
  return (
    <>
      <PageHero eyebrow="About Us" title="The suspension specialists" intro="Airride Suspension Clinic repairs and rebuilds air suspension, hydraulic suspension and shock absorbers for drivers and fleets across Nigeria." />
      <section className="container-x grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Our Story</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Restoring the ride your vehicle was built for</h2>
          <div className="mt-5 space-y-4 text-lg leading-relaxed text-navy-600">
            <p>
              Air and hydraulic suspension systems are complex — and replacing components with new parts can be very expensive. We started Airride Suspension Clinic to offer a
              better option: expert rebuilding, done properly, with every step documented.
            </p>
            <p>
              Our workshop is equipped with dedicated test benches and tooling for struts, shocks, compressors and pumps. Our technicians diagnose the real fault, rebuild with quality
              parts and test every unit before it goes back on your vehicle.
            </p>
          </div>
          <LinkButton to="/book" className="mt-8">Book a Repair <ArrowRight className="size-4" /></LinkButton>
        </div>
        <div data-stagger="zoom" className="grid grid-cols-2 gap-4">
          <ImageSlot src={photo('about-team')} alt="Technician rebuilding an engine component in the workshop" label="Our workshop" className="aspect-[3/4] w-full rounded-2xl" />
          <ImageSlot src={photo('about-wheel')} alt="Air suspension and brake assembly exposed for repair" label="Our team" className="mt-10 aspect-[3/4] w-full rounded-2xl" />
        </div>
      </section>
      <section className="bg-navy-50/70 py-16 sm:py-24">
        <div className="container-x">
          <SectionHeading align="center" eyebrow="What We Stand For" title="How we work" />
          <div data-stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl bg-white p-6 shadow-card">
                <span className="flex size-12 items-center justify-center rounded-xl bg-navy-900 text-brand-400"><v.icon className="size-6" /></span>
                <h3 className="mt-5 text-lg font-bold">{v.title}</h3>
                <p className="mt-2 text-[15px] text-navy-500">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="container-x py-16 text-center">
        <Wrench className="mx-auto size-10 text-brand-500" />
        <h2 className="mt-4 text-3xl font-bold">Ready when you are</h2>
        <p className="mx-auto mt-3 max-w-xl text-navy-500">Book online in minutes, or visit the workshop for a free inspection.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton to="/book" size="lg">Book a Repair</LinkButton>
          <LinkButton to="/contact" size="lg" variant="outline">Visit the Workshop</LinkButton>
        </div>
      </section>
    </>
  );
}
