'use client';

import { useActionState } from 'react';

import { requestPasswordReset, type FormState } from '@/lib/auth-actions';
import { ActionNote } from '@/components/action-note';
import { FormError, Submit } from '@/components/form';

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Mailadresse
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="border-border bg-card rounded-md border px-3 py-2"
        />
      </label>

      <FormError message={state.error} />
      <ActionNote message={state.message} />
      <Submit>Link schicken</Submit>
    </form>
  );
}
