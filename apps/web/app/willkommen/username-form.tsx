'use client';

import { useActionState } from 'react';

import { chooseUsername, type FormState } from '@/lib/auth-actions';
import { Field, FormError, Submit } from '@/components/form';

export function UsernameForm() {
  const [state, action] = useActionState<FormState, FormData>(chooseUsername, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Name"
        name="username"
        autoComplete="username"
        autoFocus
        hint="Drei bis zwanzig Zeichen. Kleinbuchstaben, Ziffern und Unterstrich."
      />
      <FormError message={state.error} />
      <Submit>Weiter</Submit>
    </form>
  );
}
