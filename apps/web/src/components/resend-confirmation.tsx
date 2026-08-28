'use client';

import { useActionState } from 'react';

import { resendConfirmation } from '@/lib/auth-actions';
import { ActionNote } from '@/components/action-note';

/**
 * Die Bestaetigungsmail noch einmal anfordern.
 *
 * Die erste laeuft ab, geht verloren oder kommt an, waehrend die Seite,
 * auf die sie zeigt, nicht erreichbar ist. Ohne diesen Weg bleibt nur
 * ein zweites Konto — und die alte Adresse ist dann dauerhaft blockiert.
 *
 * Die Adresse steht im Feld, wenn sie aus der Registrierung mitkam, und
 * ist dennoch aenderbar: wer sich vertippt hat, sieht die Mail sonst nie
 * und kann hier auch nichts richten.
 */
export function ResendConfirmation({ email }: { email?: string | undefined }) {
  const [state, action, pending] = useActionState(resendConfirmation, {});

  return (
    <form action={action} className="border-border flex flex-col gap-3 border-t pt-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-sm">Nichts angekommen?</span>
        <input
          type="email"
          name="email"
          required
          defaultValue={email ?? ''}
          autoComplete="email"
          placeholder="deine@adresse.de"
          className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="border-border hover:bg-card self-start rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
      >
        {pending ? 'Wird gesendet' : 'Mail erneut senden'}
      </button>

      <ActionNote message={state.error} />
      <ActionNote message={state.message} tone="info" />
    </form>
  );
}
