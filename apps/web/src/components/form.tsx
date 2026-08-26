'use client';

import { useFormStatus } from 'react-dom';

/**
 * The few form primitives the auth pages share. Kept deliberately plain:
 * the type carries the brand (02-product.md), not the controls.
 */

export function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  hint,
  defaultValue,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base
                   outline-none focus:ring-2"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground mt-1 rounded-md px-4 py-2.5 text-sm
                 font-semibold disabled:opacity-60"
    >
      {pending ? 'Einen Moment' : children}
    </button>
  );
}

export function FormError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}
