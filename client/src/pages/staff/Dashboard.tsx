import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Banknote, CheckCircle2, Clock, FileText, Inbox, PackageCheck, Package, ShieldAlert, Timer, Wrench, XCircle, FlaskConical, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { isOffice, useMe } from '../../lib/auth';
import { COMPONENT_LABELS, type Stage } from '../../lib/constants';
import { dateTime, naira } from '../../lib/format';
import { Card, Spinner } from '../../components/ui/misc';
import { LinkButton } from '../../components/ui/Button';

type Stats = {
  totalRepairs: number;
  inProgress: number;
  completed: number;
  newRequests: number;
  revenue: number;
  revenueThisMonth: number;
  pendingPayments: number;
  pendingPaymentJobs: number;
  quotesAwaitingApproval: number;
  openWarrantyClaims: number;
  avgRepairDays: number | null;
  recentPayments: { amount: number; paidAt: string; channel: string; receiptNumber: string; repairId: string; customer: string }[];
  byComponent: { component: string; count: number }[];
};

/** Workshop queues from the spec's technician dashboard. */
const QUEUES: { label: string; stages: Stage[]; icon: typeof Inbox; tone: string }[] = [
  { label: 'New repair requests', stages: ['REQUEST_SUBMITTED'], icon: Inbox, tone: 'bg-sky-50 text-sky-600' },
  { label: 'Components awaiting receipt', stages: ['AWAITING_COMPONENT'], icon: Package, tone: 'bg-sky-50 text-sky-600' },
  { label: 'Jobs awaiting diagnosis', stages: ['RECEIVED', 'INSPECTION', 'DIAGNOSIS'], icon: Search, tone: 'bg-violet-50 text-violet-600' },
  { label: 'Quotes awaiting approval', stages: ['QUOTE_SENT', 'AWAITING_APPROVAL'], icon: FileText, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Repairs in progress', stages: ['PARTS_SOURCING', 'REPAIR_IN_PROGRESS'], icon: Wrench, tone: 'bg-brand-50 text-brand-600' },
  { label: 'Jobs under testing', stages: ['TESTING', 'QUALITY_CONTROL'], icon: FlaskConical, tone: 'bg-brand-50 text-brand-600' },
  { label: 'Ready for collection', stages: ['READY_FOR_COLLECTION', 'DISPATCHED'], icon: PackageCheck, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Completed jobs', stages: ['DELIVERED', 'COMPLETED'], icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Cancelled jobs', stages: ['CANCELLED'], icon: XCircle, tone: 'bg-red-50 text-red-500' },
];

function Stat({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: typeof Inbox }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-navy-500">{label}</p>
        <Icon className="size-5 text-navy-300" />
      </div>
      <p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-navy-400">{sub}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { data: me } = useMe();
  const office = isOffice(me);
  const counts = useQuery({ queryKey: ['counts'], queryFn: () => api.get<Record<Stage, number>>('/staff/jobs/counts').then((r) => r.data), refetchInterval: 30_000 });
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.get<Stats>('/admin/stats').then((r) => r.data), enabled: office, refetchInterval: 60_000 });

  const s = stats.data;
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {me?.name.split(' ')[0]}</h1>
          <p className="text-navy-500">{me?.role === 'TECHNICIAN' ? 'Your assigned jobs and open requests.' : "Here's what's happening in the workshop."}</p>
        </div>
        <LinkButton to="/staff/jobs" variant="dark">All jobs <ArrowRight className="size-4" /></LinkButton>
      </div>

      {office && (s ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Total repairs" value={s.totalRepairs} sub={`${s.newRequests} new request${s.newRequests === 1 ? '' : 's'}`} icon={Wrench} />
          <Stat label="In progress" value={s.inProgress} sub={`${s.completed} completed`} icon={Clock} />
          <Stat label="Revenue this month" value={naira(s.revenueThisMonth)} sub={`${naira(s.revenue)} all time`} icon={Banknote} />
          <Stat label="Pending payments" value={naira(s.pendingPayments)} sub={`${s.pendingPaymentJobs} job${s.pendingPaymentJobs === 1 ? '' : 's'}`} icon={Banknote} />
          <Stat label="Quotes awaiting approval" value={s.quotesAwaitingApproval} icon={FileText} />
          <Stat label="Open warranty claims" value={s.openWarrantyClaims} icon={ShieldAlert} />
          <Stat label="Avg. repair time" value={s.avgRepairDays == null ? '—' : `${s.avgRepairDays} days`} sub="Received → completed" icon={Timer} />
          <Stat label="Completed repairs" value={s.completed} icon={CheckCircle2} />
        </div>
      ) : <Spinner />)}

      <section>
        <h2 className="text-lg font-bold">Workshop queues</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUEUES.map((q) => {
            const n = counts.data ? q.stages.reduce((sum, st) => sum + (counts.data[st] ?? 0), 0) : null;
            return (
              <Link key={q.label} to={`/staff/jobs?stages=${q.stages.join(',')}`} className="group flex items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 shadow-card transition hover:border-brand-300">
                <span className={`flex size-11 items-center justify-center rounded-lg ${q.tone}`}><q.icon className="size-5" /></span>
                <span className="flex-1 font-medium text-navy-700">{q.label}</span>
                <span className="font-display text-2xl font-bold">{n ?? '…'}</span>
                <ArrowRight className="size-4 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            );
          })}
        </div>
      </section>

      {office && s && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold">Recent payments</h2>
            {s.recentPayments.length === 0 ? <p className="mt-4 text-sm text-navy-400">No payments yet.</p> : (
              <ul className="mt-3 divide-y divide-navy-50">
                {s.recentPayments.map((p) => (
                  <li key={p.receiptNumber} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Link to={`/staff/jobs/${p.repairId}`} className="font-mono font-semibold text-navy-900 hover:text-brand-600">{p.repairId}</Link>
                      <span className="block truncate text-navy-400">{p.customer} · {dateTime(p.paidAt)} · {p.channel}</span>
                    </span>
                    <span className="font-semibold text-emerald-700">{naira(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-bold">Repairs by component</h2>
            <ul className="mt-3 divide-y divide-navy-50">
              {[...s.byComponent].sort((a, b) => b.count - a.count).map((c) => (
                <li key={c.component} className="flex justify-between py-2.5 text-sm">
                  <span className="text-navy-700">{COMPONENT_LABELS[c.component]}</span>
                  <span className="font-semibold">{c.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
