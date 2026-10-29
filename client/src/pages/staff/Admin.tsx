import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { date, dateTime, displayPhone, naira } from '../../lib/format';
import { useMe, type Role } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/misc';

type Enquiry = { id: string; type: 'QUOTE' | 'CONTACT'; name: string; phone: string; email: string | null; vehicle: string | null; message: string; handled: boolean; createdAt: string };

export function Enquiries() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['enquiries'], queryFn: () => api.get<Enquiry[]>('/staff/enquiries').then((r) => r.data) });
  const toggle = useMutation({
    mutationFn: (e: Enquiry) => api.patch(`/staff/enquiries/${e.id}`, { handled: !e.handled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">Enquiries</h1>
      <p className="text-navy-500">Quote requests and contact messages from the website.</p>
      {isLoading ? <Spinner /> : !data?.length ? <Card><EmptyState icon={<Inbox className="size-5" />} title="No enquiries yet" /></Card> : (
        <div className="space-y-3">
          {data.map((e) => (
            <Card key={e.id} className={e.handled ? 'p-5 opacity-60' : 'p-5'}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{e.name}</span>
                    <Badge color={e.type === 'QUOTE' ? 'orange' : 'blue'}>{e.type === 'QUOTE' ? 'Quote request' : 'Message'}</Badge>
                  </div>
                  <p className="text-sm text-navy-500">
                    <a href={`tel:+${e.phone}`} className="hover:text-brand-600">{displayPhone(e.phone)}</a>
                    {e.email && <> · <a href={`mailto:${e.email}`} className="hover:text-brand-600">{e.email}</a></>}
                    {e.vehicle && ` · ${e.vehicle}`} · {dateTime(e.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={`https://wa.me/${e.phone}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg bg-[#25D366]/10 px-3 text-sm font-semibold text-emerald-700">WhatsApp</a>
                  <Button size="sm" variant={e.handled ? 'outline' : 'dark'} onClick={() => toggle.mutate(e)}>{e.handled ? 'Reopen' : 'Mark handled'}</Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-navy-700">{e.message}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type Claim = {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  warranty: { expiryDate: string; job: { repairId: string; customer: { fullName: string; phone: string } } };
};

export function Claims() {
  const { data, isLoading } = useQuery({ queryKey: ['claims'], queryFn: () => api.get<Claim[]>('/admin/warranty-claims').then((r) => r.data) });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">Warranty Claims</h1>
      {isLoading ? <Spinner /> : !data?.length ? <Card><EmptyState icon={<ShieldCheck className="size-5" />} title="No warranty claims" /></Card> : (
        <Card className="divide-y divide-navy-50">
          {data.map((c) => (
            <Link key={c.id} to={`/staff/jobs/${c.warranty.job.repairId}`} className="block p-4 hover:bg-navy-50/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><span className="font-mono font-semibold">{c.warranty.job.repairId}</span> · {c.warranty.job.customer.fullName}</span>
                <Badge color={['OPEN', 'IN_REVIEW'].includes(c.status) ? 'amber' : c.status === 'REJECTED' ? 'red' : 'green'}>{c.status.replace('_', ' ')}</Badge>
              </div>
              <p className="mt-1 text-sm text-navy-600">{c.description}</p>
              <p className="mt-1 text-xs text-navy-400">Opened {date(c.createdAt)} · Warranty expires {date(c.warranty.expiryDate)}</p>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

type StaffUser = { id: string; name: string; email: string; phone: string | null; role: Role; active: boolean; createdAt: string };

export function Users() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get<StaffUser[]>('/admin/users').then((r) => r.data) });
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'TECHNICIAN', password: '' });
  const create = useMutation({
    mutationFn: () => api.post('/admin/users', f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setAdding(false);
      setF({ name: '', email: '', phone: '', role: 'TECHNICIAN', password: '' });
    },
  });
  const update = useMutation({
    mutationFn: (v: { id: string } & Partial<StaffUser> & { password?: string }) => api.patch(`/admin/users/${v.id}`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Staff Accounts</h1>
        <Button icon={<UserPlus className="size-4" />} onClick={() => setAdding(!adding)}>Add staff</Button>
      </div>
      {adding && (
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name"><Input className="h-10" value={f.name} onChange={set('name')} /></Field>
            <Field label="Email"><Input className="h-10" type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Phone"><Input className="h-10" value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Role">
              <Select className="h-10" value={f.role} onChange={set('role')}>
                <option value="TECHNICIAN">Technician</option><option value="ADVISOR">Service Advisor</option><option value="ADMIN">Admin / Manager</option>
              </Select>
            </Field>
            <Field label="Temporary password" hint="Min. 8 characters"><Input className="h-10" type="text" value={f.password} onChange={set('password')} /></Field>
          </div>
          {create.isError && <Alert kind="error" className="mt-3">{errorMessage(create.error)}</Alert>}
          <Button className="mt-4" icon={<Plus className="size-4" />} loading={create.isPending} onClick={() => create.mutate()}>Create account</Button>
        </Card>
      )}
      {update.isError && <Alert kind="error">{errorMessage(update.error)}</Alert>}
      {isLoading ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-left text-xs font-semibold tracking-wide text-navy-500 uppercase">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {data?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.name}{u.id === me?.id && <span className="text-navy-400"> (you)</span>}</td>
                  <td className="px-4 py-3 text-navy-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Select className="h-9 w-44 text-sm" value={u.role} disabled={u.id === me?.id} onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })}>
                      <option value="TECHNICIAN">Technician</option><option value="ADVISOR">Service Advisor</option><option value="ADMIN">Admin / Manager</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">{u.active ? <Badge color="green">Active</Badge> : <Badge color="red">Disabled</Badge>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { const pw = prompt(`New password for ${u.name} (min 8 characters)`); if (pw) update.mutate({ id: u.id, password: pw }); }}>Reset password</Button>
                      {u.id !== me?.id && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: u.id, active: !u.active })}>{u.active ? 'Disable' : 'Enable'}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const ROLE_NAMES: Record<Role, string> = { ADMIN: 'Admin', ADVISOR: 'Service advisor', TECHNICIAN: 'Technician' };

type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: Record<string, unknown> | string[] | null;
  createdAt: string;
  user: { name: string; role: Role } | null;
  repairId: string | null;
  subject: string | null;
  technician: string | null;
};

const AUDIT_GROUPS = [
  { key: 'all', label: 'Everything', actions: null },
  { key: 'repairs', label: 'Repairs', actions: ['CHANGE_STAGE', 'UPDATE_JOB_CARD', 'ASSIGN', 'CREATE_QUOTE', 'SEND_QUOTE', 'UPDATE_WARRANTY', 'UPDATE_CLAIM'] },
  { key: 'money', label: 'Payments', actions: ['RECORD_PAYMENT'] },
  { key: 'people', label: 'Staff & sign-ins', actions: ['LOGIN', 'CHANGE_PASSWORD', 'CREATE_USER', 'UPDATE_USER'] },
  { key: 'site', label: 'Website & settings', actions: ['UPDATE_SETTINGS', 'UPDATE_WEBSITE_PHOTOS', 'UPLOAD_WEBSITE_PHOTO', 'DELETE_WEBSITE_PHOTO'] },
] as const;

const FIELD_NAMES: Record<string, string> = {
  componentCondition: 'condition on arrival',
  faultFound: 'fault found',
  diagnosis: 'diagnosis',
  partsRequired: 'parts required',
  repairProcedure: 'repair procedure',
  technicianNotes: 'technician notes',
  testResults: 'test results',
  qcResult: 'quality check',
  position: 'position',
  estimatedCompletion: 'estimated completion',
};

const pretty = (v: unknown) => (typeof v === 'string' ? v.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : String(v));

/** One plain-English sentence per staff action. */
function describe(a: AuditEntry): { text: string; tone: 'blue' | 'green' | 'gray' | 'amber' } {
  const d = (Array.isArray(a.details) ? {} : (a.details ?? {})) as Record<string, unknown>;
  const job = a.repairId ?? 'a repair';
  switch (a.action) {
    case 'CHANGE_STAGE':
      return d.from === d.to
        ? { text: `added an update to ${job} (still "${pretty(d.to)}")`, tone: 'blue' }
        : { text: `moved ${job} from "${pretty(d.from)}" to "${pretty(d.to)}"`, tone: 'blue' };
    case 'UPDATE_JOB_CARD': {
      const fields = Array.isArray(a.details) ? a.details.map((f) => FIELD_NAMES[f] ?? f).join(', ') : 'details';
      return { text: `updated the job card for ${job}: ${fields}`, tone: 'blue' };
    }
    case 'ASSIGN':
      return { text: a.technician ? `assigned ${job} to ${a.technician}` : `removed the technician from ${job}`, tone: 'blue' };
    case 'CREATE_QUOTE':
      return { text: `prepared quotation ${a.subject ?? ''} for ${job}${typeof d.total === 'number' ? ` (${naira(d.total)})` : ''}`, tone: 'amber' };
    case 'SEND_QUOTE':
      return { text: `sent quotation ${a.subject ?? ''} to the customer (${job})`, tone: 'amber' };
    case 'RECORD_PAYMENT':
      return {
        text: `recorded a ${pretty(d.method ?? 'manual').toLowerCase()} payment${typeof d.amount === 'number' ? ` of ${naira(d.amount)}` : ''} for ${job}${a.subject ? ` (receipt ${a.subject})` : ''}`,
        tone: 'green',
      };
    case 'UPDATE_WARRANTY':
      return { text: `changed the warranty on ${job}`, tone: 'amber' };
    case 'UPDATE_CLAIM':
      return { text: `updated a warranty claim on ${job}${d.status ? `: ${pretty(d.status)}` : ''}`, tone: 'amber' };
    case 'LOGIN':
      return { text: 'signed in to the staff area', tone: 'gray' };
    case 'CHANGE_PASSWORD':
      return { text: 'changed their own password', tone: 'gray' };
    case 'CREATE_USER':
      return { text: `created a staff account for ${a.subject ?? 'a new member'}${d.role ? ` (${pretty(d.role)})` : ''}`, tone: 'gray' };
    case 'UPDATE_USER': {
      const bits = [d.passwordChanged ? 'reset the password' : null, d.role ? `role set to ${pretty(d.role)}` : null, d.active === false ? 'deactivated' : d.active === true ? 'activated' : null].filter(Boolean);
      return { text: `changed ${a.subject ?? 'a staff account'}${bits.length ? `: ${bits.join(', ')}` : ''}`, tone: 'gray' };
    }
    case 'UPDATE_SETTINGS':
      return { text: 'changed the business settings (contact details, warranty, deposit)', tone: 'gray' };
    case 'UPDATE_WEBSITE_PHOTOS':
      return { text: 'changed the photos shown on the website', tone: 'gray' };
    case 'UPLOAD_WEBSITE_PHOTO':
      return { text: 'uploaded a new website photo', tone: 'gray' };
    case 'DELETE_WEBSITE_PHOTO':
      return { text: 'deleted a website photo', tone: 'gray' };
    default:
      return { text: pretty(a.action).toLowerCase(), tone: 'gray' };
  }
}

const TONE_DOT = { blue: 'bg-brand-500', green: 'bg-emerald-500', amber: 'bg-amber-500', gray: 'bg-navy-300' };

export function Audit() {
  const { data, isLoading } = useQuery({ queryKey: ['audit'], queryFn: () => api.get<AuditEntry[]>('/admin/audit').then((r) => r.data), refetchInterval: 30_000 });
  const [group, setGroup] = useState<(typeof AUDIT_GROUPS)[number]['key']>('all');
  const [q, setQ] = useState('');
  const actions = AUDIT_GROUPS.find((x) => x.key === group)!.actions as readonly string[] | null;
  const needle = q.trim().toLowerCase();
  const rows = (data ?? [])
    .map((a) => ({ ...a, ...describe(a) }))
    .filter((a) => !actions || actions.includes(a.action))
    .filter((a) => !needle || `${a.text} ${a.user?.name ?? ''} ${a.repairId ?? ''}`.toLowerCase().includes(needle));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Audit Log</h1>
        <p className="mt-1 max-w-3xl text-navy-500">
          A permanent record of who did what in the staff area: status changes, quotes, payments, sign-ins and settings. Use it to answer questions like
          &ldquo;who marked this repair ready?&rdquo; or &ldquo;who recorded that cash payment?&rdquo;. Entries can&rsquo;t be edited or deleted.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {AUDIT_GROUPS.map((x) => (
            <button
              key={x.key}
              onClick={() => setGroup(x.key)}
              className={
                'rounded-full px-3.5 py-1.5 text-sm font-semibold transition ' +
                (group === x.key ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-200 hover:ring-navy-400')
              }
            >
              {x.label}
            </button>
          ))}
        </div>
        <Input className="h-10 sm:w-64" placeholder="Search name or Repair ID" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox className="size-5" />} title="Nothing here yet">
            Staff actions will appear here as they happen.
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-navy-50">
          {rows.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <span className={'mt-1.5 size-2.5 shrink-0 rounded-full ' + TONE_DOT[a.tone]} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-navy-900">
                  <span className="font-semibold">{a.user?.name ?? 'System'}</span> {a.text}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-navy-400">
                  <span>{dateTime(a.createdAt)}</span>
                  {a.user && <span>{ROLE_NAMES[a.user.role]}</span>}
                  {a.repairId && (
                    <Link to={`/staff/jobs/${a.repairId}`} className="font-semibold text-brand-600 hover:underline">
                      Open {a.repairId} →
                    </Link>
                  )}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
