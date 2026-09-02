'use client';

import { useActionState } from 'react';

import { setNewPassword, type FormState } from '@/lib/auth-actions';
import { FormError, Submit } from '@/components/form';

export function NewPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(setNewPassword, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Neues Passwort
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="border-border bg-card rounded-md border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Noch einmal
        <input
          type="password"
          name="repeat"
          required
          minLength={8}
          autoComplete="new-password"
          className="border-border bg-card rounded-md border px-3 py-2"
        />
      </label>

      <FormError message={state.error} />
      <Submit>Passwort speichern</Submit>
    </form>
  );
}
