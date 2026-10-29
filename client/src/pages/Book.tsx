import clsx from 'clsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Car,
  Check,
  CheckCircle2,
  Copy,
  FileVideo,
  ImagePlus,
  MapPin,
  Package,
  Send,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { RUNTIME, uploadDirect } from '../lib/uploads';
import { scrollToTopInstant, scrollToTopSmooth } from '../lib/smoothScroll';
import { BUSINESS, workshopAddress, COMPONENT_LABELS, CONTACT_METHODS, POSITIONS, SUSPENSION_COMPONENTS, SUSPENSION_TYPES, SYMPTOMS, TRANSMISSION_SYMPTOMS, VEHICLE_TYPES } from '../lib/constants';
import { Button, LinkButton } from '../components/ui/Button';
import { ChoiceCard, Field, Input, Select, Textarea } from '../components/ui/Field';
import { Alert } from '../components/ui/misc';

type Form = {
  customer: { fullName: string; phone: string; whatsapp: string; email: string; location: string; preferredContact: string };
  vehicle: { make: string; model: string; year: string; vin: string; registration: string; mileage: string; type: string };
  suspension: { type: string; component: string; componentOther: string; position: string; symptoms: string[]; description: string };
  delivery: { option: string; pickupAddress: string; pickupDate: string; pickupTime: string };
};

const EMPTY: Form = {
  customer: { fullName: '', phone: '', whatsapp: '', email: '', location: '', preferredContact: 'WHATSAPP' },
  vehicle: { make: '', model: '', year: '', vin: '', registration: '', mileage: '', type: 'CAR' },
  suspension: { type: '', component: '', componentOther: '', position: '', symptoms: [], description: '' },
  delivery: { option: '', pickupAddress: '', pickupDate: '', pickupTime: '' },
};

const STEPS = [
  { key: 'customer', label: 'Customer info', icon: User },
  { key: 'vehicle', label: 'Vehicle', icon: Car },
  { key: 'problem', label: 'The problem', icon: Wrench },
  { key: 'media', label: 'Photos & video', icon: ImagePlus },
  { key: 'delivery', label: 'Collection / delivery', icon: Truck },
] as const;

const DRAFT_KEY = 'airride-booking-draft';
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/3gpp';

type Errors = Record<string, string>;

function validate(step: number, f: Form): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (f.customer.fullName.trim().length < 2) e['customer.fullName'] = 'Enter your full name';
    if (f.customer.whatsapp.replace(/\D/g, '').length < 10) e['customer.whatsapp'] = 'Enter your WhatsApp number';
    if (f.customer.phone.replace(/\D/g, '').length < 10) e['customer.phone'] = 'Enter a valid phone number';
    if (f.customer.email && !/^\S+@\S+\.\S+$/.test(f.customer.email)) e['customer.email'] = 'Enter a valid email';
    if (f.customer.preferredContact === 'EMAIL' && !f.customer.email) e['customer.email'] = 'Add your email to be contacted by email';
  }
  if (step === 1) {
    if (!f.vehicle.make.trim()) e['vehicle.make'] = 'Enter the vehicle make';
    if (!f.vehicle.model.trim()) e['vehicle.model'] = 'Enter the model';
    const y = Number(f.vehicle.year);
    if (f.vehicle.year && (y < 1950 || y > new Date().getFullYear() + 1)) e['vehicle.year'] = 'Enter a valid year';
  }
  if (step === 2) {
    const transmission = f.suspension.component === 'AUTOMATIC_TRANSMISSION';
    if (!transmission && !f.suspension.type) e['suspension.type'] = 'Choose the suspension type';
    if (!f.suspension.component) e['suspension.component'] = 'Choose the component';
    if (f.suspension.component === 'OTHER' && !f.suspension.componentOther.trim()) e['suspension.componentOther'] = 'Tell us which component';
    if (f.suspension.description.trim().length < 5) e['suspension.description'] = 'Please describe the problem';
  }
  if (step === 4) {
    if (!f.delivery.option) e['delivery.option'] = 'Choose how we will get the component';
    if (f.delivery.option === 'PICKUP') {
      if (!f.delivery.pickupAddress.trim()) e['delivery.pickupAddress'] = 'Enter the pickup address';
      if (!f.delivery.pickupDate) e['delivery.pickupDate'] = 'Choose a pickup date';
    }
  }
  return e;
}

