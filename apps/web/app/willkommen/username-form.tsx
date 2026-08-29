'use client';

import { useActionState } from 'react';

import { chooseUsername, type FormState } from '@/lib/auth-actions';
import { FormError, Submit } from '@/components/form';
import { UsernameField } from '@/components/username-field';

export function UsernameForm() {
  const [state, action] = useActionState<FormState, FormData>(chooseUsername, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Das Feld schreibt selbst klein und sagt beim Tippen, ob der
          Name frei ist. Vorher konnte man einen aussuchen, abschicken
          und dann lesen, dass es ihn schon gibt. */}
      <UsernameField label="Name" />
      <FormError message={state.error} />
      <Submit>Weiter</Submit>
    </form>
  );
}
