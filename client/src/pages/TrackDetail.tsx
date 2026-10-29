import clsx from 'clsx';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock,
  CreditCard,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  ThumbsDown,
  Wrench,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { BUSINESS, workshopAddress, PAYMENT_STATUS_LABELS, type Stage } from '../lib/constants';
import { date, dateTime, naira, shortDate } from '../lib/format';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Field';
import { Alert, Badge, Card, EmptyState, TrackSkeleton } from '../components/ui/misc';
import { TrackForm } from '../components/TrackForm';
import { InstallCard } from '../components/InstallCard';
import { ActivityFeed, AlertsCard, LiveHeader, MilestoneTrack, UpdateToast } from '../components/LiveTracker';
import { ShippingInstructions } from './Book';

type Quote = {
  id: string;
  number: string;
  status: 'SENT' | 'APPROVED' | 'DECLINED' | 'CLARIFICATION_REQUESTED' | 'SUPERSEDED';
  items: { kind: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discount: number;
  total: number;
  depositPercent: number;
  validUntil: string;
  estimatedCompletion: string | null;
  notes: string | null;
  sentAt: string | null;
  respondedAt: string | null;
};

type Receipt = { receiptNumber: string; amount: number; channel: string; paidAt: string; reference: string };

export type TrackView = {
  repairId: string;
  token: string;
  stage: Stage;
  stageLabel: string;
  stageMessage: string;
  technician: string | null;
  createdAt: string;
  receivedAt: string | null;
  completedAt: string | null;
  estimatedCompletion: string | null;
  customer: { name: string; email: string | null };
  vehicle: { make: string; model: string; year: number | null; registration: string | null };
  suspensionType: string;
  component: string;
  position: string | null;
  symptoms: string[];
  description: string;
  deliveryOption: 'DROP_OFF' | 'PICKUP' | 'SHIP';
  pickup: { address: string; date: string; time: string } | null;
  workshop: { name: string; address: string; phone: string };
  diagnosis: { faultFound: string | null; diagnosis: string | null; partsRequired: string | null; repairProcedure: string | null; testResults: string | null; qcResult: string | null } | null;
  timeline: { id: string; stage: Stage | null; title: string; note: string | null; at: string }[];
  media: { id: string; phase: 'CUSTOMER' | 'BEFORE' | 'DURING' | 'AFTER'; mimeType: string; caption: string | null; url: string; at: string }[];
  quotations: Quote[];
  payment: { status: string; amountPaid: number; total: number | null; balance: number | null; receipts: Receipt[] };
  warranty: {
    months: number;
    startDate: string;
    expiryDate: string;
    terms: string;
    active: boolean;
    claims: { id: string; description: string; status: string; resolution: string | null; at: string }[];
  } | null;
};

export default function TrackDetail() {
  const { repairId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const contact = (location.state as { contact?: string } | null)?.contact;
  const token = params.get('t');
  const reference = params.get('reference');
  const auth = token ? { t: token } : contact ? { contact } : null;

  const query = useQuery({
    queryKey: ['track', repairId, auth],
    queryFn: () => api.get<TrackView>(`/track/${repairId}`, { params: auth }).then((r) => r.data),
    enabled: !!auth,
    retry: 2,
    refetchInterval: 8_000, // live: picks up workshop updates within seconds while the page is open
  });
  const data = query.data;
  const { refetch } = query;

  // Connection state for the "Live" indicator; refresh straight away when the phone reconnects.
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => {
      setOnline(true);
      refetch();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    // A push alert arrived while this page is open: fetch the change immediately.
    const onMsg = (e: MessageEvent) => e.data?.type === 'repair-update' && refetch();
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      navigator.serviceWorker?.removeEventListener('message', onMsg);
    };
  }, [refetch]);

  // Activity newer than the customer's last visit is marked "New".
  const seenKey = `airride-seen:${repairId}`;
  const [seenAt] = useState(() => {
    try {
      return Number(localStorage.getItem(seenKey)) || Date.now();
    } catch {
      return Date.now();
    }
  });
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(seenKey, String(Date.now()));
    } catch {
      /* private mode */
    }
  }, [data, seenKey]);

  // Pop-up, vibration and tab title when the workshop changes something while the customer watches.
  const lastSig = useRef<string | null>(null);
  const [toast, setToast] = useState<{ title: string; text: string } | null>(null);
  useEffect(() => {
    if (!data) return;
    const sig = `${data.stage}|${data.timeline.length}|${data.media.length}|${data.payment.receipts.length}|${data.quotations.length}`;
    if (lastSig.current && lastSig.current !== sig) {
      const latest = data.timeline[data.timeline.length - 1];
      const [, , prevMedia] = lastSig.current.split('|').map(Number);
      const newPhotos = data.media.length - prevMedia;
      setToast(
        newPhotos > 0 && latest?.stage === data.stage && lastSig.current.startsWith(data.stage + '|')
          ? { title: 'New photos of your repair', text: `${newPhotos} new photo${newPhotos > 1 ? 's' : ''} from the workshop.` }
          : { title: latest?.title ?? data.stageLabel, text: latest?.note ?? data.stageMessage },
      );
      navigator.vibrate?.([120, 60, 120]);
      if (document.hidden) document.title = `● Update: ${data.stageLabel} | Airride`;
    }
    lastSig.current = sig;
  }, [data]);
  useEffect(() => {
    const reset = () => !document.hidden && document.title.startsWith('● ') && (document.title = 'Track My Repair | Airride');
    document.addEventListener('visibilitychange', reset);
    return () => document.removeEventListener('visibilitychange', reset);
  }, []);
  const [photoOpen, setPhotoOpen] = useState<TrackView['media'][number] | null>(null);

  // Once verified, swap phone-in-state for the token URL so refresh/bookmark works.
  useEffect(() => {
    if (data && !token) navigate(`/track/${data.repairId}?t=${data.token}`, { replace: true });
  }, [data, token, navigate]);

  // Returning from the payment page.
  const [payResult, setPayResult] = useState<{ ok: boolean; text: string } | null>(null);
  const verified = useRef<string | null>(null);
  useEffect(() => {
    if (!reference || verified.current === reference) return;
    verified.current = reference;
    api
      .get<{ status: string; amount: number; receiptNumber: string }>(`/payments/verify/${reference}`)
      .then(({ data: p }) => {
        if (p.status === 'SUCCESS') setPayResult({ ok: true, text: `Payment of ${naira(p.amount)} received. Receipt ${p.receiptNumber}.` });
        else if (p.status === 'FAILED') setPayResult({ ok: false, text: 'The payment was not completed. You have not been charged. Please try again.' });
        else setPayResult({ ok: true, text: 'Your payment is being confirmed. This page will update shortly.' });
      })
      .catch((e) => setPayResult({ ok: false, text: errorMessage(e) }))
      .finally(() => {
        qc.invalidateQueries({ queryKey: ['track', repairId] });
        params.delete('reference');
        params.delete('trxref');
        setParams(params, { replace: true });
      });
  }, [reference, params, setParams, qc, repairId]);

  if (!auth) {
    return (
      <div className="container-x max-w-2xl py-14">
        <h1 className="text-2xl font-bold">Verify it's you</h1>
        <p className="mt-2 text-navy-500">For your privacy, enter the phone number or email you used when booking <strong>{repairId}</strong>.</p>
        <div className="mt-6"><TrackForm layout="stacked" initialId={repairId} /></div>
      </div>
    );
  }

  if (query.isLoading) return <TrackSkeleton />;

  if (query.isError || !data) {
    return (
      <div className="container-x max-w-2xl py-14">
        <Alert kind="error" title="Repair not found">{errorMessage(query.error)}</Alert>
        <div className="mt-6"><TrackForm layout="stacked" initialId={repairId} /></div>
      </div>
    );
  }

  const openQuote = data.quotations.find((q) => q.status === 'SENT' || q.status === 'CLARIFICATION_REQUESTED');
  const approvedQuote = data.quotations.find((q) => q.status === 'APPROVED');
  const needsPayment = approvedQuote && (data.payment.balance ?? 0) > 0 && data.stage !== 'CANCELLED';

  return (
    <div className="bg-navy-50/60 pb-16">
      {toast && <UpdateToast title={toast.title} text={toast.text} repairId={data.repairId} onClose={() => setToast(null)} />}
      <LiveHeader data={data} lastSync={query.dataUpdatedAt} online={online} syncing={query.isFetching && !query.isLoading} />

      <div className="container-x space-y-6 pt-6">
        {payResult && <Alert kind={payResult.ok ? 'success' : 'error'}>{payResult.text}</Alert>}

        <Card className="p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Repair progress</h2>
            <button onClick={() => query.refetch()} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-navy-500 hover:bg-navy-50 hover:text-navy-800" aria-label="Refresh now">
              <RefreshCw className={clsx('size-4', query.isFetching && 'animate-spin')} /> <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          {data.stage === 'CANCELLED' ? <Alert kind="error">This repair was cancelled. Contact us if you have questions.</Alert> : <MilestoneTrack data={data} />}
        </Card>

        <AlertsCard repairId={data.repairId} auth={{ t: data.token }} />

        <InstallCard />

        {data.stage === 'AWAITING_COMPONENT' || data.stage === 'REQUEST_SUBMITTED' ? <AwaitingComponent data={data} /> : null}

        {openQuote && <QuoteCard quote={openQuote} data={data} actionable />}
        {needsPayment && <PayCard quote={approvedQuote} data={data} />}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Card className="p-5 sm:p-8">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="size-5 text-brand-500" /> Live activity</h2>
              <ActivityFeed data={data} seenAt={seenAt} onOpenPhoto={(id) => setPhotoOpen(data.media.find((m) => m.id === id) ?? null)} />
            </Card>
            {data.diagnosis && (data.diagnosis.faultFound || data.diagnosis.diagnosis) && <DiagnosisCard d={data.diagnosis} />}
            <Gallery media={data.media} open={photoOpen} setOpen={setPhotoOpen} />
          </div>
          <div className="space-y-6">
            {approvedQuote && <QuoteCard quote={approvedQuote} data={data} />}
            <PaymentSummary data={data} />
            <WarrantyCard data={data} />
            <RequestDetails data={data} />
            <Card className="p-5 text-sm">
              <p className="font-semibold">Questions about your repair?</p>
              <div className="mt-3 flex flex-col gap-2">
                <a href={`${BUSINESS.whatsappHref}?text=${encodeURIComponent(`Hello Airride, about my repair ${data.repairId}: `)}`} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline">Chat on WhatsApp</a>
                <a href={BUSINESS.phoneHref} className="flex items-center gap-1.5 font-semibold text-navy-700"><Phone className="size-4" /> {BUSINESS.phone}</a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function AwaitingComponent({ data }: { data: TrackView }) {
  return (
    <Card className="p-5 sm:p-8">
      <h2 className="text-lg font-bold">Next step: get your component to us</h2>
      {data.deliveryOption === 'DROP_OFF' && (
        <p className="mt-3 flex gap-2 text-navy-600"><MapPin className="mt-0.5 size-5 shrink-0 text-brand-500" /> <span>Bring it to <strong>{data.workshop.address || workshopAddress()}</strong> ({BUSINESS.hours}). Quote your Repair ID at reception.</span></p>
      )}
      {data.deliveryOption === 'PICKUP' && data.pickup && (
        <p className="mt-3 text-navy-600">Pickup requested for <strong>{date(data.pickup.date)}</strong>{data.pickup.time ? `, ${data.pickup.time}` : ''} at {data.pickup.address}. We'll call to confirm.</p>
      )}
      {data.deliveryOption === 'SHIP' && <ShippingInstructions className="mt-4" repairId={data.repairId} />}
    </Card>
  );
}

function QuoteTable({ quote }: { quote: Quote }) {
  return (
    <table className="w-full text-[15px]">
      <thead>
        <tr className="border-b border-navy-100 text-left text-xs font-semibold tracking-wide text-navy-400 uppercase">
          <th className="py-2">Item</th>
          <th className="py-2 text-right">Cost</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-navy-50">
        {quote.items.map((i, k) => (
          <tr key={k}>
            <td className="py-2.5 pr-3">
              {i.description}
              {i.quantity > 1 && <span className="text-navy-400"> × {i.quantity}</span>}
            </td>
            <td className="py-2.5 text-right font-medium whitespace-nowrap">{naira(i.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-navy-900">
        {quote.discount > 0 && (
          <>
            <tr><td className="pt-3 text-navy-500">Subtotal</td><td className="pt-3 text-right">{naira(quote.subtotal)}</td></tr>
            <tr><td className="text-emerald-700">Discount</td><td className="text-right text-emerald-700">−{naira(quote.discount)}</td></tr>
          </>
        )}
        <tr>
          <td className="pt-3 font-display text-lg font-bold">Total</td>
          <td className="pt-3 text-right font-display text-lg font-bold">{naira(quote.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function useRespond(data: TrackView) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { quoteId: string; action: 'APPROVE' | 'DECLINE' | 'CLARIFY'; message?: string }) =>
      api.post<TrackView>(`/track/${data.repairId}/quotes/${v.quoteId}/respond`, { t: data.token, action: v.action, message: v.message }).then((r) => r.data),
    onSuccess: (view) => qc.setQueriesData({ queryKey: ['track', data.repairId] }, view),
  });
}

function QuoteCard({ quote, data, actionable }: { quote: Quote; data: TrackView; actionable?: boolean }) {
  const respond = useRespond(data);
  const [mode, setMode] = useState<null | 'CLARIFY' | 'DECLINE'>(null);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const expired = new Date(quote.validUntil) < new Date();

  async function approve() {
    setErr('');
    try {
      await respond.mutateAsync({ quoteId: quote.id, action: 'APPROVE' });
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <Card className={clsx('overflow-hidden', actionable && 'ring-2 ring-brand-500')}>
      {actionable && (
        <div className="flex items-center gap-2 bg-brand-500 px-5 py-3 text-sm font-semibold text-white sm:px-8">
          <FileText className="size-4" /> Action required: please review your repair quotation
        </div>
      )}
      <div className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Repair Quotation</h2>
            <p className="text-sm text-navy-400">{quote.number} · Sent {date(quote.sentAt)}</p>
          </div>
          {quote.status === 'APPROVED' && <Badge color="green"><Check className="size-3" /> Approved {shortDate(quote.respondedAt!)}</Badge>}
          {quote.status === 'CLARIFICATION_REQUESTED' && <Badge color="amber">Clarification requested — we'll reply soon</Badge>}
        </div>
        <div className="mt-5"><QuoteTable quote={quote} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-navy-50 p-4 text-sm">
          <div><dt className="text-navy-400">Est. completion</dt><dd className="font-semibold">{date(quote.estimatedCompletion ?? data.estimatedCompletion)}</dd></div>
          <div><dt className="text-navy-400">Valid until</dt><dd className={clsx('font-semibold', expired && 'text-red-600')}>{date(quote.validUntil)}</dd></div>
          {quote.depositPercent > 0 && (
            <div className="col-span-2"><dt className="text-navy-400">Payment terms</dt><dd className="font-semibold">{quote.depositPercent}% deposit ({naira(Math.round((quote.total * quote.depositPercent) / 100))}) to start, balance before collection</dd></div>
          )}
        </dl>
        {quote.notes && <p className="mt-4 text-sm whitespace-pre-line text-navy-600">{quote.notes}</p>}

        {actionable && (
          <div className="mt-6">
            {err && <Alert kind="error" className="mb-4">{err}</Alert>}
            {expired ? (
              <Alert kind="info">This quotation has expired. Tap "Request clarification" to request an updated quote.</Alert>
            ) : null}
            {!mode && (
              <div className="grid gap-3 sm:grid-cols-3">
                {!expired && (
                  <Button size="lg" variant="success" onClick={approve} loading={respond.isPending} icon={<Check className="size-5" />} className="sm:col-span-3">
                    Approve quotation · {naira(quote.total)}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setMode('CLARIFY')} icon={<HelpCircle className="size-4" />} className="sm:col-span-2">Request clarification</Button>
                <Button variant="ghost" onClick={() => setMode('DECLINE')} icon={<ThumbsDown className="size-4" />} className="text-red-600 hover:bg-red-50">Decline</Button>
              </div>
            )}
            {mode && (
              <div className="rounded-xl border border-navy-100 p-4">
                <p className="font-semibold">{mode === 'CLARIFY' ? 'What would you like us to clarify?' : 'Decline this quotation?'}</p>
                <p className="mt-1 text-sm text-navy-500">{mode === 'CLARIFY' ? 'Our service advisor will reply by WhatsApp or phone.' : "Tell us why (optional). We'll contact you about returning your component."}</p>
                <Textarea className="mt-3" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
                <div className="mt-3 flex gap-2">
                  <Button
                    variant={mode === 'DECLINE' ? 'danger' : 'primary'}
                    loading={respond.isPending}
                    onClick={() => respond.mutate({ quoteId: quote.id, action: mode, message: message || undefined }, { onSuccess: () => setMode(null), onError: (e) => setErr(errorMessage(e)) })}
                  >
                    {mode === 'CLARIFY' ? 'Send question' : 'Decline quotation'}
                  </Button>
                  <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-navy-400">
              By approving you authorise {BUSINESS.name} to carry out the repair above. Your approval is recorded with the date and time. Payment is made at the workshop by cash or bank transfer.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function PayCard({ quote, data }: { quote: Quote; data: TrackView }) {
  const deposit = quote.depositPercent > 0 && data.payment.amountPaid === 0 ? Math.round((quote.total * quote.depositPercent) / 100) : null;
  const ask = `${BUSINESS.whatsappHref}?text=${encodeURIComponent(`Hello ${BUSINESS.name}, I'd like to pay for repair ${data.repairId}. Please send your bank details.`)}`;
  return (
    <Card className="p-5 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CreditCard className="size-5 text-brand-500" /> Payment</h2>
          <p className="mt-1 text-navy-600">
            {deposit != null ? (
              <>Deposit to start: <strong className="text-navy-900">{naira(deposit)}</strong> <span className="text-navy-400">({quote.depositPercent}% of {naira(quote.total)})</span></>
            ) : (
              <>Balance due: <strong className="text-navy-900">{naira(data.payment.balance)}</strong>{data.payment.amountPaid > 0 && <span className="text-navy-400"> (paid {naira(data.payment.amountPaid)} of {naira(quote.total)})</span>}</>
            )}
          </p>
          <p className="mt-1 text-sm text-navy-500">Pay at the workshop by cash or bank transfer. Your receipt appears on this page as soon as we record it.</p>
        </div>
        <a href={ask} target="_blank" rel="noreferrer" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1faa53] px-5 font-semibold text-white transition hover:bg-[#178c44]">
          Ask for bank details
        </a>
      </div>
    </Card>
  );
}

function DiagnosisCard({ d }: { d: NonNullable<TrackView['diagnosis']> }) {
  const rows: [string, string | null][] = [
    ['Fault found', d.faultFound],
    ['Diagnosis', d.diagnosis !== d.faultFound ? d.diagnosis : null],
    ['Parts required', d.partsRequired],
    ['Work performed', d.repairProcedure],
    ['Test results', d.testResults],
  ];
  return (
    <Card className="p-5 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Stethoscope className="size-5 text-brand-500" /> Technician report</h2>
        {d.qcResult && <Badge color={d.qcResult === 'PASS' ? 'green' : 'red'}>Quality check: {d.qcResult}</Badge>}
      </div>
      <dl className="mt-5 space-y-4">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm font-semibold text-navy-400">{k}</dt>
            <dd className="mt-0.5 whitespace-pre-line text-navy-800">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

const PHASES: { key: TrackView['media'][number]['phase']; label: string }[] = [
  { key: 'BEFORE', label: 'Before' },
  { key: 'DURING', label: 'During repair' },
  { key: 'AFTER', label: 'After' },
  { key: 'CUSTOMER', label: 'Your uploads' },
];

function Gallery({ media, open, setOpen }: { media: TrackView['media']; open: TrackView['media'][number] | null; setOpen: (m: TrackView['media'][number] | null) => void }) {
  const available = PHASES.filter((p) => media.some((m) => m.phase === p.key));
  const [tab, setTab] = useState(available[0]?.key);
  const shown = media.filter((m) => m.phase === (tab ?? available[0]?.key));

  return (
    <Card className="p-5 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold"><ImageIcon className="size-5 text-brand-500" /> Before / During / After</h2>
      {media.length === 0 ? (
        <EmptyState icon={<ImageIcon className="size-5" />} title="No photos yet">Our technicians will add photos as your repair progresses.</EmptyState>
      ) : (
        <>
          <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg bg-navy-50 p-1">
            {available.map((p) => (
              <button key={p.key} onClick={() => setTab(p.key)} className={clsx('rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap', (tab ?? available[0].key) === p.key ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500')}>
                {p.label} <span className="text-navy-400">({media.filter((m) => m.phase === p.key).length})</span>
              </button>
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((m) => (
              <li key={m.id}>
                <button onClick={() => setOpen(m)} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-navy-100">
                  {m.mimeType.startsWith('image/') ? (
                    <img src={m.url} alt={m.caption ?? 'Repair photo'} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                  ) : m.mimeType.startsWith('video/') ? (
                    <video src={m.url} className="size-full object-cover" muted preload="metadata" />
                  ) : (
                    <span className="flex size-full items-center justify-center"><FileText className="size-8 text-navy-400" /></span>
                  )}
                  {m.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 p-2 text-left text-xs text-white">{m.caption}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal>
          <button className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close"><X className="size-6" /></button>
          <div className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {open.mimeType.startsWith('video/') ? <video src={open.url} controls autoPlay className="max-h-[80vh] rounded-lg" /> : open.mimeType.startsWith('image/') ? <img src={open.url} alt={open.caption ?? ''} className="max-h-[80vh] rounded-lg" /> : <a href={open.url} target="_blank" rel="noreferrer" className="text-white underline">Open file</a>}
            {open.caption && <p className="mt-3 text-center text-white">{open.caption}</p>}
          </div>
        </div>
      )}
    </Card>
  );
}

function printReceipt(data: TrackView, r: Receipt) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  w.document.write(`<!doctype html><html><head><title>Receipt ${esc(r.receiptNumber)}</title>
  <style>body{font-family:Arial,sans-serif;color:#0b1b33;max-width:600px;margin:40px auto;padding:0 20px}
  .h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0058c4;padding-bottom:16px}
  h1{margin:0;font-size:22px}.o{color:#0058c4}table{width:100%;border-collapse:collapse;margin-top:24px}
  td{padding:10px 0;border-bottom:1px solid #e3e9f3}td:last-child{text-align:right;font-weight:bold}
  .t{font-size:28px;font-weight:bold;margin-top:24px}.m{color:#5f7aa6;font-size:13px}</style></head><body>
  <div class="h"><div><h1>AIR<span class="o">RIDE</span> Suspension Clinic</h1><p class="m">${esc(data.workshop.address)}<br>${esc(data.workshop.phone)}</p></div>
  <div style="text-align:right"><strong>PAYMENT RECEIPT</strong><p class="m">${esc(r.receiptNumber)}<br>${esc(dateTime(r.paidAt))}</p></div></div>
  <table><tr><td>Customer</td><td>${esc(data.customer.name)}</td></tr><tr><td>Repair ID</td><td>${esc(data.repairId)}</td></tr>
  <tr><td>Vehicle</td><td>${esc([data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(' '))}</td></tr>
  <tr><td>Component</td><td>${esc(data.component)}</td></tr><tr><td>Payment method</td><td>${esc(r.channel ?? '')}</td></tr>
  <tr><td>Reference</td><td>${esc(r.reference)}</td></tr></table>
  <p class="t">Amount paid: ${esc(naira(r.amount))}</p>
  <p class="m">Total repair cost: ${esc(naira(data.payment.total))} · Balance: ${esc(naira(data.payment.balance))}</p>
  <p class="m" style="margin-top:40px">Thank you for choosing Airride Suspension Clinic.</p>
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

function PaymentSummary({ data }: { data: TrackView }) {
  if (!data.payment.total && data.payment.receipts.length === 0) return null;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold"><CreditCard className="size-5 text-brand-500" /> Payments</h2>
        <Badge color={data.payment.status === 'PAID' ? 'green' : data.payment.status === 'PARTIAL' ? 'amber' : 'gray'}>{PAYMENT_STATUS_LABELS[data.payment.status]}</Badge>
      </div>
      {data.payment.total != null && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (data.payment.amountPaid / data.payment.total) * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-navy-600">{naira(data.payment.amountPaid)} of {naira(data.payment.total)} paid</p>
        </div>
      )}
      {data.payment.receipts.length > 0 && (
        <ul className="mt-4 divide-y divide-navy-100 border-t border-navy-100">
          {data.payment.receipts.map((r) => (
            <li key={r.reference} className="flex items-center justify-between gap-2 py-3 text-sm">
              <span>
                <span className="block font-semibold">{naira(r.amount)}</span>
                <span className="text-navy-400">{r.receiptNumber} · {date(r.paidAt)}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => printReceipt(data, r)} icon={<Printer className="size-4" />}>Receipt</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function WarrantyCard({ data }: { data: TrackView }) {
  const qc = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [text, setText] = useState('');
  const claim = useMutation({
    mutationFn: () => api.post<TrackView>(`/track/${data.repairId}/warranty-claims`, { t: data.token, description: text }).then((r) => r.data),
    onSuccess: (view) => {
      qc.setQueriesData({ queryKey: ['track', data.repairId] }, view);
      setClaiming(false);
      setText('');
    },
  });
  const w = data.warranty;
  if (!w) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-brand-500" /> Warranty</h2>
        <p className="mt-2 text-sm text-navy-500">Your warranty starts when the repair is completed.</p>
      </Card>
    );
  }
  return (
    <Card className={clsx('overflow-hidden', w.active ? 'border-emerald-200' : '')}>
      <div className={clsx('p-5 sm:p-6', w.active ? 'bg-emerald-50' : 'bg-navy-50')}>
        <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className={clsx('size-5', w.active ? 'text-emerald-600' : 'text-navy-400')} /> Warranty: {w.months} months</h2>
        <p className={clsx('mt-1 text-lg font-bold', w.active ? 'text-emerald-700' : 'text-navy-500')}>{w.active ? `Active until ${date(w.expiryDate)}` : `Expired ${date(w.expiryDate)}`}</p>
        <p className="text-sm text-navy-500">Started {date(w.startDate)}</p>
      </div>
      <div className="p-5 sm:p-6">
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-navy-700">Terms & exclusions</summary>
          <p className="mt-2 whitespace-pre-line text-navy-500">{w.terms}</p>
        </details>
        {w.claims.length > 0 && (
          <ul className="mt-4 space-y-2">
            {w.claims.map((c) => (
              <li key={c.id} className="rounded-lg bg-navy-50 p-3 text-sm">
                <div className="flex justify-between"><span className="font-semibold">Claim · {date(c.at)}</span><Badge color={c.status === 'RESOLVED' || c.status === 'APPROVED' ? 'green' : c.status === 'REJECTED' ? 'red' : 'amber'}>{c.status.replace('_', ' ').toLowerCase()}</Badge></div>
                <p className="mt-1 text-navy-600">{c.description}</p>
                {c.resolution && <p className="mt-1 text-navy-500"><strong>Response:</strong> {c.resolution}</p>}
              </li>
            ))}
          </ul>
        )}
        {w.active && !claiming && <Button variant="outline" size="sm" className="mt-4" onClick={() => setClaiming(true)}>Open a warranty claim</Button>}
        {claiming && (
          <div className="mt-4">
            <Textarea rows={3} placeholder="Describe the problem you're experiencing" value={text} onChange={(e) => setText(e.target.value)} />
            {claim.isError && <p className="mt-1 text-sm text-red-600">{errorMessage(claim.error)}</p>}
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => claim.mutate()} loading={claim.isPending} disabled={text.trim().length < 10}>Submit claim</Button>
              <Button size="sm" variant="ghost" onClick={() => setClaiming(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function RequestDetails({ data }: { data: TrackView }) {
  const rows: [string, ReactNode][] = [
    ['Vehicle', [data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(' ')],
    ['Registration', data.vehicle.registration ?? '—'],
    ['Component', `${data.component}${data.position ? ` · ${data.position}` : ''}`],
    ...(data.component === 'Automatic Transmission' ? [] : [['Suspension', data.suspensionType.charAt(0) + data.suspensionType.slice(1).toLowerCase()] as [string, ReactNode]]),
    ['Symptoms', data.symptoms.join(', ') || '—'],
    ['Collection', { DROP_OFF: 'Drop-off at workshop', PICKUP: 'Pickup', SHIP: 'Shipped by courier' }[data.deliveryOption]],
  ];
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold"><Wrench className="size-5 text-brand-500" /> Your request</h2>
      <dl className="mt-3 divide-y divide-navy-50 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 py-2">
            <dt className="w-24 shrink-0 text-navy-400">{k}</dt>
            <dd className="font-medium text-navy-800">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-lg bg-navy-50 p-3 text-sm whitespace-pre-line text-navy-600">{data.description}</p>
    </Card>
  );
}
