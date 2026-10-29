import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  Camera,
  Car,
  ExternalLink,
  FileText,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Phone,
  Plus,
  Printer,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Wallet,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { RUNTIME, uploadDirect } from '../../lib/uploads';
import { isOffice, useMe } from '../../lib/auth';
import { BUSINESS, COMPONENT_LABELS, PAYMENT_STATUS_LABELS, STAGE_LABELS, STAGE_ORDER, type Stage } from '../../lib/constants';
import { date, dateTime, displayPhone, naira } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Alert, Badge, Card, Spinner, StageBadge } from '../../components/ui/misc';

type Job = {
  id: string;
  repairId: string;
  trackToken: string;
  stage: Stage;
  suspensionType: string;
  component: string;
  componentOther: string | null;
  position: string | null;
  symptoms: string[];
  description: string;
  deliveryOption: 'DROP_OFF' | 'PICKUP' | 'SHIP';
  pickupAddress: string | null;
  pickupDate: string | null;
  pickupTime: string | null;
  componentCondition: string | null;
  faultFound: string | null;
  partsRequired: string | null;
  diagnosis: string | null;
  repairProcedure: string | null;
  technicianNotes: string | null;
  testResults: string | null;
  qcResult: 'PASS' | 'FAIL' | null;
  estimatedCompletion: string | null;
  paymentStatus: string;
  amountPaid: number;
  createdAt: string;
  receivedAt: string | null;
  completedAt: string | null;
  customer: { fullName: string; phone: string; whatsapp: string | null; email: string | null; location: string | null; preferredContact: string };
  vehicle: { make: string; model: string; year: number | null; vin: string | null; registration: string | null; mileage: number | null; type: string };
  technician: { id: string; name: string } | null;
  history: { id: string; stage: Stage | null; title: string; note: string | null; visibleToCustomer: boolean; createdAt: string; createdBy: { name: string } | null }[];
  media: { id: string; phase: string; mimeType: string; caption: string | null; url: string; originalName: string; visibleToCustomer: boolean; createdAt: string; uploadedBy: { name: string } | null }[];
  quotations: {
    id: string;
    number: string;
    status: string;
    items: { id: string; kind: string; description: string; quantity: number; unitPrice: number; amount: number }[];
    subtotal: number;
    discount: number;
    total: number;
    depositPercent: number;
    validUntil: string;
    estimatedCompletion: string | null;
    notes: string | null;
    sentAt: string | null;
    respondedAt: string | null;
    respondedBy: string | null;
    customerMessage: string | null;
    createdAt: string;
  }[];
  payments: { id: string; reference: string; provider: string; amount: number; status: string; channel: string | null; receiptNumber: string | null; paidAt: string | null; createdAt: string }[];
  warranty: { id: string; months: number; startDate: string; expiryDate: string; terms: string; claims: { id: string; description: string; status: string; resolution: string | null; createdAt: string }[] } | null;
  notifications: { id: string; channel: string; recipient: string; subject: string | null; message: string; status: string; error: string | null; createdAt: string }[];
  previousJobs: { repairId: string; stage: Stage; component: string; createdAt: string }[];
};

