'use client';

import { useActionState, useState } from 'react';

import { deleteOwnAccount, type DeleteResult } from '@/lib/account-actions';
import { FormError } from '@/components/form';

/**
 * „Konto löschen" in den Einstellungen (Art. 17 DSGVO).
 *
 * Zwei Hürden, und beide mit Absicht: erst aufklappen, dann den eigenen
 * Namen abtippen. Das ist der einzige Schritt in der App, den niemand
 * rückgängig machen kann — ein Knopf allein wäre zu wenig.
 */
export function DeleteAccount({ username }: { username: string }) {
  const [offen, setOffen] = useState(false);
  const [state, action, pending] = useActionState<DeleteResult, FormData>(deleteOwnAccount, {});

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => {
          setOffen(true);
        }}
        className="text-destructive hover:bg-card self-start rounded-md border border-transparent px-3 py-1.5 text-sm"
      >
        Konto löschen
      </button>
    );
  }

  return (
    <form
      action={action}
      className="border-destructive/40 flex flex-col gap-3 rounded-md border p-4"
    >
      <p className="text-sm font-medium">Konto endgültig löschen</p>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Dein Tagebuch, deine Bewertungen, Rezensionen, Listen, Bilder und Beiträge werden gelöscht
        und lassen sich nicht wiederherstellen. Stehen bleiben nur Meldungen und
        Moderationsentscheidungen — ohne deinen Namen daran.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm">
          Tipp zur Bestätigung <strong>{username}</strong> ein.
        </span>
        <input
          name="bestaetigung"
          autoComplete="off"
          autoFocus
          className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
        />
      </label>

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-destructive rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Löscht' : 'Endgültig löschen'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOffen(false);
          }}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
