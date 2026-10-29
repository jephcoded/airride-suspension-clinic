import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Car, FileText, LogOut, Receipt, ShieldCheck, Wrench } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { date, displayPhone, naira } from '../lib/format';
import { PAYMENT_STATUS_LABELS, type Stage } from '../lib/constants';
import { PageHero } from '../components/layout/SiteLayout';
import { Button } from '../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Skeleton, StageBadge } from '../components/ui/misc';
import { InstallCard } from '../components/InstallCard';

type Repair = {
  repairId: string;
  token: string;
  active: boolean;
  stage: Stage;
  stageLabel: string;
  component: string;
  position: string | null;
  vehicle: string;
  registration: string | null;
  createdAt: string;
  completedAt: string | null;
  paymentStatus: string;
  amountPaid: number;
  quotes: { number: string; status: string; total: number; sentAt: string | null; validUntil: string }[];
  receipts: { receiptNumber: string | null; amount: number; channel: string | null; paidAt: string | null }[];
  warranty: { months: number; startDate: string; expiryDate: string; active: boolean } | null;
};
type Me = { name: string; contact: string; repairs: Repair[]; vehicles: { id: string; name: string; registration: string | null; type: string; repairs: number }[] };

const FIELD =
  'h-12 w-full rounded-md border border-navy-300 bg-white px-4 text-[15px] text-navy-950 placeholder:text-navy-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15 focus:outline-none';