export default function JobCard() {
  const { repairId = '' } = useParams();
  const { data: me } = useMe();
  const office = isOffice(me);
  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', repairId],
    queryFn: () => api.get<Job>(`/staff/jobs/${repairId}`).then((r) => r.data),
  });

  if (isLoading) return <Spinner />;
  if (error || !job) return <Alert kind="error">{errorMessage(error)}</Alert>;

  const vehicle = [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ');
  const component = job.component === 'OTHER' ? job.componentOther : COMPONENT_LABELS[job.component];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/staff/jobs" className="inline-flex items-center gap-1 text-sm font-semibold text-navy-500 hover:text-navy-900"><ArrowLeft className="size-4" /> Jobs</Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-bold sm:text-3xl">{job.repairId}</h1>
              <StageBadge stage={job.stage} />
              <Badge color={job.paymentStatus === 'PAID' ? 'green' : job.paymentStatus === 'PARTIAL' ? 'amber' : 'gray'}>{PAYMENT_STATUS_LABELS[job.paymentStatus]}</Badge>
            </div>
            <p className="mt-1 text-navy-600">{job.customer.fullName} · {vehicle} · {component}{job.position ? ` — ${job.position}` : ''}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print job card</Button>
            <a href={`/track/${job.repairId}?t=${job.trackToken}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3.5 text-sm font-semibold hover:bg-navy-50">
              <ExternalLink className="size-4" /> Customer view
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <StatusPanel job={job} office={office} />
          <JobCardForm job={job} />
          <Evidence job={job} />
          {office && <QuotePanel job={job} />}
          <TimelinePanel job={job} />
        </div>
        <div className="space-y-6">
          <CustomerPanel job={job} office={office} />
          <RequestPanel job={job} />
          <PaymentsPanel job={job} office={office} />
          <WarrantyPanel job={job} office={office} />
          <NotificationsPanel job={job} />
          {job.previousJobs.length > 0 && (
            <Panel title="Customer history">
              <ul className="divide-y divide-navy-50 text-sm">
                {job.previousJobs.map((p) => (
                  <li key={p.repairId} className="flex items-center justify-between py-2">
                    <Link to={`/staff/jobs/${p.repairId}`} className="font-mono font-semibold hover:text-brand-600">{p.repairId}</Link>
                    <span className="text-navy-400">{COMPONENT_LABELS[p.component]} · {date(p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children, action, className }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Card className={clsx('p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function useJobMutation<T>(job: Job, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', job.repairId] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['counts'] });
    },
  });
}

const TECH_BLOCKED: Stage[] = ['CANCELLED', 'QUOTE_SENT', 'DELIVERED', 'COMPLETED'];

/**
 * Opens the workshop's own WhatsApp with the update already written (free: no WhatsApp API needed).
 * Staff just press Send. The short link opens the customer's live tracking page.
 */
function whatsappUpdateLink(job: Job, label: string, message: string) {
  const c = job.customer;
  const num = (c.whatsapp || c.phone).replace(/\D/g, '');
  const text = [
    `Hello ${c.fullName.split(' ')[0]}, this is ${BUSINESS.name}.`,
    '',
    `Update on your repair *${job.repairId}*: *${label}*`,
    message,
    '',
    `Track it live: ${window.location.origin}/t/${job.trackToken}`,
    '',
    'Reply here if you have any questions.',
  ].join(String.fromCharCode(10));
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/**
 * Opens the phone's own SMS app with the update written (normal SMS rate, no Termii or Sender ID needed).
 * Kept to one SMS page: plain characters only, and the note is dropped if it would not fit.
 */
function smsUpdateLink(job: Job, label: string, message: string) {
  const plain = (t: string) => t.replace(/₦/g, 'NGN ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^ -~]/g, '').replace(/ {2,}/g, ' ').trim();
  const link = `${window.location.origin}/t/${job.trackToken}`;
  let text = plain(`Airride ${job.repairId}: ${label}. ${message} Track: ${link}`);
  if (text.length > 160) text = plain(`Airride ${job.repairId}: ${label}. Track: ${link}`);
  // "?&body=" works on both Android and iPhone.
  return `sms:+${job.customer.phone.replace(/\D/g, '')}?&body=${encodeURIComponent(text)}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5a9.47 9.47 0 01-4.83-1.32l-.35-.21-3.59.94.96-3.5-.23-.36a9.45 9.45 0 01-1.45-5.04c0-5.23 4.26-9.49 9.5-9.49 2.54 0 4.92.99 6.71 2.79a9.43 9.43 0 012.78 6.71c0 5.24-4.26 9.49-9.49 9.49zm8.08-17.57A11.35 11.35 0 0012.04.5C5.74.5.62 5.62.62 11.92c0 2.01.53 3.98 1.53 5.71L.5 23.5l6.02-1.58a11.4 11.4 0 005.45 1.39c6.3 0 11.42-5.12 11.42-11.42 0-3.05-1.19-5.92-3.35-8.08z" />
    </svg>
  );
}

