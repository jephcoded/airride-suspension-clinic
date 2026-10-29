import { TransmissionFeature } from '../components/TransmissionFeature';
import { photo, type PhotoSpot } from '../lib/site';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cog,
  FileText,
  Gauge,
  Search,
  ShieldCheck,
  Smartphone,
  Truck,
  Wrench,
} from 'lucide-react';
import { LinkButton } from '../components/ui/Button';
import { ImageSlot } from '../components/ui/misc';
import { TrackForm } from '../components/TrackForm';
import { Hero } from '../components/Hero';
import { BUSINESS } from '../lib/constants';

const SOLUTIONS = [
  {
    title: 'Air Suspension',
    tag: 'Struts · Springs · Compressors',
    to: '/services#air-suspension',
    image: 'svc-air' as PhotoSpot,
    position: '50% 50%',
    icon: Gauge,
    points: ['Air strut & air spring rebuilding', 'Leak detection', 'Compressor & valve block repair', 'Ride-height calibration'],
  },
  {
    title: 'Hydraulic Suspension',
    tag: 'Struts · Pumps · Accumulators',
    to: '/services#hydraulic-suspension',
    image: 'svc-hydraulic' as PhotoSpot,
    position: '50% 40%',
    icon: Cog,
    points: ['Hydraulic strut repair', 'Pump & cylinder rebuilding', 'Accumulator service', 'Pressure testing'],
  },
  {
    title: 'Shock Absorbers',
    tag: 'Rebuild · Re-valve · Test',
    to: '/services#shock-rebuilding',
    image: 'svc-shock' as PhotoSpot,
    position: '50% 50%',
    icon: Wrench,
    points: ['Shock rebuilding & re-valving', 'Oil & seal replacement', 'Rod re-chroming', 'Damping performance tests'],
  },
  {
    title: 'Automatic Transmissions',
    tag: 'Rebuild · Repair · Road-test',
    to: '/services#automatic-transmission',
    image: 'svc-transmission' as PhotoSpot,
    position: '50% 50%',
    icon: Cog,
    points: ['Full gearbox rebuilding', 'Slipping & harsh-shift repair', 'Valve body & solenoids', 'Fluid service & road test'],
  },
];

const OTHER_SERVICES = [
  { id: 'compressor', label: 'Compressors' },
  { id: 'pump', label: 'Hydraulic pumps' },
  { id: 'air-strut', label: 'Air struts' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'calibration', label: 'Calibration & testing' },
];

const FEATURES = [
  { icon: Camera, title: 'You see the fault', text: 'Photos of the damaged parts and a written diagnosis, sent to your phone before any work starts.' },
  { icon: FileText, title: 'You approve the price', text: 'A clear, itemised quotation you accept online. No surprise charges when you come to collect.' },
  { icon: Smartphone, title: 'You follow every step', text: 'Live tracking from received to ready, with WhatsApp updates so you never have to call and ask.' },
  { icon: Award, title: 'You get a warranty', text: 'Every repair is tested, documented and covered, all stored against your Repair ID.' },
];

const DEMO_STAGES = [
  { label: 'Received', done: true },
  { label: 'Diagnosed', done: true },
  { label: 'Quote approved', done: true },
  { label: 'Repairing', done: true },
  { label: 'Testing', current: true },
  { label: 'Ready for collection' },
];

const STEPS: { icon: typeof FileText; title: string; text: string; meta?: string }[] = [
  { icon: FileText, title: 'Book online', text: 'Tell us about your vehicle and the fault. Add photos or a short video from your phone.', meta: 'About 3 minutes' },
  { icon: Truck, title: 'Send the part', text: 'Drop it at the workshop, request a pickup, or ship it from anywhere in Nigeria.' },
  { icon: Search, title: 'Approve the quote', text: 'We diagnose the fault and send photos plus a clear price. Nothing starts until you approve.' },
  { icon: ClipboardCheck, title: 'Repaired & tested', text: 'Rebuilt, pressure-tested and returned with a warranty. Track it live the whole way.' },
];

