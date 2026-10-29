import { useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { BUSINESS } from '../lib/constants';
import { PageHero } from '../components/layout/SiteLayout';
import { Button, LinkButton } from '../components/ui/Button';
import { Field, Input, Textarea } from '../components/ui/Field';
import { Alert, Card } from '../components/ui/misc';

function EnquiryForm({ type }: { type: 'QUOTE' | 'CONTACT' }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', vehicle: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = 'Enter your name';
    if (f.phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid phone number';
    if (f.message.trim().length < 5) errs.message = 'Please write a short message';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    setError('');
    try {
      await api.post('/enquiries', { type, ...f });
      setSent(true);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <h2 className="mt-4 text-2xl font-bold">Message received</h2>
        <p className="mt-2 text-navy-500">Thank you, {f.name.split(' ')[0]}. Our team will get back to you shortly — usually within a few working hours.</p>
        {type === 'QUOTE' && (
          <div className="mt-6">
            <p className="text-sm text-navy-500">Ready to send your component already?</p>
            <LinkButton to="/book" className="mt-3">Book a Repair</LinkButton>
          </div>
        )}
      </div>
    );
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Your name" required error={errors.name} htmlFor="n"><Input id="n" autoComplete="name" value={f.name} onChange={set('name')} invalid={!!errors.name} /></Field>
      <Field label="Phone / WhatsApp" required error={errors.phone} htmlFor="p"><Input id="p" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} invalid={!!errors.phone} /></Field>
      <Field label="Email" error={errors.email} htmlFor="e"><Input id="e" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
      <Field label="Vehicle" htmlFor="v"><Input id="v" placeholder="2018 Range Rover Sport" value={f.vehicle} onChange={set('vehicle')} /></Field>
      <Field label={type === 'QUOTE' ? 'What needs repairing?' : 'Message'} required error={errors.message} className="sm:col-span-2" htmlFor="m">
        <Textarea
          id="m"
          rows={5}
          placeholder={type === 'QUOTE' ? 'Front left air strut leaking, car sinks overnight. Would like a price for rebuilding.' : 'How can we help?'}
          value={f.message}
          onChange={set('message')}
          invalid={!!errors.message}
        />
      </Field>
      {error && <Alert kind="error" className="sm:col-span-2">{error}</Alert>}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={sending} icon={<Send className="size-4" />} className="w-full sm:w-auto">
          {type === 'QUOTE' ? 'Request Quote' : 'Send Message'}
        </Button>
      </div>
    </form>
  );
}

function ContactAside() {
  return (
    <Card className="space-y-5 p-6">
      <h2 className="font-display text-lg font-bold">Talk to us directly</h2>
      {[
        { icon: Phone, label: 'Phone', value: BUSINESS.phone, href: BUSINESS.phoneHref },
        { icon: Mail, label: 'Email', value: BUSINESS.email, href: `mailto:${BUSINESS.email}` },
        { icon: MapPin, label: 'Workshop', value: BUSINESS.address, href: BUSINESS.mapsHref },
        { icon: Clock, label: 'Opening hours', value: BUSINESS.hours },
      ].filter((c) => c.value).map((c) => (
        <div key={c.label} className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500"><c.icon className="size-5" /></span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-navy-400 uppercase">{c.label}</p>
            {c.href ? <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="font-semibold text-navy-900 hover:text-brand-600">{c.value}</a> : <p className="font-semibold">{c.value}</p>}
          </div>
        </div>
      ))}
      <a href={BUSINESS.whatsappHref} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-lg bg-[#25D366] font-semibold text-white hover:brightness-95">Chat on WhatsApp</a>
    </Card>
  );
}

export function Quote() {
  return (
    <>
      <PageHero eyebrow="Get a Quote" title="Get a repair estimate" intro="Tell us what's wrong and we'll give you an idea of cost. For an exact quotation, we'll inspect the component when it arrives." />
      <section data-stagger className="container-x grid gap-8 py-14 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6 sm:p-8"><EnquiryForm type="QUOTE" /></Card>
        <ContactAside />
      </section>
    </>
  );
}

export function Contact() {
  return (
    <>
      <PageHero eyebrow="Contact Us" title="We're here to help" intro="Call, WhatsApp, email or visit the workshop. For repairs, the fastest way is to book online." />
      <section data-stagger className="container-x grid gap-8 py-14 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6 sm:p-8"><EnquiryForm type="CONTACT" /></Card>
        <ContactAside />
      </section>
      {BUSINESS.address && (
        <section className="container-x pb-16">
          <div className="overflow-hidden rounded-2xl border border-navy-100">
            <iframe title="Workshop location" src={`https://www.google.com/maps?q=${encodeURIComponent(BUSINESS.address)}&output=embed`} className="h-80 w-full" loading="lazy" />
          </div>
        </section>
      )}
    </>
  );
}
