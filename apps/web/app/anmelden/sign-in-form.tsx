'use client';

import { useActionState } from 'react';

import { signIn, type FormState } from '@/lib/auth-actions';
import { Field, FormError, Submit } from '@/components/form';

export function SignInForm({ weiter }: { weiter: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="weiter" value={weiter} />
      <Field label="E-Mail" name="email" type="email" autoComplete="email" autoFocus />
      <Field label="Passwort" name="password" type="password" autoComplete="current-password" />
      <FormError message={state.error} />
      <Submit>Anmelden</Submit>
    </form>
  );
}
