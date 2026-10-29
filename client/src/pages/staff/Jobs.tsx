import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ClipboardList, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { COMPONENT_LABELS, STAGE_LABELS, STAGE_ORDER, type Stage } from '../../lib/constants';
import { displayPhone, timeAgo } from '../../lib/format';
import { Card, EmptyState, Spinner, StageBadge } from '../../components/ui/misc';
import { Select } from '../../components/ui/Field';

type JobRow = {
  id: string;
  repairId: string;
  stage: Stage;
  component: string;
  componentOther: string | null;
  position: string | null;
  updatedAt: string;
  paymentStatus: string;
  customer: { fullName: string; phone: string };
  vehicle: { make: string; model: string; year: number | null; registration: string | null };
  technician: { id: string; name: string } | null;
};

const BUCKETS = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const stages = params.get('stages') ?? '';
  const bucket = params.get('bucket') ?? 'active';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(q);

  // Debounced search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      if (search === q) return;
      const p = new URLSearchParams(params);
      if (search) p.set('q', search);
      else p.delete('q');
      p.delete('page');
      setParams(p, { replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [search, q, params, setParams]);

  const update = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k !== 'page') p.delete('page');
    setParams(p);
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['jobs', stages, bucket, q, page],
    queryFn: () => api.get<{ total: number; pageSize: number; jobs: JobRow[] }>('/staff/jobs', { params: { stages: stages || undefined, bucket, q: q || undefined, page } }).then((r) => r.data),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const stageList = stages ? (stages.split(',') as Stage[]) : [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">Repair Jobs</h1>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-navy-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Repair ID, customer, phone, vehicle, reg. no., VIN, component…"
            className="h-11 w-full rounded-lg border border-navy-200 bg-white pr-9 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
          />
          {search && <button onClick={() => setSearch('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-400" aria-label="Clear"><X className="size-4" /></button>}
        </label>
        <div className="flex gap-2">
          {stageList.length === 0 && (
            <div className="flex rounded-lg bg-white p-1 ring-1 ring-navy-200">
              {BUCKETS.map((b) => (
                <button key={b.key} onClick={() => update('bucket', b.key === 'active' ? null : b.key)} className={clsx('rounded-md px-3 py-1.5 text-sm font-semibold', bucket === b.key ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50')}>
                  {b.label}
                </button>
              ))}
            </div>
          )}
          <Select value={stageList.length === 1 ? stageList[0] : ''} onChange={(e) => update('stages', e.target.value || null)} className="h-11 w-48">
            <option value="">{stageList.length > 1 ? stageList.map((s) => STAGE_LABELS[s]).join(' + ') : 'Any stage'}</option>
            {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </Select>
          {stageList.length > 0 && <button onClick={() => update('stages', null)} className="text-sm font-semibold text-brand-600 whitespace-nowrap">Clear</button>}
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? <Spinner /> : !data?.jobs.length ? (
          <EmptyState icon={<ClipboardList className="size-5" />} title="No jobs found">Try a different search or filter.</EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <table className={clsx('hidden w-full text-sm md:table', isFetching && 'opacity-70')}>
              <thead className="border-b border-navy-100 bg-navy-50/60 text-left text-xs font-semibold tracking-wide text-navy-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Repair ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vehicle / Component</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {data.jobs.map((j) => (
                  <tr key={j.id} onClick={() => navigate(`/staff/jobs/${j.repairId}`)} className="cursor-pointer hover:bg-brand-50/40">
                    <td className="px-4 py-3"><Link to={`/staff/jobs/${j.repairId}`} className="font-mono font-semibold text-navy-900" onClick={(e) => e.stopPropagation()}>{j.repairId}</Link></td>
                    <td className="px-4 py-3"><span className="font-medium">{j.customer.fullName}</span><span className="block text-navy-400">{displayPhone(j.customer.phone)}</span></td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{[j.vehicle.year, j.vehicle.make, j.vehicle.model].filter(Boolean).join(' ')}</span>
                      <span className="block text-navy-400">{j.component === 'OTHER' ? j.componentOther : COMPONENT_LABELS[j.component]}{j.position ? ` · ${j.position}` : ''}{j.vehicle.registration ? ` · ${j.vehicle.registration}` : ''}</span>
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={j.stage} /></td>
                    <td className="px-4 py-3 text-navy-600">{j.technician?.name ?? <span className="text-navy-300">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-right text-navy-400">{timeAgo(j.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile cards */}
            <ul className="divide-y divide-navy-50 md:hidden">
              {data.jobs.map((j) => (
                <li key={j.id}>
                  <Link to={`/staff/jobs/${j.repairId}`} className="block p-4 active:bg-navy-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{j.repairId}</span>
                      <StageBadge stage={j.stage} />
                    </div>
                    <p className="mt-1 font-medium">{j.customer.fullName}</p>
                    <p className="text-sm text-navy-500">{[j.vehicle.make, j.vehicle.model].join(' ')} · {COMPONENT_LABELS[j.component]}</p>
                    <p className="mt-1 text-xs text-navy-400">{j.technician?.name ?? 'Unassigned'} · {timeAgo(j.updatedAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-navy-500">{data.total} jobs</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => update('page', String(page - 1))} className="rounded-lg p-2 hover:bg-white disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="size-5" /></button>
            <span>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => update('page', String(page + 1))} className="rounded-lg p-2 hover:bg-white disabled:opacity-30" aria-label="Next page"><ChevronRight className="size-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
