import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const control =
  'block w-full rounded-lg border bg-white px-3.5 text-[15px] text-navy-900 placeholder:text-navy-300 transition focus:outline-none focus:ring-4 disabled:bg-navy-50';
const ok = 'border-navy-200 focus:border-brand-500 focus:ring-brand-500/15';
const bad = 'border-red-400 focus:border-red-500 focus:ring-red-500/15';

type FieldProps = { label?: ReactNode; hint?: ReactNode; error?: string; required?: boolean; className?: string; children: ReactNode; htmlFor?: string };

export function Field({ label, hint, error, required, className, children, htmlFor }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-navy-800">
          {label}
          {required && <span className="ml-0.5 text-brand-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-sm text-navy-400">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={clsx(control, 'h-12', invalid ? bad : ok, className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={clsx(control, 'h-12 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%235f7aa6%22%3E%3Cpath%20d%3D%22M5.3%207.3a1%201%200%20011.4%200L10%2010.6l3.3-3.3a1%201%200%20111.4%201.4l-4%204a1%201%200%2001-1.4%200l-4-4a1%201%200%20010-1.4z%22/%3E%3C/svg%3E")] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10', invalid ? bad : ok, className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return <textarea ref={ref} className={clsx(control, 'min-h-28 py-3', invalid ? bad : ok, className)} {...rest} />;
});

/** Large tappable option used for radio/checkbox choices on mobile. */
export function ChoiceCard({
  checked,
  onClick,
  children,
  description,
  icon,
  type = 'radio',
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  type?: 'radio' | 'checkbox';
}) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={checked}
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition',
        checked ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-navy-200 bg-white hover:border-navy-300',
      )}
    >
      <span
        className={clsx(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 transition',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
          checked ? 'border-brand-500 bg-brand-500' : 'border-navy-300',
        )}
      >
        {checked && (type === 'radio' ? <span className="size-2 rounded-full bg-white" /> : <svg viewBox="0 0 12 12" className="size-3 text-white"><path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>)}
      </span>
      {icon && <span className="text-navy-500">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-navy-900">{children}</span>
        {description && <span className="mt-0.5 block text-sm text-navy-500">{description}</span>}
      </span>
    </button>
  );
}
