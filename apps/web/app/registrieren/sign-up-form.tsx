'use client';

import Link from 'next/link';
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

      {/* Der Hinweis steht unter dem Knopf und nicht als Häkchen davor:
          ein Häkchen, das man setzen muss, um weiterzukommen, ist keine
          Einwilligung, sondern eine Hürde. Was wir verarbeiten, steht
          im Text — und der ist jetzt ein Link und keine Behauptung
          mehr. */}
      <p className="text-muted-foreground text-xs leading-relaxed">
        Mit dem Anlegen stimmst du den{' '}
        <Link href="/nutzungsbedingungen" className="text-foreground underline underline-offset-4">
          Nutzungsbedingungen
        </Link>{' '}
        und der{' '}
        <Link href="/datenschutz" className="text-foreground underline underline-offset-4">
          Datenschutzerklärung
        </Link>{' '}
        zu. Mindestalter 16 Jahre.
      </p>
    </form>
  );
}
