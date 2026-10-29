import clsx from 'clsx';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from './ui/Button';

/** Normalises what people type ("arc 2026 125", "2026-00125") into ARC-2026-00125. */
export function normalizeRepairId(input: string) {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^(?:ARC)?(\d{4})(\d{1,5})$/);
  if (m) return `ARC-${m[1]}-${m[2].padStart(5, '0')}`;
  return input.trim().toUpperCase();
}

const FIELD =
  'h-12 w-full rounded-md border border-navy-300 bg-white px-4 text-[15px] text-navy-950 placeholder:text-navy-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15 focus:outline-none';

export function TrackForm({ layout = 'inline', initialId = '' }: { layout?: 'inline' | 'stacked'; initialId?: string }) {
  const navigate = useNavigate();
  const [repairId, setRepairId] = useState(initialId);
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const id = normalizeRepairId(repairId);
    if (!/^ARC-\d{4}-\d{5}$/.test(id)) return setError('Enter your Repair ID, e.g. ARC-2026-00125');
    if (contact.trim().length < 5) return setError('Enter the phone number or email you used when booking');
    setError('');
    // Contact goes via router state, not the URL, so it isn't left in browser history.
    navigate(`/track/${id}`, { state: { contact: contact.trim() } });
  }

  const uid = useId();
  const stacked = layout === 'stacked';
  return (
    <form onSubmit={submit} noValidate>
      <div className={clsx('grid gap-4', !stacked && 'sm:grid-cols-2')}>
        <div>
          <label htmlFor={`${uid}-id`} className="mb-1.5 block text-sm font-semibold text-navy-900">
            Repair ID
          </label>
          <input
            id={`${uid}-id`}
            value={repairId}
            onChange={(e) => setRepairId(e.target.value)}
            placeholder="ARC-2026-00125"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={FIELD + ' font-mono tracking-wide'}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-contact`} className="mb-1.5 block text-sm font-semibold text-navy-900">
            Phone number or email
          </label>
          <input
            id={`${uid}-contact`}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="0803 123 4567"
            inputMode="email"
            autoComplete="tel"
            className={FIELD}
          />
        </div>
        <Button type="submit" size="lg" icon={<Search className="size-4" />} className={stacked ? undefined : 'sm:col-span-2'}>
          Track Repair
        </Button>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </form>
  );
}