function StatusPanel({ job, office }: { job: Job; office: boolean }) {
  const nextIdx = Math.min(STAGE_ORDER.indexOf(job.stage) + 1, STAGE_ORDER.length - 2);
  const [stage, setStage] = useState<Stage>(STAGE_ORDER[nextIdx]);
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(true);
  const [notify, setNotify] = useState(true);
  useEffect(() => {
    setStage(STAGE_ORDER[Math.min(STAGE_ORDER.indexOf(job.stage) + 1, STAGE_ORDER.length - 2)]);
  }, [job.stage]);

  const [sent, setSent] = useState<{ label: string; message: string } | null>(null);
  const m = useJobMutation(job, () =>
    api
      .patch<{ label: string; message: string }>(`/staff/jobs/${job.repairId}/stage`, { stage, note: note || undefined, visibleToCustomer: visible, notify: visible && notify })
      .then((r) => r.data),
  );
  const options = STAGE_ORDER.filter((s) => office || !TECH_BLOCKED.includes(s));

  return (
    <Panel title="Update repair status" icon={<Bell className="size-5 text-brand-500" />}>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <Field label="Move to stage">
          <Select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
            {options.map((s) => <option key={s} value={s} disabled={s === job.stage}>{STAGE_LABELS[s]}{s === job.stage ? ' (current)' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Note for the timeline" hint="Leave blank to use the standard message">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Oil seal and piston seal found damaged" />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-4 accent-brand-500" /> Show to customer</label>
          <label className={clsx('flex items-center gap-2', !visible && 'opacity-40')}><input type="checkbox" disabled={!visible} checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-brand-500" /> Notify customer (email, SMS, app alert)</label>
        </div>
        <Button
          onClick={() =>
            m.mutate(undefined, {
              onSuccess: (r) => {
                setNote('');
                setSent(visible ? (r as { label: string; message: string }) : null);
              },
            })
          }
          loading={m.isPending}
        >
          Update status
        </Button>
      </div>
      {m.isError && <Alert kind="error" className="mt-3">{errorMessage(m.error)}</Alert>}
      {sent && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-emerald-900">Status updated to “{sent.label}”</p>
            <p className="text-emerald-800">Send it to {job.customer.fullName.split(' ')[0]} too. The button opens WhatsApp or your SMS app with the message ready; just press Send.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              href={whatsappUpdateLink(job, sent.label, sent.message)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1faa53] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#178c44]"
            >
              <WhatsAppIcon className="size-4" /> Send on WhatsApp
            </a>
            <a href={smsUpdateLink(job, sent.label, sent.message)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100">
              <MessageSquare className="size-4" /> Send by SMS
            </a>
            <button onClick={() => setSent(null)} className="px-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950">Done</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function JobCardForm({ job }: { job: Job }) {
  const initial = {
    componentCondition: job.componentCondition ?? '',
    partsRequired: job.partsRequired ?? '',
    faultFound: job.faultFound ?? '',
    diagnosis: job.diagnosis ?? '',
    repairProcedure: job.repairProcedure ?? '',
    testResults: job.testResults ?? '',
    qcResult: job.qcResult ?? '',
    technicianNotes: job.technicianNotes ?? '',
    estimatedCompletion: job.estimatedCompletion?.slice(0, 10) ?? '',
  };
  const [f, setF] = useState(initial);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const m = useJobMutation(job, () =>
    api.patch(`/staff/jobs/${job.repairId}/job-card`, {
      ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v])),
    }),
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <Panel title="Digital diagnosis & job card" icon={<FileText className="size-5 text-brand-500" />} action={dirty && <Badge color="amber">Unsaved changes</Badge>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Component received (condition)" className="sm:col-span-2"><Textarea rows={2} className="min-h-0" value={f.componentCondition} onChange={set('componentCondition')} placeholder="Visual condition, leaks, damage on arrival" /></Field>
        <Field label="Parts required" hint="Visible to customer" className="sm:col-span-2"><Textarea rows={2} className="min-h-0" value={f.partsRequired} onChange={set('partsRequired')} placeholder="Seal kit, hydraulic oil, dust boot" /></Field>
        <Field label="Fault / symptoms found" hint="Visible to customer"><Textarea rows={3} value={f.faultFound} onChange={set('faultFound')} /></Field>
        <Field label="Diagnosis" hint="Visible to customer"><Textarea rows={3} value={f.diagnosis} onChange={set('diagnosis')} /></Field>
        <Field label="Repair procedure / work performed" hint="Visible to customer"><Textarea rows={3} value={f.repairProcedure} onChange={set('repairProcedure')} placeholder="Disassembled, cleaned, replaced seals, reassembled, pressure tested" /></Field>
        <Field label="Final test results" hint="Visible to customer"><Textarea rows={3} value={f.testResults} onChange={set('testResults')} placeholder="Pressure held at x bar for 24h, no leaks" /></Field>
        <Field label="Quality-control result">
          <Select value={f.qcResult} onChange={set('qcResult')}>
            <option value="">Not checked yet</option>
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
          </Select>
        </Field>
        <Field label="Estimated completion"><Input type="date" value={f.estimatedCompletion} onChange={set('estimatedCompletion')} /></Field>
        <Field label={<span className="flex items-center gap-1.5"><Lock className="size-3.5" /> Internal technician notes</span>} hint="Never shown to the customer" className="sm:col-span-2">
          <Textarea rows={3} value={f.technicianNotes} onChange={set('technicianNotes')} className="bg-amber-50/50" />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {m.isSuccess && !dirty && <span className="text-sm text-emerald-600">Saved</span>}
        {m.isError && <span className="text-sm text-red-600">{errorMessage(m.error)}</span>}
        <Button onClick={() => m.mutate(undefined)} loading={m.isPending} disabled={!dirty} icon={<Save className="size-4" />}>Save job card</Button>
      </div>
    </Panel>
  );
}

const PHASES = [
  { key: 'BEFORE', label: 'Before' },
  { key: 'DURING', label: 'During' },
  { key: 'AFTER', label: 'After' },
  { key: 'CUSTOMER', label: 'Customer uploads' },
];

function Evidence({ job }: { job: Job }) {
  const [phase, setPhase] = useState('BEFORE');
  const [caption, setCaption] = useState('');
  const [visible, setVisible] = useState(true);
  const [files, setFiles] = useState<FileList | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const upload = useJobMutation(job, async () => {
    if (RUNTIME.uploadMode === 'direct-to-storage') {
      const uploads = await uploadDirect(Array.from(files ?? []), 'staff');
      return api.post(`/staff/jobs/${job.repairId}/media`, { phase, caption: caption || undefined, visibleToCustomer: visible, uploads });
    }
    const body = new FormData();
    body.append('phase', phase);
    body.append('visibleToCustomer', String(visible));
    if (caption) body.append('caption', caption);
    Array.from(files ?? []).forEach((f) => body.append('files', f));
    return api.post(`/staff/jobs/${job.repairId}/media`, body);
  });
  const toggle = useJobMutation(job, (v: { id: string; visibleToCustomer: boolean }) => api.patch(`/staff/media/${v.id}`, { visibleToCustomer: v.visibleToCustomer }));

  return (
    <Panel title="Before / During / After evidence" icon={<Camera className="size-5 text-brand-500" />}>
      <div className="grid gap-3 rounded-xl bg-navy-50 p-4 sm:grid-cols-[auto_1fr_auto]">
        <div className="flex rounded-lg bg-white p-1 ring-1 ring-navy-200">
          {PHASES.slice(0, 3).map((p) => (
            <button key={p.key} onClick={() => setPhase(p.key)} className={clsx('rounded-md px-3 py-1.5 text-sm font-semibold', phase === p.key ? 'bg-brand-500 text-white' : 'text-navy-600')}>{p.label}</button>
          ))}
        </div>
        <Input className="h-10" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-3 text-sm font-semibold hover:bg-navy-50">
          <Camera className="size-4" /> {files?.length ? `${files.length} selected` : 'Choose files'}
          <input key={inputKey} type="file" multiple accept="image/*,video/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => setFiles(e.target.files)} />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-4 accent-brand-500" /> Visible to customer</label>
        <Button size="sm" icon={<Upload className="size-4" />} disabled={!files?.length} loading={upload.isPending} onClick={() => upload.mutate(undefined, { onSuccess: () => { setFiles(null); setCaption(''); setInputKey((k) => k + 1); } })}>Upload</Button>
      </div>
      {upload.isError && <Alert kind="error" className="mt-3">{errorMessage(upload.error)}</Alert>}

      {PHASES.map((p) => {
        const items = job.media.filter((m) => m.phase === p.key);
        if (!items.length) return null;
        return (
          <div key={p.key} className="mt-5">
            <h3 className="text-sm font-semibold text-navy-500">{p.label} ({items.length})</h3>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {items.map((m) => (
                <li key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-navy-100">
                  <a href={m.url} target="_blank" rel="noreferrer" className="block size-full">
                    {m.mimeType.startsWith('image/') ? <img src={m.url} alt={m.caption ?? m.originalName} loading="lazy" className="size-full object-cover" /> : m.mimeType.startsWith('video/') ? <video src={m.url} muted preload="metadata" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center"><FileText className="size-6 text-navy-400" /></span>}
                  </a>
                  <button
                    onClick={() => toggle.mutate({ id: m.id, visibleToCustomer: !m.visibleToCustomer })}
                    className={clsx('absolute top-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-bold', m.visibleToCustomer ? 'bg-emerald-500 text-white' : 'bg-navy-900/80 text-white')}
                    title="Toggle customer visibility"
                  >
                    {m.visibleToCustomer ? 'PUBLIC' : 'INTERNAL'}
                  </button>
                  {m.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{m.caption}</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Panel>
  );
}

type Line = { kind: string; description: string; quantity: string; unitPrice: string };
const emptyLine = (kind = 'PART'): Line => ({ kind, description: '', quantity: '1', unitPrice: '' });

function QuotePanel({ job }: { job: Job }) {
  const [building, setBuilding] = useState(false);
  const [lines, setLines] = useState<Line[]>([emptyLine('PART'), emptyLine('LABOUR'), { ...emptyLine('TESTING'), description: 'Pressure / leak / performance testing' }]);
  const [discount, setDiscount] = useState('');
  const [deposit, setDeposit] = useState('50');
  const [validDays, setValidDays] = useState('7');
  const [eta, setEta] = useState(job.estimatedCompletion?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState('');

  const create = useJobMutation(job, (send: boolean) =>
    api.post(`/staff/jobs/${job.repairId}/quotes`, {
      items: lines.filter((l) => l.description && l.unitPrice).map((l) => ({ ...l, quantity: Number(l.quantity) || 1, unitPrice: Number(l.unitPrice) })),
      discount: Number(discount) || 0,
      depositPercent: Number(deposit) || 0,
      validDays: Number(validDays) || 7,
      estimatedCompletion: eta || undefined,
      notes: notes || undefined,
      send,
    }),
  );
  const send = useJobMutation(job, (quoteId: string) => api.post(`/staff/jobs/${job.repairId}/quotes/${quoteId}/send`));

  const subtotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 1), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const setLine = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const valid = lines.some((l) => l.description && Number(l.unitPrice) > 0);

  const statusColor: Record<string, 'gray' | 'amber' | 'green' | 'red' | 'blue'> = { DRAFT: 'gray', SENT: 'amber', APPROVED: 'green', DECLINED: 'red', CLARIFICATION_REQUESTED: 'blue', SUPERSEDED: 'gray' };

  return (
    <Panel
      title="Quotations"
      icon={<FileText className="size-5 text-brand-500" />}
      action={!building && <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setBuilding(true)}>New quotation</Button>}
    >
      {job.quotations.length === 0 && !building && <p className="text-sm text-navy-400">No quotation yet. Create one after diagnosis.</p>}
      <ul className="space-y-3">
        {job.quotations.map((q) => (
          <li key={q.id} className={clsx('rounded-xl border p-4', q.status === 'SUPERSEDED' ? 'border-navy-100 opacity-60' : 'border-navy-200')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold">{q.number}</span>
              <Badge color={statusColor[q.status]}>{q.status.replace('_', ' ').toLowerCase()}</Badge>
            </div>
            <ul className="mt-2 text-sm text-navy-600">
              {q.items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.description}{i.quantity > 1 ? ` × ${i.quantity}` : ''}</span><span>{naira(i.amount)}</span></li>)}
            </ul>
            <div className="mt-2 flex justify-between border-t border-navy-100 pt-2 font-bold"><span>Total{q.discount > 0 ? ` (−${naira(q.discount)})` : ''}</span><span>{naira(q.total)}</span></div>
            <p className="mt-1 text-xs text-navy-400">
              {q.depositPercent > 0 ? `${q.depositPercent}% deposit · ` : ''}Valid until {date(q.validUntil)}
              {q.respondedAt && ` · ${q.status === 'APPROVED' ? 'Approved' : 'Answered'} by ${q.respondedBy} on ${dateTime(q.respondedAt)}`}
            </p>
            {q.customerMessage && <p className="mt-2 rounded-lg bg-sky-50 p-2 text-sm text-sky-900"><strong>Customer:</strong> “{q.customerMessage}”</p>}
            {q.status === 'DRAFT' && <Button size="sm" className="mt-3" icon={<Send className="size-4" />} loading={send.isPending} onClick={() => send.mutate(q.id)}>Send to customer</Button>}
          </li>
        ))}
      </ul>

      {building && (
        <div className="mt-4 rounded-xl border-2 border-brand-200 bg-brand-50/30 p-4">
          <h3 className="font-semibold">New quotation</h3>
          <p className="text-xs text-navy-500">Amounts in Naira. Creating a new quote replaces any unanswered one.</p>
          <div className="mt-3 space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[90px_1fr_56px_110px_32px] items-center gap-2">
                <Select className="h-10 px-2 text-sm" value={l.kind} onChange={(e) => setLine(i, 'kind', e.target.value)}>
                  <option value="PART">Part</option><option value="LABOUR">Labour</option><option value="TESTING">Testing</option><option value="OTHER">Other charges</option>
                </Select>
                <Input className="h-10 text-sm" placeholder="Description" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} />
                <Input className="h-10 px-2 text-center text-sm" inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value.replace(/\D/g, ''))} aria-label="Quantity" />
                <Input className="h-10 text-right text-sm" inputMode="decimal" placeholder="₦" value={l.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value.replace(/[^\d.]/g, ''))} aria-label="Unit price" />
                <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-navy-300 hover:text-red-500" aria-label="Remove line"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <button onClick={() => setLines([...lines, emptyLine()])} className="flex items-center gap-1 text-sm font-semibold text-brand-600"><Plus className="size-4" /> Add line</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Discount (₦)"><Input className="h-10" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
            <Field label="Deposit %"><Input className="h-10" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Valid (days)"><Input className="h-10" inputMode="numeric" value={validDays} onChange={(e) => setValidDays(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Est. completion"><Input className="h-10" type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></Field>
          </div>
          <Field label="Notes to customer" className="mt-3"><Textarea rows={2} className="min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg font-bold">Total: ₦{total.toLocaleString('en-NG')}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBuilding(false)}>Cancel</Button>
              <Button variant="outline" size="sm" disabled={!valid} loading={create.isPending} onClick={() => create.mutate(false, { onSuccess: () => setBuilding(false) })}>Save draft</Button>
              <Button size="sm" disabled={!valid} loading={create.isPending} icon={<Send className="size-4" />} onClick={() => create.mutate(true, { onSuccess: () => setBuilding(false) })}>Save & send</Button>
            </div>
          </div>
          {create.isError && <Alert kind="error" className="mt-3">{errorMessage(create.error)}</Alert>}
        </div>
      )}
    </Panel>
  );
}

function TimelinePanel({ job }: { job: Job }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(false);
  const add = useJobMutation(job, () => api.post(`/staff/jobs/${job.repairId}/notes`, { title, note: note || undefined, visibleToCustomer: visible, notify: visible }));
  const items = [...job.history].reverse();
  return (
    <Panel title="Timeline" action={<Button size="sm" variant="outline" icon={<MessageSquarePlus className="size-4" />} onClick={() => setAdding(!adding)}>Add note</Button>}>
      {adding && (
        <div className="mb-5 space-y-3 rounded-xl bg-navy-50 p-4">
          <Input className="h-10" placeholder="Title, e.g. Parts ordered" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={2} className="min-h-0" placeholder="Details" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-4 accent-brand-500" /> Show to customer & notify</label>
            <Button size="sm" disabled={!title} loading={add.isPending} onClick={() => add.mutate(undefined, { onSuccess: () => { setAdding(false); setTitle(''); setNote(''); } })}>Add</Button>
          </div>
        </div>
      )}
      <ol className="space-y-4">
        {items.map((h) => (
          <li key={h.id} className="flex gap-3">
            <span className={clsx('mt-1.5 size-2.5 shrink-0 rounded-full', h.visibleToCustomer ? 'bg-brand-500' : 'bg-navy-300')} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{h.title}</span>
                {!h.visibleToCustomer && <Badge><Lock className="size-3" /> Internal</Badge>}
              </div>
              {h.note && <p className="text-sm whitespace-pre-line text-navy-600">{h.note}</p>}
              <p className="text-xs text-navy-400">{dateTime(h.createdAt)}{h.createdBy ? ` · ${h.createdBy.name}` : ' · Customer/system'}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function CustomerPanel({ job, office }: { job: Job; office: boolean }) {
  const techs = useQuery({ queryKey: ['techs'], queryFn: () => api.get<{ id: string; name: string }[]>('/staff/technicians').then((r) => r.data), enabled: office });
  const assign = useJobMutation(job, (technicianId: string | null) => api.patch(`/staff/jobs/${job.repairId}/assign`, { technicianId }));
  const c = job.customer;
  const wa = (c.whatsapp || c.phone).replace(/\D/g, '');
  return (
    <Panel title="Customer & vehicle" icon={<User className="size-5 text-brand-500" />}>
      <p className="text-lg font-semibold">{c.fullName}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={`tel:+${c.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-semibold hover:bg-navy-100"><Phone className="size-4" /> {displayPhone(c.phone)}</a>
        <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello ${c.fullName.split(' ')[0]}, this is ${BUSINESS.name} about your repair ${job.repairId}.\n\nTrack it live: ${window.location.origin}/t/${job.trackToken}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-[#25D366]/20"><WhatsAppIcon className="size-4" /> WhatsApp</a>
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        {c.email && <Row k="Email" v={c.email} />}
        {c.location && <Row k="Location" v={c.location} />}
        <Row k="Prefers" v={cap(c.preferredContact)} />
      </dl>
      <div className="mt-4 border-t border-navy-100 pt-4">
        <p className="flex items-center gap-2 font-semibold"><Car className="size-4 text-navy-400" /> {[job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(' ')}</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row k="Type" v={cap(job.vehicle.type)} />
          {job.vehicle.registration && <Row k="Reg. no." v={job.vehicle.registration} />}
          {job.vehicle.vin && <Row k="VIN" v={job.vehicle.vin} />}
          {job.vehicle.mileage != null && <Row k="Mileage" v={`${job.vehicle.mileage.toLocaleString()} km`} />}
        </dl>
      </div>
      <div className="mt-4 border-t border-navy-100 pt-4">
        {office ? (
          <Field label="Assigned technician">
            <Select value={job.technician?.id ?? ''} onChange={(e) => assign.mutate(e.target.value || null)}>
              <option value="">Unassigned</option>
              {techs.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Row k="Technician" v={job.technician?.name ?? 'Unassigned'} />
        )}
      </div>
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex gap-3"><dt className="w-20 shrink-0 text-navy-400">{k}</dt><dd className="font-medium break-all">{v}</dd></div>;
}

function RequestPanel({ job }: { job: Job }) {
  return (
    <Panel title="Customer's request">
      <dl className="space-y-1.5 text-sm">
        {job.component !== 'AUTOMATIC_TRANSMISSION' && <Row k="Suspension" v={cap(job.suspensionType)} />}
        <Row k="Component" v={`${job.component === 'OTHER' ? job.componentOther : COMPONENT_LABELS[job.component]}${job.position ? ` · ${job.position}` : ''}`} />
        <Row k="Booked" v={dateTime(job.createdAt)} />
        <Row k="Collection" v={{ DROP_OFF: 'Customer drop-off', PICKUP: 'Workshop pickup', SHIP: 'Customer shipping' }[job.deliveryOption]} />
        {job.deliveryOption === 'PICKUP' && <Row k="Pickup" v={`${date(job.pickupDate)}${job.pickupTime ? `, ${job.pickupTime}` : ''} — ${job.pickupAddress}`} />}
      </dl>
      {job.symptoms.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{job.symptoms.map((s) => <Badge key={s} color="orange">{s}</Badge>)}</div>}
      <p className="mt-3 rounded-lg bg-navy-50 p-3 text-sm whitespace-pre-line">{job.description}</p>
    </Panel>
  );
}

function PaymentsPanel({ job, office }: { job: Job; office: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('TRANSFER');
  const record = useJobMutation(job, () => api.post(`/staff/jobs/${job.repairId}/payments`, { amount: Number(amount), method }));
  const approved = job.quotations.find((q) => q.status === 'APPROVED');
  const paid = job.payments.filter((p) => p.status === 'SUCCESS');
  return (
    <Panel title="Payments" icon={<Wallet className="size-5 text-brand-500" />} action={office && <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>Record payment</Button>}>
      <dl className="space-y-1.5 text-sm">
        <Row k="Quote total" v={approved ? naira(approved.total) : '—'} />
        <Row k="Paid" v={naira(job.amountPaid)} />
        <Row k="Balance" v={approved ? <strong>{naira(Math.max(0, approved.total - job.amountPaid))}</strong> : '—'} />
      </dl>
      {open && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-navy-50 p-3">
          <Input className="h-10" inputMode="decimal" placeholder="Amount ₦" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          <Select className="h-10" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="POS">POS</option>
          </Select>
          <Button size="sm" className="col-span-2" disabled={!(Number(amount) > 0)} loading={record.isPending} onClick={() => record.mutate(undefined, { onSuccess: () => { setOpen(false); setAmount(''); } })}>Save payment & send receipt</Button>
          {record.isError && <p className="col-span-2 text-sm text-red-600">{errorMessage(record.error)}</p>}
        </div>
      )}
      {paid.length > 0 && (
        <ul className="mt-4 divide-y divide-navy-50 border-t border-navy-100 text-sm">
          {paid.map((p) => (
            <li key={p.id} className="flex justify-between py-2">
              <span><span className="font-semibold">{naira(p.amount)}</span><span className="block text-xs text-navy-400">{p.receiptNumber} · {p.channel ?? p.provider} · {dateTime(p.paidAt)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WarrantyPanel({ job, office }: { job: Job; office: boolean }) {
  const w = job.warranty;
  const [editing, setEditing] = useState(false);
  const [months, setMonths] = useState(String(w?.months ?? 6));
  const [terms, setTerms] = useState(w?.terms ?? '');
  const save = useJobMutation(job, () => api.patch(`/staff/jobs/${job.repairId}/warranty`, { months: Number(months), terms }));
  const claim = useJobMutation(job, (v: { id: string; status: string; resolution?: string }) => api.patch(`/staff/warranty-claims/${v.id}`, v));
  return (
    <Panel title="Warranty" icon={<ShieldCheck className="size-5 text-brand-500" />} action={office && <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>{w ? 'Edit' : 'Set up'}</Button>}>
      {w ? (
        <dl className="space-y-1.5 text-sm">
          <Row k="Period" v={`${w.months} months`} />
          <Row k="Start" v={date(w.startDate)} />
          <Row k="Expires" v={<span className={new Date(w.expiryDate) > new Date() ? 'text-emerald-700' : 'text-red-600'}>{date(w.expiryDate)}</span>} />
        </dl>
      ) : <p className="text-sm text-navy-400">Created automatically when the job reaches Ready for Collection.</p>}
      {editing && (
        <div className="mt-3 space-y-2">
          <Input className="h-10" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ''))} aria-label="Months" />
          <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms & exclusions" />
          <Button size="sm" loading={save.isPending} disabled={!terms} onClick={() => save.mutate(undefined, { onSuccess: () => setEditing(false) })}>Save warranty</Button>
        </div>
      )}
      {w?.claims.map((c) => (
        <div key={c.id} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
          <div className="flex items-center justify-between"><span className="font-semibold">Claim · {date(c.createdAt)}</span><Badge color="amber">{c.status}</Badge></div>
          <p className="mt-1">{c.description}</p>
          {office && (
            <Select className="mt-2 h-9 text-sm" value={c.status} onChange={(e) => claim.mutate({ id: c.id, status: e.target.value })}>
              {['OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          )}
        </div>
      ))}
    </Panel>
  );
}

function NotificationsPanel({ job }: { job: Job }) {
  if (!job.notifications.length) return null;
  return (
    <Panel title="Messages sent">
      <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
        {job.notifications.map((n) => (
          <li key={n.id} className="rounded-lg bg-navy-50 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{n.channel}</span>
              <Badge color={n.status === 'SENT' ? 'green' : n.status === 'FAILED' ? 'red' : 'gray'}>{n.status.toLowerCase()}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-navy-600">{n.subject ?? n.message}</p>
            <p className="text-xs text-navy-400">{dateTime(n.createdAt)}{n.error ? ` · ${n.error}` : ''}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
