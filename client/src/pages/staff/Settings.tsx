import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { COMPONENTS, setBusiness } from '../../lib/constants';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { Alert, Card, Spinner } from '../../components/ui/misc';

type Settings = {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  mapsUrl: string;
  warrantyMonths: number;
  warrantyTerms: string;
  depositPercent: number;
  alertEmails: string[];
  warrantyByComponent: Partial<Record<string, number>>;
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/admin/settings').then((r) => r.data) });
  const [f, setF] = useState<Settings | null>(null);
  const [alertDraft, setAlertDraft] = useState('');
  useEffect(() => {
    if (data) {
      setF(data);
      setAlertDraft((data.alertEmails ?? []).join(', '));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (v: Settings) => api.put<Settings>('/admin/settings', v).then((r) => r.data),
    onSuccess: async (saved) => {
      qc.setQueryData(['settings'], saved);
      // Refresh the live details used by the website in this browser too.
      const meta = await api.get('/meta').then((r) => r.data);
      setBusiness(meta.workshop);
    },
  });

  if (isLoading || !f) return <Spinner />;
  const errs = fieldErrors(save.error);
  const set = (k: keyof Settings) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value } as Settings);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(f);
  };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Business Settings</h1>
        <p className="text-navy-500">These details appear on the website, in customer messages, receipts and new warranties.</p>
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="font-bold">Contact details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business name" required error={errs.name} className="sm:col-span-2">
            <Input value={f.name} onChange={set('name')} invalid={!!errs.name} />
          </Field>
          <Field label="Phone number" required error={errs.phone} hint="Shown on the website and receipts">
            <Input type="tel" value={f.phone} onChange={set('phone')} invalid={!!errs.phone} />
          </Field>
          <Field label="WhatsApp number" required error={errs.whatsapp} hint="Used for the WhatsApp buttons">
            <Input type="tel" value={f.whatsapp} onChange={set('whatsapp')} invalid={!!errs.whatsapp} />
          </Field>
          <Field label="Email" error={errs.email} className="sm:col-span-2" hint="Shown on the website. Customer replies to our emails come here">
            <Input type="email" value={f.email} onChange={set('email')} placeholder="info@airride.ng" invalid={!!errs.email} />
          </Field>
          <Field
            label="Also send staff alerts to"
            error={Object.entries(errs).find(([k]) => k.startsWith('alertEmails'))?.[1]}
            className="sm:col-span-2"
            hint="New bookings, quote replies and warranty claims. Separate emails with commas. Admin and advisor accounts always get them too"
          >
            <Input
              value={alertDraft}
              onChange={(e) => {
                setAlertDraft(e.target.value);
                setF({ ...f, alertEmails: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) });
              }}
              placeholder="owner@gmail.com, manager@gmail.com"
            />
          </Field>
          <Field label="Workshop address" error={errs.address} className="sm:col-span-2" hint="Customers see this when they choose to drop off their part">
            <Textarea rows={2} className="min-h-0" value={f.address} onChange={set('address')} />
          </Field>
          <Field label="Opening hours" error={errs.hours}>
            <Input value={f.hours} onChange={set('hours')} placeholder="Mon – Sat, 8:00am – 6:00pm" />
          </Field>
          <Field label="Google Maps link" error={errs.mapsUrl} hint="Optional. Paste the share link from Google Maps">
            <Input value={f.mapsUrl} onChange={set('mapsUrl')} placeholder="https://maps.app.goo.gl/…" invalid={!!errs.mapsUrl} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="font-bold">Repairs & payments</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Warranty period (months)" error={errs.warrantyMonths} hint="Applied to repairs completed from now on">
            <Input inputMode="numeric" value={String(f.warrantyMonths)} onChange={(e) => setF({ ...f, warrantyMonths: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
          </Field>
          <Field label="Default deposit (%)" error={errs.depositPercent} hint="Pre-filled on new quotations. 0 = full payment">
            <Input inputMode="numeric" value={String(f.depositPercent)} onChange={(e) => setF({ ...f, depositPercent: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) })} />
          </Field>
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-navy-800">Warranty by repair type (months)</p>
            <p className="mt-0.5 text-sm text-navy-400">Leave blank to use the default period above.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COMPONENTS.map((c) => (
                <label key={c.value} className="block">
                  <span className="mb-1 block text-[13px] text-navy-600">{c.label}</span>
                  <Input
                    className="h-10"
                    inputMode="numeric"
                    placeholder={String(f.warrantyMonths)}
                    value={f.warrantyByComponent?.[c.value] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      const next = { ...(f.warrantyByComponent ?? {}) };
                      if (v === '') delete next[c.value];
                      else next[c.value] = Math.min(60, Number(v));
                      setF({ ...f, warrantyByComponent: next });
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
          <Field label="Warranty terms" error={errs.warrantyTerms} className="sm:col-span-2">
            <Textarea rows={5} value={f.warrantyTerms} onChange={set('warrantyTerms')} />
          </Field>
        </div>
      </Card>

      {save.isError && <Alert kind="error">{errorMessage(save.error)}</Alert>}
      {save.isSuccess && <Alert kind="success">Saved. The website now shows these details.</Alert>}
      <Button type="submit" size="lg" loading={save.isPending} icon={<Save className="size-4" />}>
        Save settings
      </Button>
    </form>
  );
}