/** Spec §16: customer account with repair history. Sign-in is a one-time code (spec §8), no password. */
export default function Account() {
  const me = useQuery({
    queryKey: ['account'],
    queryFn: () => api.get<Me>('/account/me').then((r) => r.data),
    refetchInterval: 15_000,
    retry: false,
  });
  return (
    <>
      <PageHero eyebrow="My Repairs" title="Your repair history." intro="Sign in with the phone number or email you booked with to see every repair, quote, receipt and warranty in one place." />
      <section className="container-x py-12 sm:py-16">
        {me.isLoading ? (
          <div className="mx-auto max-w-md space-y-4 rounded-xl border border-navy-100 p-8"><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : me.data ? (
          <>
            <InstallCard className="mb-6" />
            <Dashboard me={me.data} />
          </>
        ) : (
          <SignIn />
        )}
      </section>
    </>
  );
}

function SignIn() {
  const qc = useQueryClient();
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();

  const request = useMutation({
    mutationFn: () => api.post<{ ok: true; devCode?: string }>('/account/otp', { contact }).then((r) => r.data),
    onSuccess: (d) => {
      setSent(true);
      setDevCode(d.devCode);
    },
  });
  const verify = useMutation({
    mutationFn: () => api.post('/account/verify', { contact, code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account'] }),
  });

  const submitContact = (e: FormEvent) => {
    e.preventDefault();
    request.mutate();
  };
  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate();
  };

  return (
    <Card className="mx-auto max-w-md p-6 sm:p-8">
      {!sent ? (
        <form onSubmit={submitContact} noValidate>
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-[15px] text-navy-600">Use the phone number or email you gave when you booked a repair. We'll send you a 6-digit code. No password needed.</p>
          <label htmlFor="acct-contact" className="mt-6 mb-1.5 block text-sm font-semibold text-navy-900">
            Phone number or email
          </label>
          <input id="acct-contact" className={FIELD} placeholder="0803 123 4567" autoComplete="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
          {request.isError && <Alert kind="error" className="mt-4">{errorMessage(request.error)}</Alert>}
          <Button type="submit" size="lg" className="mt-5 w-full" loading={request.isPending} disabled={contact.trim().length < 5}>
            Send my code
          </Button>
          <p className="mt-5 text-center text-sm text-navy-500">
            Just want one repair? <Link to="/track" className="font-semibold text-brand-600 hover:underline">Track with your Repair ID</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <h2 className="text-xl font-semibold tracking-tight">Enter your code</h2>
          <p className="mt-1 text-[15px] text-navy-600">
            If <strong className="text-navy-900">{contact}</strong> is on any of our repairs, a code is on its way by {contact.includes('@') ? 'email' : 'SMS'}. It expires in 10 minutes.
          </p>
          <div className="mt-4 rounded-lg bg-navy-50 p-3.5 text-sm text-navy-600">
            <p className="font-semibold text-navy-800">No code after a minute?</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {contact.includes('@') && <li>Check your spam or promotions folder.</li>}
              <li>Make sure it's the same {contact.includes('@') ? 'email' : 'number'} you used when booking.</li>
              <li>
                Haven't booked yet? <Link to="/book" className="font-semibold text-brand-600 hover:underline">Book a repair</Link> first. Your history appears here after that.
              </li>
            </ul>
          </div>
          {devCode && <Alert kind="info" className="mt-4">Test mode (no SMS/email connected yet): your code is <strong>{devCode}</strong></Alert>}
          <label htmlFor="acct-code" className="mt-6 mb-1.5 block text-sm font-semibold text-navy-900">
            6-digit code
          </label>
          <input
            id="acct-code"
            className={FIELD + ' text-center font-mono text-xl tracking-[0.5em]'}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {verify.isError && <Alert kind="error" className="mt-4">{errorMessage(verify.error)}</Alert>}
          <Button type="submit" size="lg" className="mt-5 w-full" loading={verify.isPending} disabled={code.length !== 6}>
            Sign in
          </Button>
          <div className="mt-5 flex justify-between text-sm">
            <button type="button" className="font-semibold text-navy-600 hover:text-navy-950" onClick={() => { setSent(false); setCode(''); }}>
              Use a different number
            </button>
            <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => request.mutate()} disabled={request.isPending}>
              Resend code
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function Dashboard({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'active' | 'completed'>(me.repairs.some((r) => r.active) ? 'active' : 'completed');
  const logout = useMutation({ mutationFn: () => api.post('/account/logout'), onSuccess: () => qc.setQueryData(['account'], null) });

  const active = me.repairs.filter((r) => r.active);
  const completed = me.repairs.filter((r) => !r.active);
  const shown = tab === 'active' ? active : completed;
  const receipts = me.repairs.flatMap((r) => r.receipts.map((x) => ({ ...x, repairId: r.repairId, token: r.token })));
  const quotes = me.repairs.flatMap((r) => r.quotes.map((q) => ({ ...q, repairId: r.repairId, token: r.token })));
  const warranties = me.repairs.filter((r) => r.warranty);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-navy-500">Signed in as {me.contact.includes('@') ? me.contact : displayPhone(me.contact)}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {me.name.split(' ')[0]}</h2>
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut className="size-4" />} onClick={() => logout.mutate()}>
          Sign out
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Active repairs', active.length],
          ['Completed repairs', completed.length],
          ['Vehicles', me.vehicles.length],
          ['Active warranties', warranties.filter((r) => r.warranty!.active).length],
        ].map(([k, v]) => (
          <Card key={k as string} className="p-4">
            <p className="text-[13px] text-navy-500">{k}</p>
            <p className="mt-1 font-display text-2xl font-bold">{v}</p>
          </Card>
        ))}
      </div>

      <section>
        <div className="flex items-center gap-1 rounded-lg bg-navy-50 p-1 sm:inline-flex">
          {(['active', 'completed'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={clsx('flex-1 rounded-md px-4 py-2 text-sm font-semibold sm:flex-none', tab === t ? 'bg-white text-navy-950 shadow-sm' : 'text-navy-600')}>
              {t === 'active' ? 'Active' : 'Completed'}<span className="hidden sm:inline"> repairs</span> ({t === 'active' ? active.length : completed.length})
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <Card className="mt-4">
            <EmptyState icon={<Wrench className="size-5" />} title={tab === 'active' ? 'No active repairs' : 'No completed repairs yet'}>
              <Link to="/book" className="font-semibold text-brand-600 hover:underline">Book a repair</Link>
            </EmptyState>
          </Card>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {shown.map((r) => (
              <li key={r.repairId}>
                <Link to={`/track/${r.repairId}?t=${r.token}`} className="group block rounded-xl border border-navy-100 bg-white p-5 transition hover:border-navy-300 hover:shadow-card">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono font-semibold text-navy-950">{r.repairId}</span>
                    <StageBadge stage={r.stage} />
                  </div>
                  <p className="mt-2 font-medium text-navy-900">{r.vehicle}{r.registration ? ` · ${r.registration}` : ''}</p>
                  <p className="text-sm text-navy-600">{r.component}{r.position ? ` · ${r.position}` : ''}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-navy-500">Booked {date(r.createdAt)} · {PAYMENT_STATUS_LABELS[r.paymentStatus]}</span>
                    <span className="flex items-center gap-1 font-semibold text-navy-950 group-hover:text-brand-600">
                      View <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Car className="size-5 text-brand-600" /> Vehicle history</h3>
          <ul className="mt-3 divide-y divide-navy-100 text-sm">
            {me.vehicles.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 py-2.5">
                <span className="font-medium text-navy-900">{v.name}{v.registration ? <span className="text-navy-500"> · {v.registration}</span> : null}</span>
                <span className="shrink-0 text-navy-500">{v.repairs} repair{v.repairs === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-brand-600" /> Warranty status</h3>
          {warranties.length === 0 ? (
            <p className="mt-3 text-sm text-navy-500">Warranties start when a repair is completed.</p>
          ) : (
            <ul className="mt-3 divide-y divide-navy-100 text-sm">
              {warranties.map((r) => (
                <li key={r.repairId} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/track/${r.repairId}?t=${r.token}`} className="font-mono font-medium text-navy-900 hover:text-brand-600">{r.repairId}</Link>
                  <Badge color={r.warranty!.active ? 'green' : 'gray'}>{r.warranty!.active ? `Active until ${date(r.warranty!.expiryDate)}` : `Expired ${date(r.warranty!.expiryDate)}`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-semibold"><FileText className="size-5 text-brand-600" /> Quotes</h3>
          {quotes.length === 0 ? (
            <p className="mt-3 text-sm text-navy-500">No quotations yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-navy-100 text-sm">
              {quotes.map((q) => (
                <li key={q.number} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/track/${q.repairId}?t=${q.token}`} className="hover:text-brand-600">
                    <span className="block font-mono font-medium text-navy-900">{q.number}</span>
                    <span className="text-navy-500">{q.status.replace('_', ' ').toLowerCase()} · sent {date(q.sentAt)}</span>
                  </Link>
                  <span className="shrink-0 font-semibold">{naira(q.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Receipt className="size-5 text-brand-600" /> Invoices & receipts</h3>
          {receipts.length === 0 ? (
            <p className="mt-3 text-sm text-navy-500">No payments yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-navy-100 text-sm">
              {receipts.map((x, i) => (
                <li key={(x.receiptNumber ?? '') + i} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/track/${x.repairId}?t=${x.token}`} className="hover:text-brand-600">
                    <span className="block font-mono font-medium text-navy-900">{x.receiptNumber}</span>
                    <span className="text-navy-500">{x.repairId} · {date(x.paidAt)}</span>
                  </Link>
                  <span className="shrink-0 font-semibold text-emerald-700">{naira(x.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