export default function Home() {
  return (
    <>
      <Hero />

      {/* ---------- Solutions ---------- */}
      <section className="relative overflow-hidden pt-20 pb-14 sm:pt-28 sm:pb-20">
        <div className="pointer-events-none absolute -top-40 right-0 size-[520px] rounded-full bg-brand-500/5 blur-3xl" />
        <div className="container-x relative">
          <div className="grid items-end gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div data-reveal>
              <p className="eyebrow">Our Services</p>
              <h2 className="mt-4 text-[2.1rem] leading-[1.08] font-bold text-navy-950 sm:text-5xl">
                Repair Solutions
                <span className="block text-brand-500">for Every Vehicle.</span>
              </h2>
            </div>
            <div data-reveal style={{ '--d': '120ms' } as React.CSSProperties} className="lg:pb-2">
              <p className="text-[16px] leading-relaxed font-medium text-navy-700">
                From a single leaking strut to a complete air system, every component is stripped, rebuilt with quality parts and bench-tested before it goes back on your vehicle.
              </p>
              <Link to="/services" className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-navy-950">
                <span className="border-b-2 border-brand-500 pb-0.5">View all services</span>
                <span className="flex size-8 items-center justify-center rounded-full bg-navy-950 text-white transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:gap-6 xl:grid-cols-4">
            {SOLUTIONS.map((s, i) => (
              <Link
                key={s.title}
                to={s.to}
                data-reveal
                style={{ '--d': `${i * 120}ms` } as React.CSSProperties}
                className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-navy-950 p-6 text-white shadow-[0_30px_60px_-30px_rgb(7_18_38/0.6)] sm:p-7 md:aspect-[3/4.2] lg:aspect-[4/5.2]"
              >
                <img
                  src={photo(s.image)}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 -z-20 size-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110"
                  style={{ objectPosition: s.position }}
                />
                {/* Readable bottom, darker still on hover as the details slide up */}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-950/5 transition-opacity duration-500" />
                <div className="absolute inset-0 -z-10 bg-navy-950/0 transition-colors duration-500 group-hover:bg-navy-950/45" />

                <div className="absolute inset-x-6 top-6 flex items-center justify-between sm:inset-x-7 sm:top-7">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md transition-colors duration-300 group-hover:bg-brand-500 group-hover:ring-brand-400">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-display text-sm font-semibold tracking-wider text-white/60">0{i + 1}</span>
                </div>

                <p className="text-xs font-semibold tracking-[0.16em] text-brand-300 uppercase">{s.tag}</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{s.title}</h3>

                {/* Details: always shown on touch screens, slide up on hover with a mouse */}
                <div className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.22,1,.36,1)] [@media(hover:hover)]:grid-rows-[0fr] [@media(hover:hover)]:group-hover:grid-rows-[1fr]">
                  <div className="overflow-hidden">
                    <ul className="space-y-2 pt-4 text-[14.5px] text-white/85">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-center gap-2.5">
                          <span className="size-1.5 shrink-0 rounded-full bg-brand-500" /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
                  Explore service
                  <span className="flex size-8 items-center justify-center rounded-full bg-white text-navy-950 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-brand-500 group-hover:text-white">
                    <ArrowUpRight className="size-4" />
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {/* Other services */}
          <div data-reveal className="mt-8 flex flex-col gap-4 rounded-3xl bg-navy-50/70 p-5 sm:flex-row sm:items-center sm:p-6">
            <p className="shrink-0 font-display text-[15px] font-semibold text-navy-950">We also repair</p>
            <div className="flex flex-wrap gap-2">
              {OTHER_SERVICES.map((o) => (
                <Link
                  key={o.id}
                  to={`/services#${o.id}`}
                  className="group inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-[13.5px] font-medium text-navy-700 ring-1 ring-navy-100 transition hover:-translate-y-px hover:text-brand-600 hover:ring-brand-300"
                >
                  {o.label}
                  <ArrowUpRight className="size-3.5 text-navy-300 transition group-hover:text-brand-500" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <TransmissionFeature />

      {/* ---------- Track your repair ---------- */}
      <section className="bg-navy-50/70 py-16 sm:py-20">
        <div className="container-x">
          <div data-reveal="zoom" className="grid items-center gap-10 overflow-hidden rounded-3xl bg-white p-6 shadow-card sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:p-12">
            <div>
              <p className="eyebrow">Repair Tracking</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Track Your Repair</h2>
              <p className="mt-3 max-w-lg text-[16px] text-navy-600">Enter your Repair ID and the phone number you booked with to check the current status of your suspension repair.</p>
              <div className="mt-7">
                <TrackForm />
              </div>
              <p className="mt-4 text-sm text-navy-500">
                Can't find your Repair ID? It's in the WhatsApp, SMS or email we sent when you booked.
              </p>
            </div>
            <div data-reveal="right" style={{ '--d': '200ms' } as React.CSSProperties} className="relative rounded-2xl bg-navy-900 bg-tread p-6 text-white sm:p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-navy-200">ARC-2026-00125</span>
                <span className="rounded-full bg-brand-500/20 px-2.5 py-1 text-xs font-semibold text-brand-300">In progress</span>
              </div>
              <p className="mt-1 text-sm text-navy-300">Range Rover Sport · Front Left Air Strut</p>
              <ol data-stagger="left" className="mt-6 space-y-0">
                {DEMO_STAGES.map((s, i) => (
                  <li key={s.label} className="relative flex items-center gap-3 pb-4 last:pb-0">
                    {i < DEMO_STAGES.length - 1 && <span className={`absolute top-6 left-[11px] h-[calc(100%-12px)] w-0.5 ${s.done ? 'bg-emerald-400' : 'bg-white/15'}`} />}
                    <span
                      className={`relative flex size-6 shrink-0 items-center justify-center rounded-full ${s.done ? 'bg-emerald-400 text-navy-900' : s.current ? 'animate-pulse-ring bg-brand-500' : 'border-2 border-white/25'}`}
                    >
                      {s.done && <CheckCircle2 className="size-4" />}
                    </span>
                    <span className={`text-sm font-medium ${s.current ? 'text-brand-300' : s.done ? 'text-white' : 'text-navy-400'}`}>{s.label}</span>
                    {s.current && <span className="ml-auto text-xs text-navy-300">Now</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Why us ---------- */}
      <section className="relative overflow-hidden bg-navy-950 py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute -top-48 -left-40 size-[560px] rounded-full bg-brand-600/20 blur-[120px]" />
        <div className="container-x relative grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          {/* Statement + photo */}
          <div>
            <div data-reveal>
              <p className="eyebrow eyebrow-light">Why Airride</p>
              <h2 className="mt-4 text-[2.1rem] leading-[1.08] font-bold sm:text-5xl">
                More than a repair shop.
                <span className="block text-brand-300">A repair you can see.</span>
              </h2>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-navy-200">
                Most workshops take your car and go quiet. We show you the fault, the price and every step of the work, before, during and after.
              </p>
            </div>

            <div data-reveal="zoom" style={{ '--d': '150ms' } as React.CSSProperties} className="relative mt-10 overflow-hidden rounded-3xl">
              <img src={photo('why-inspect')} alt="Technician inspecting a wheel and suspension assembly" loading="lazy" className="aspect-[5/4] w-full object-cover" style={{ objectPosition: '50% 30%' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/10 to-transparent" />
              <div className="absolute inset-x-5 bottom-5 flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-md sm:inset-x-6 sm:bottom-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500">
                  <ShieldCheck className="size-5" />
                </span>
                <p className="text-[14px] leading-snug font-medium">
                  Every unit is pressure and leak-tested on our bench <span className="text-navy-200">before it goes back on your vehicle.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Numbered reasons */}
          <ol className="self-center border-t border-white/10">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                data-reveal="right"
                style={{ '--d': `${i * 110}ms` } as React.CSSProperties}
                className="group grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-b border-white/10 py-7 sm:grid-cols-[4.5rem_1fr_auto] sm:items-start sm:py-8"
              >
                <span className="font-display text-[2.2rem] leading-none font-bold text-brand-300/45 transition-colors duration-500 group-hover:text-brand-300 sm:text-5xl">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight sm:text-[1.4rem]">{f.title}</h3>
                  <p className="mt-2 max-w-md text-[15.5px] leading-relaxed text-navy-200">{f.text}</p>
                </div>
                <span className="col-start-2 mt-2 hidden size-11 items-center justify-center rounded-full ring-1 ring-white/15 transition-all duration-500 group-hover:bg-brand-500 group-hover:ring-brand-500 sm:col-start-3 sm:mt-0 sm:flex">
                  <f.icon className="size-5 text-navy-200 transition-colors group-hover:text-white" />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Equipment ---------- */}
      <section className="pb-16 sm:pb-24">
        <div className="container-x grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-reveal="left" className="order-2 lg:order-1">
            <p className="eyebrow">Our Workshop</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Professional Equipment.
              <span className="block text-brand-500">Precision Results.</span>
            </h2>
            <p className="mt-4 text-lg text-navy-500">
              Every component is stripped, cleaned, rebuilt with quality parts and tested on our benches before it leaves the workshop — so you get a repair you can trust.
            </p>
            <ul data-stagger="left" className="mt-6 grid gap-3 sm:grid-cols-2">
              {['Dedicated suspension test benches', 'Pressure & leak testing', 'Precision seal & valve rebuilding', 'Clean-room reassembly', 'Calibration & ride-height setup', 'Documented test results'].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[15px] font-medium text-navy-700">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-500" /> {t}
                </li>
              ))}
            </ul>
            <LinkButton to="/about" variant="dark" className="mt-8">
              Learn More About Our Facility <ArrowRight className="size-4" />
            </LinkButton>
          </div>
          <div data-stagger="zoom" className="order-1 grid grid-cols-2 gap-3 sm:gap-4 lg:order-2">
            <ImageSlot src={photo('shop-mechanic')} alt="Technician repairing a vehicle in the workshop" label="Repair" className="row-span-2 h-full min-h-72 w-full rounded-2xl" />
            <ImageSlot src={photo('shop-underbody')} alt="Vehicle suspension and axle on a workshop lift" label="Underbody" className="aspect-square w-full rounded-2xl" />
            <ImageSlot src={photo('shop-floor')} alt="Clean, well-lit workshop floor with a car on a lift" label="Workshop" className="aspect-square w-full rounded-2xl" />
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="bg-navy-50/60 py-16 sm:py-24">
        <div className="container-x">
          <div data-reveal className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">How It Works</p>
            <h2 className="mt-3 text-[2rem] leading-[1.1] font-bold text-navy-950 sm:text-5xl">
              Four steps to a <span className="text-brand-600">smoother ride.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-navy-600">Book in three minutes from your phone. We handle the rest, and you can see where your repair is at every stage.</p>
          </div>

          {/* Phones: vertical timeline · Desktop: horizontal. The line fills in blue as it scrolls into view. */}
          <ol data-reveal="fade" className="how-steps relative mx-auto mt-12 max-w-md lg:mt-16 lg:grid lg:max-w-none lg:grid-cols-4 lg:gap-6">
            <span aria-hidden className="absolute top-2 bottom-10 left-[23px] w-[2px] rounded-full bg-navy-200 lg:top-[23px] lg:right-[12.5%] lg:bottom-auto lg:left-[12.5%] lg:h-[2px] lg:w-auto" />
            <span aria-hidden className="how-line absolute top-2 bottom-10 left-[23px] w-[2px] origin-top rounded-full bg-brand-500 lg:top-[23px] lg:right-[12.5%] lg:bottom-auto lg:left-[12.5%] lg:h-[2px] lg:w-auto lg:origin-left" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="how-step relative flex gap-5 pb-8 last:pb-0 lg:flex-col lg:items-center lg:gap-0 lg:pb-0 lg:text-center" style={{ '--i': i } as React.CSSProperties}>
                <span className="how-dot relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-navy-400 shadow-[0_0_0_6px_var(--color-navy-50)] ring-2 ring-navy-200">
                  <s.icon className="size-5" />
                </span>
                <div className="pt-1 lg:mt-6 lg:pt-0">
                  <p className="text-[12px] font-bold tracking-[0.14em] text-brand-600 uppercase">Step {i + 1}</p>
                  <h3 className="mt-1 text-[19px] font-semibold tracking-tight text-navy-950">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-navy-600 lg:mx-auto lg:max-w-[15rem]">{s.text}</p>
                  {s.meta && (
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-[12.5px] font-semibold text-navy-700 ring-1 ring-navy-100">
                      <Clock className="size-3.5 text-brand-500" /> {s.meta}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div data-reveal className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <LinkButton to="/book" size="lg" className="w-full px-8 sm:w-auto">
              Start Step 1 — Book Now <ArrowRight className="size-4" />
            </LinkButton>
            <a href={BUSINESS.whatsappHref} target="_blank" rel="noreferrer" className="text-[15px] font-semibold text-navy-700 underline decoration-navy-300 underline-offset-4 hover:text-brand-600">
              or ask us on WhatsApp first
            </a>
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="relative overflow-hidden bg-navy-900 bg-tread">
        <div data-parallax="0.12" className="absolute -top-16 right-0 hidden h-[calc(100%+8rem)] w-1/2 lg:block">
          <ImageSlot src={photo('cta-lifts')} alt="Cars raised on lifts in a modern workshop" className="h-full w-full opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-900 to-transparent" />
        </div>
        <div className="container-x relative py-16 sm:py-20">
          <p data-reveal className="eyebrow eyebrow-light">Your Suspension, Our Expertise</p>
          <h2 data-reveal style={{ '--d': '90ms' } as React.CSSProperties} className="mt-3 max-w-xl text-4xl font-bold text-white sm:text-5xl">Book Your Repair Today.</h2>
          <p data-reveal style={{ '--d': '180ms' } as React.CSSProperties} className="mt-4 max-w-lg text-lg text-navy-200">Let our experts get your suspension back to its best — with clear pricing, real-time tracking and a warranty on every repair.</p>
          <div data-reveal style={{ '--d': '270ms' } as React.CSSProperties} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton to="/book" size="lg">
              Book a Repair <ArrowRight className="size-4" />
            </LinkButton>
            <LinkButton to="/quote" size="lg" variant="white">
              Get a Quote
            </LinkButton>
          </div>
          <ul data-stagger="fade" className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-navy-100">
            <li className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-400" /> Warranty Protection</li>
            <li className="flex items-center gap-2"><BadgeCheck className="size-5 text-brand-400" /> Quality Assurance</li>
            <li className="flex items-center gap-2"><Truck className="size-5 text-brand-400" /> Pickup Available</li>
          </ul>
        </div>
      </section>
    </>
  );
}