function stepOfError(path: string) {
  if (path.startsWith('customer')) return 0;
  if (path.startsWith('vehicle')) return 1;
  if (path.startsWith('suspension')) return 2;
  return 4;
}

type Result = { repairId: string; trackToken: string; trackingLink: string; deliveryOption: string; workshop: { address: string; phone: string } };

export default function Book() {
  const [form, setForm] = useState<Form>(() => {
    let f = EMPTY;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) f = { ...EMPTY, ...JSON.parse(saved) };
    } catch {
      /* private mode */
    }
    // "Book a repair" from the transmission section opens the form with that service chosen.
    if (new URLSearchParams(window.location.search).get('service') === 'transmission') {
      f = { ...f, suspension: { ...f.suspension, type: 'UNKNOWN', component: 'AUTOMATIC_TRANSMISSION', componentOther: '', position: '', symptoms: [] } };
    }
    return f;
  });
  const isTransmission = form.suspension.component === 'AUTOMATIC_TRANSMISSION';
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  
  // Keep a draft so a dropped connection or accidental refresh doesn't lose the form.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* storage unavailable */
    }
  }, [form]);

  function set<S extends keyof Form>(section: S, key: keyof Form[S], value: Form[S][keyof Form[S]]) {
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
    const path = `${section}.${String(key)}`;
    if (errors[path]) setErrors(({ [path]: _, ...rest }) => rest);
  }

  function goTo(n: number) {
    setStep(n);
    scrollToTopSmooth();
  }

  function next() {
    const e = validate(step, form);
    setErrors(e);
    if (Object.keys(e).length) return;
    goTo(step + 1);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileError('');
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > MAX_BYTES);
    const ok = incoming.filter((f) => f.size <= MAX_BYTES && (f.type.startsWith('image/') || f.type.startsWith('video/')));
    if (tooBig.length) setFileError(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} larger than 50MB. Try a shorter video.`);
    setFiles((prev) => {
      const merged = [...prev, ...ok].slice(0, MAX_FILES);
      if (prev.length + ok.length > MAX_FILES) setFileError(`You can upload up to ${MAX_FILES} files.`);
      return merged;
    });
  }

  async function submit() {
    const all = [0, 1, 2, 4].reduce<Errors>((acc, s) => ({ ...acc, ...validate(s, form) }), {});
    if (Object.keys(all).length) {
      setErrors(all);
      goTo(stepOfError(Object.keys(all)[0]));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setProgress(0);
    const body = new FormData();
    try {
      if (RUNTIME.uploadMode === 'direct-to-storage' && files.length) {
        // Vercel: send photos/videos straight to private storage first, then submit the booking.
        const uploads = await uploadDirect(files, 'booking', setProgress);
        body.append('data', JSON.stringify({ ...form, uploads }));
      } else {
        body.append('data', JSON.stringify(form));
        files.forEach((f) => body.append('files', f));
      }
      const { data } = await api.post<Result>('/bookings', body, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setResult(data);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      scrollToTopInstant();
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) {
        setErrors(fe);
        goTo(stepOfError(Object.keys(fe)[0]));
      }
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <Success result={result} />;

  const e = errors;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="bg-navy-50/60">
      <div className="container-x max-w-4xl pt-8 pb-28 sm:py-14">
        <div className="text-center">
          <p className="eyebrow">Book a Repair</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Tell us about your repair</h1>
          <p className="mt-2 text-navy-500">Takes about 3 minutes. You'll get a Repair ID to track everything.</p>
        </div>

        {/* Stepper */}
        <ol className="mx-auto mt-8 flex max-w-2xl items-center" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className={clsx('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <button
                type="button"
                onClick={() => i < step && goTo(i)}
                disabled={i > step}
                className="group flex flex-col items-center gap-1.5"
                aria-current={i === step ? 'step' : undefined}
              >
                <span
                  className={clsx(
                    'flex size-10 items-center justify-center rounded-full border-2 transition',
                    i < step && 'border-brand-500 bg-brand-500 text-white',
                    i === step && 'border-brand-500 bg-white text-brand-600 ring-4 ring-brand-500/15',
                    i > step && 'border-navy-200 bg-white text-navy-300',
                  )}
                >
                  {i < step ? <Check className="size-5" /> : <s.icon className="size-4.5" />}
                </span>
                <span className={clsx('hidden text-xs font-semibold sm:block', i <= step ? 'text-navy-800' : 'text-navy-400')}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className={clsx('mx-1 h-0.5 flex-1 rounded sm:mx-2 sm:-mt-5', i < step ? 'bg-brand-500' : 'bg-navy-200')} />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-center text-sm font-semibold text-navy-600 sm:hidden">
          Step {step + 1} of {STEPS.length}: {STEPS[step].label}
        </p>

        <div className="mt-8 rounded-2xl bg-white p-5 shadow-card sm:p-8">
          {step === 0 && (
            <Section title="Customer information" intro="So we can send your Repair ID and keep you updated.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" required error={e['customer.fullName']} className="sm:col-span-2" htmlFor="fullName">
                  <Input id="fullName" autoComplete="name" value={form.customer.fullName} onChange={(ev) => set('customer', 'fullName', ev.target.value)} invalid={!!e['customer.fullName']} />
                </Field>
                <Field label="WhatsApp number" required error={e['customer.whatsapp']} hint="Your repair updates are sent here on WhatsApp" htmlFor="whatsapp">
                  <Input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={form.customer.whatsapp} onChange={(ev) => set('customer', 'whatsapp', ev.target.value)} invalid={!!e['customer.whatsapp']} />
                </Field>
                <Field label="Phone number (for calls)" required error={e['customer.phone']} htmlFor="phone">
                  <Input id="phone" type="tel" inputMode="tel" placeholder="0803 123 4567" value={form.customer.phone} onChange={(ev) => set('customer', 'phone', ev.target.value)} invalid={!!e['customer.phone']} />
                  <label className="mt-2 flex items-center gap-2 text-sm text-navy-600">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-500"
                      checked={!!form.customer.whatsapp && form.customer.phone === form.customer.whatsapp}
                      onChange={(ev) => set('customer', 'phone', ev.target.checked ? form.customer.whatsapp : '')}
                    />
                    Same as my WhatsApp number
                  </label>
                </Field>
                <Field label="Email address" error={e['customer.email']} htmlFor="email">
                  <Input id="email" type="email" autoComplete="email" placeholder="name@email.com" value={form.customer.email} onChange={(ev) => set('customer', 'email', ev.target.value)} invalid={!!e['customer.email']} />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input id="location" autoComplete="address-level2" placeholder="Lekki, Lagos" value={form.customer.location} onChange={(ev) => set('customer', 'location', ev.target.value)} />
                </Field>
                <Field label="How should we contact you?" className="sm:col-span-2">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {CONTACT_METHODS.map((m) => (
                      <ChoiceCard key={m.value} checked={form.customer.preferredContact === m.value} onClick={() => set('customer', 'preferredContact', m.value)}>
                        {m.label}
                      </ChoiceCard>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>
          )}

          {step === 1 && (
            <Section title="Vehicle information" intro="Helps us prepare the right parts before your component arrives.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Vehicle type" className="sm:col-span-2">
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                    {VEHICLE_TYPES.map((t) => (
                      <ChoiceCard key={t.value} checked={form.vehicle.type === t.value} onClick={() => set('vehicle', 'type', t.value)}>
                        {t.label}
                      </ChoiceCard>
                    ))}
                  </div>
                </Field>
                <Field label="Make" required error={e['vehicle.make']} htmlFor="make">
                  <Input id="make" placeholder="Mercedes-Benz" value={form.vehicle.make} onChange={(ev) => set('vehicle', 'make', ev.target.value)} invalid={!!e['vehicle.make']} list="makes" />
                  <datalist id="makes">
                    {['Mercedes-Benz', 'Land Rover', 'Range Rover', 'Lexus', 'Toyota', 'BMW', 'Audi', 'Porsche', 'Volkswagen', 'Bentley', 'Rolls-Royce', 'Cadillac', 'Lincoln', 'Infiniti', 'Volvo', 'Jeep', 'Tesla', 'MAN', 'Scania', 'DAF'].map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Model" required error={e['vehicle.model']} htmlFor="model">
                  <Input id="model" placeholder="GLE 450" value={form.vehicle.model} onChange={(ev) => set('vehicle', 'model', ev.target.value)} invalid={!!e['vehicle.model']} />
                </Field>
                <Field label="Year" error={e['vehicle.year']} htmlFor="year">
                  <Input id="year" inputMode="numeric" maxLength={4} placeholder="2019" value={form.vehicle.year} onChange={(ev) => set('vehicle', 'year', ev.target.value.replace(/\D/g, ''))} invalid={!!e['vehicle.year']} />
                </Field>
                <Field label="Registration number" htmlFor="reg">
                  <Input id="reg" autoCapitalize="characters" placeholder="LND 482 KJ" value={form.vehicle.registration} onChange={(ev) => set('vehicle', 'registration', ev.target.value)} />
                </Field>
                <Field label="Mileage (km)" htmlFor="mileage">
                  <Input id="mileage" inputMode="numeric" placeholder="85,000" value={form.vehicle.mileage} onChange={(ev) => set('vehicle', 'mileage', ev.target.value.replace(/\D/g, ''))} />
                </Field>
                <Field label="VIN / Chassis number" hint="Optional" htmlFor="vin">
                  <Input id="vin" autoCapitalize="characters" value={form.vehicle.vin} onChange={(ev) => set('vehicle', 'vin', ev.target.value)} />
                </Field>
              </div>
            </Section>
          )}

          {step === 2 && (
            <Section title="What needs fixing?" intro="Don't worry if you're not sure. Choose your best guess and our technicians will confirm.">
              <div className="space-y-7">
                <Field label="Which service do you need?" required>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <ChoiceCard checked={!isTransmission} onClick={() => isTransmission && setForm({ ...form, suspension: { ...form.suspension, type: '', component: '', symptoms: [], position: '' } })}>
                      Suspension repair
                    </ChoiceCard>
                    <ChoiceCard
                      checked={isTransmission}
                      onClick={() => !isTransmission && setForm({ ...form, suspension: { ...form.suspension, type: 'UNKNOWN', component: 'AUTOMATIC_TRANSMISSION', componentOther: '', symptoms: [], position: '' } })}
                    >
                      Automatic transmission rebuild
                    </ChoiceCard>
                  </div>
                </Field>
                {!isTransmission && (
                <>
                <Field label="What type of suspension?" required error={e['suspension.type']}>
                  <div className="grid gap-2.5 sm:grid-cols-4">
                    {SUSPENSION_TYPES.map((t) => (
                      <ChoiceCard key={t.value} checked={form.suspension.type === t.value} onClick={() => set('suspension', 'type', t.value)}>
                        {t.label}
                      </ChoiceCard>
                    ))}
                  </div>
                </Field>
                <Field label="Which component needs repair?" required error={e['suspension.component']}>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {SUSPENSION_COMPONENTS.map((c) => (
                      <ChoiceCard key={c.value} checked={form.suspension.component === c.value} onClick={() => set('suspension', 'component', c.value)}>
                        {c.label}
                      </ChoiceCard>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  {form.suspension.component === 'OTHER' && (
                    <Field label="Which component?" required error={e['suspension.componentOther']} htmlFor="other">
                      <Input id="other" value={form.suspension.componentOther} onChange={(ev) => set('suspension', 'componentOther', ev.target.value)} invalid={!!e['suspension.componentOther']} />
                    </Field>
                  )}
                  <Field label="Position on vehicle" htmlFor="position">
                    <Select id="position" value={form.suspension.position} onChange={(ev) => set('suspension', 'position', ev.target.value)}>
                      <option value="">Select position (optional)</option>
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                </>
                )}
                <Field label="What symptoms do you notice?" hint="Select all that apply">
                  <div className="flex flex-wrap gap-2">
                    {(isTransmission ? TRANSMISSION_SYMPTOMS : SYMPTOMS).map((s) => {
                      const on = form.suspension.symptoms.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set('suspension', 'symptoms', on ? form.suspension.symptoms.filter((x) => x !== s) : [...form.suspension.symptoms, s])}
                          className={clsx(
                            'inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-medium transition',
                            on ? 'border-brand-500 bg-brand-500 text-white' : 'border-navy-200 bg-white text-navy-700 hover:border-navy-400',
                          )}
                        >
                          {on && <Check className="size-3.5" />} {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Describe the problem" required error={e['suspension.description']} htmlFor="desc">
                  <Textarea
                    id="desc"
                    rows={5}
                    placeholder="When did it start? Does it happen when the car is parked, moving, or over bumps? Any previous repairs?"
                    value={form.suspension.description}
                    onChange={(ev) => set('suspension', 'description', ev.target.value)}
                    invalid={!!e['suspension.description']}
                  />
                </Field>
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section title="Photo & video upload" intro="Very helpful! Our technicians can start assessing before your component arrives.">
              <div className="grid gap-2 text-sm text-navy-600 sm:grid-cols-2">
                {['The shock / strut', 'The vehicle', 'Damaged components', 'Oil or air leaks', 'Dashboard warning lights', 'A short video showing the fault'].map((t) => (
                  <p key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-brand-500" /> {t}</p>
                ))}
              </div>
              <FileDrop onFiles={addFiles} disabled={files.length >= MAX_FILES} />
              {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
              {files.length > 0 && (
                <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {files.map((f, i) => (
                    <FilePreview key={`${f.name}-${i}`} file={f} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />
                  ))}
                </ul>
              )}
              <p className="mt-4 text-sm text-navy-400">Up to {MAX_FILES} files, 50MB each. You can skip this step.</p>
            </Section>
          )}

          {step === 4 && (
            <Section title="Collection / delivery options" intro="How will the component get to our workshop? Choose what works best for you.">
              <div className="grid gap-3">
                <ChoiceCard checked={form.delivery.option === 'DROP_OFF'} onClick={() => set('delivery', 'option', 'DROP_OFF')} icon={<Building2 className="size-5" />} description={BUSINESS.address ? `Bring it to our workshop: ${BUSINESS.address}` : 'Bring it to our workshop. We’ll send you directions.'}>
                  I will bring it to the workshop
                </ChoiceCard>
                <ChoiceCard checked={form.delivery.option === 'PICKUP'} onClick={() => set('delivery', 'option', 'PICKUP')} icon={<Truck className="size-5" />} description="We'll collect the component (or vehicle) from your location.">
                  Workshop pickup: collect it from me
                </ChoiceCard>
                <ChoiceCard checked={form.delivery.option === 'SHIP'} onClick={() => set('delivery', 'option', 'SHIP')} icon={<Package className="size-5" />} description="Outside Lagos? Send it by courier — we'll show you how.">
                  I will ship the component
                </ChoiceCard>
              </div>
              {e['delivery.option'] && <p className="mt-2 text-sm text-red-600">{e['delivery.option']}</p>}

              {form.delivery.option === 'PICKUP' && (
                <div className="mt-6 grid gap-5 rounded-xl bg-navy-50 p-4 sm:grid-cols-2 sm:p-5">
                  <Field label="Pickup address" required error={e['delivery.pickupAddress']} className="sm:col-span-2" htmlFor="paddr">
                    <Textarea id="paddr" rows={2} className="min-h-0" value={form.delivery.pickupAddress} onChange={(ev) => set('delivery', 'pickupAddress', ev.target.value)} invalid={!!e['delivery.pickupAddress']} />
                  </Field>
                  <Field label="Preferred date" required error={e['delivery.pickupDate']} htmlFor="pdate">
                    <Input id="pdate" type="date" min={new Date().toISOString().slice(0, 10)} value={form.delivery.pickupDate} onChange={(ev) => set('delivery', 'pickupDate', ev.target.value)} invalid={!!e['delivery.pickupDate']} />
                  </Field>
                  <Field label="Preferred time" htmlFor="ptime">
                    <Select id="ptime" value={form.delivery.pickupTime} onChange={(ev) => set('delivery', 'pickupTime', ev.target.value)}>
                      <option value="">Any time</option>
                      <option>Morning (8am – 12pm)</option>
                      <option>Afternoon (12pm – 4pm)</option>
                      <option>Evening (4pm – 6pm)</option>
                    </Select>
                  </Field>
                </div>
              )}
              {form.delivery.option === 'SHIP' && <ShippingInstructions className="mt-6" />}

              <Review form={form} files={files.length} onEdit={goTo} />
            </Section>
          )}

          {submitError && <Alert kind="error" className="mt-6">{submitError}</Alert>}

          {submitting && files.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between text-sm font-medium text-navy-600">
                <span>Uploading photos & videos…</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-navy-100 bg-white/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_-12px_rgb(7_18_38/0.25)] backdrop-blur-xl sm:static sm:z-auto sm:mt-8 sm:justify-between sm:border-t sm:bg-transparent sm:px-0 sm:pt-6 sm:pb-0 sm:shadow-none sm:backdrop-blur-none">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={submitting} className="shrink-0 px-3 sm:px-5" aria-label="Back">
                <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Back</span>
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            {isLast ? (
              <Button size="lg" onClick={submit} loading={submitting} icon={!submitting && <Send className="size-4" />} className="flex-1 sm:flex-none">
                Submit Repair Request
              </Button>
            ) : (
              <Button size="lg" onClick={next} className="flex-1 sm:flex-none">
                {step === 3 && files.length === 0 ? 'Skip for now' : 'Continue'} <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-navy-400">
          Prefer to talk? Call <a href={BUSINESS.phoneHref} className="font-semibold text-navy-700">{BUSINESS.phone}</a> or{' '}
          <a href={BUSINESS.whatsappHref} className="font-semibold text-navy-700">chat on WhatsApp</a>.
        </p>
      </div>
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      {intro && <p className="mt-1 mb-6 text-navy-500">{intro}</p>}
      {children}
    </section>
  );
}

function FileDrop({ onFiles, disabled }: { onFiles: (f: FileList | null) => void; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files);
    e.target.value = '';
  };
  return (
    <>
    {/* Phones: straight to the camera, or the gallery */}
    <div className={clsx('mt-6 grid grid-cols-2 gap-3 sm:hidden', disabled && 'pointer-events-none opacity-50')}>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-navy-950 px-3 py-5 text-center text-white active:scale-[0.98]">
        <Camera className="size-7 text-brand-300" />
        <span className="text-[15px] font-semibold">Take a photo</span>
        <span className="text-xs text-navy-300">Opens your camera</span>
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} disabled={disabled} />
      </label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-navy-200 px-3 py-5 text-center active:scale-[0.98]">
        <ImagePlus className="size-7 text-brand-600" />
        <span className="text-[15px] font-semibold text-navy-950">From gallery</span>
        <span className="text-xs text-navy-500">Photos or videos</span>
        <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={pick} disabled={disabled} />
      </label>
      <label className="col-span-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-navy-200 py-3 text-sm font-semibold text-navy-800 active:scale-[0.98]">
        <FileVideo className="size-4 text-brand-600" /> Record a short video of the fault
        <input type="file" accept="video/*" capture="environment" className="sr-only" onChange={pick} disabled={disabled} />
      </label>
    </div>
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={clsx(
        'mt-6 hidden cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition sm:flex',
        over ? 'border-brand-500 bg-brand-50' : 'border-navy-200 bg-navy-50/50 hover:border-brand-400',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-white text-brand-500 shadow-card">
        <ImagePlus className="size-7" />
      </span>
      <span className="mt-4 font-semibold text-navy-900">Tap to take or choose photos/videos</span>
      <span className="mt-1 text-sm text-navy-500">or drag and drop them here</span>
      <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={pick} disabled={disabled} />
    </label>
    </>
  );
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <li className="group relative aspect-square overflow-hidden rounded-xl border border-navy-100 bg-navy-50">
      {url ? (
        <img src={url} alt={file.name} className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-navy-500">
          <FileVideo className="size-7" />
          <span className="line-clamp-2 text-center text-[11px] break-all">{file.name}</span>
        </div>
      )}
      <button type="button" onClick={onRemove} className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-navy-900/80 text-white" aria-label={`Remove ${file.name}`}>
        <X className="size-4" />
      </button>
    </li>
  );
}

export function ShippingInstructions({ className, repairId }: { className?: string; repairId?: string }) {
  return (
    <div className={clsx('rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950', className)}>
      <p className="flex items-center gap-2 font-bold"><Package className="size-4" /> Shipping instructions</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5">
        <li>Drain excess oil (hydraulic units) and seal any open ports with tape.</li>
        <li>Wrap the component in bubble wrap and pack it in a strong box.</li>
        <li>Write your Repair ID {repairId ? <strong>{repairId}</strong> : '(you\'ll get it next)'} clearly on the box and on a note inside.</li>
        <li>Send it to: <strong>{BUSINESS.name}{BUSINESS.address ? `, ${BUSINESS.address}` : ''}</strong>. Phone: {BUSINESS.phone}.</li>
        <li>Send us the courier's waybill number on WhatsApp.</li>
      </ol>
    </div>
  );
}

function Review({ form, files, onEdit }: { form: Form; files: number; onEdit: (s: number) => void }) {
  const rows: [string, string, number][] = [
    ['Name', `${form.customer.fullName} · ${form.customer.phone}`, 0],
    ['Vehicle', [form.vehicle.year, form.vehicle.make, form.vehicle.model].filter(Boolean).join(' ') + (form.vehicle.registration ? ` (${form.vehicle.registration.toUpperCase()})` : ''), 1],
    [
      'Component',
      [COMPONENT_LABELS[form.suspension.component], form.suspension.position].filter(Boolean).join(' · ') +
        ` — ${SUSPENSION_TYPES.find((t) => t.value === form.suspension.type)?.label ?? ''}`,
      2,
    ],
    ['Symptoms', form.suspension.symptoms.join(', ') || '—', 2],
    ['Photos/videos', files ? `${files} file${files > 1 ? 's' : ''}` : 'None', 3],
  ];
  return (
    <div className="mt-8">
      <h3 className="font-display font-bold">Review your request</h3>
      <dl className="mt-3 divide-y divide-navy-100 rounded-xl border border-navy-100">
        {rows.map(([k, v, s]) => (
          <div key={k} className="flex items-start gap-3 px-4 py-3 text-sm">
            <dt className="w-28 shrink-0 text-navy-400">{k}</dt>
            <dd className="flex-1 font-medium text-navy-800">{v}</dd>
            <button type="button" onClick={() => onEdit(s)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Success({ result }: { result: Result }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.repairId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };
  const trackPath = `/track/${result.repairId}?t=${result.trackToken}`;
  return (
    <div className="bg-navy-50/60">
      <div className="container-x max-w-2xl py-10 sm:py-16">
        <div className="overflow-hidden rounded-3xl bg-white shadow-lift">
          <div className="bg-navy-900 bg-tread px-6 py-10 text-center text-white sm:px-10">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white ring-8 ring-emerald-500/20">
              <Check className="size-8" strokeWidth={3} />
            </span>
            <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Repair Request Received</h1>
            <p className="mt-2 text-navy-200">Your Repair ID is</p>
            <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-white/10 px-5 py-3">
              <span className="font-mono text-2xl font-bold tracking-wider text-brand-300 sm:text-3xl">{result.repairId}</span>
              <button onClick={copy} className="rounded-lg p-2 text-navy-200 hover:bg-white/10 hover:text-white" aria-label="Copy Repair ID">
                {copied ? <Check className="size-5 text-emerald-400" /> : <Copy className="size-5" />}
              </button>
            </div>
            <p className="mt-3 text-sm text-navy-300">We've sent it to you by email and WhatsApp/SMS. Keep it to track your repair.</p>
          </div>
          <div className="space-y-6 p-6 sm:p-10">
            <div>
              <h2 className="font-display text-lg font-bold">What happens next</h2>
              {result.deliveryOption === 'DROP_OFF' && (
                <p className="mt-2 flex gap-2 text-navy-600"><MapPin className="mt-0.5 size-5 shrink-0 text-brand-500" /> <span>Bring your component to <strong>{workshopAddress()}</strong> ({BUSINESS.hours}). Mention your Repair ID at reception.</span></p>
              )}
              {result.deliveryOption === 'PICKUP' && <p className="mt-2 flex gap-2 text-navy-600"><Truck className="mt-0.5 size-5 shrink-0 text-brand-500" /> Our team will call you to confirm the pickup time.</p>}
              {result.deliveryOption === 'SHIP' && <ShippingInstructions className="mt-3" repairId={result.repairId} />}
              <ol className="mt-5 space-y-2 text-sm text-navy-600">
                <li>1. We receive and inspect your component.</li>
                <li>2. You get a digital diagnosis and quotation to approve.</li>
                <li>3. We repair, test and notify you when it's ready.</li>
              </ol>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <LinkButton to={trackPath} size="lg" className="flex-1">Track My Repair <ArrowRight className="size-4" /></LinkButton>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`My Airride Repair ID: ${result.repairId}\nTrack: ${result.trackingLink}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-lg border border-navy-200 font-semibold text-navy-900 hover:bg-navy-50"
              >
                Save to WhatsApp
              </a>
            </div>
            <p className="text-center text-sm"><Link to="/" className="font-semibold text-navy-500 hover:text-navy-900">Back to home</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
