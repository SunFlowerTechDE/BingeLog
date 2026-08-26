'use client';

import { useActionState } from 'react';

import { signUp, type FormState } from '@/lib/auth-actions';
import { Field, FormError, Submit } from '@/components/form';

export function SignUpForm() {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="E-Mail" name="email" type="email" autoComplete="email" autoFocus />
      <Field
        label="Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Mindestens acht Zeichen."
      />
      <FormError message={state.error} />
      <Submit>Konto anlegen</Submit>
    </form>
  );
}
