'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createList } from '@/lib/list-actions';
import { ActionNote } from '@/components/action-note';

/**
 * Eine neue Binge-Liste anlegen.
 *
 * Das Formular liegt eingeklappt hinter einem Knopf. Aufgeklappt neben
 * den bestehenden Listen zu stehen hiesse, jedem Besuch der eigenen
 * Uebersicht eine leere Aufgabe hinzulegen.
 */
export function ListCreateForm() {
  const [state, action, laeuft] = useActionState(createList, {});
  const [offen, setOffen] = useState(false);
  const router = useRouter();

  // Angelegt heisst: hinein. Eine leere Liste in der Uebersicht bringt
  // niemanden weiter, der gerade eine anlegen wollte.
  useEffect(() => {
    if (state.id) router.push(`/listen/${state.id}`);
  }, [state.id, router]);

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => {
          setOffen(true);
        }}
        className="bg-primary text-primary-foreground self-start rounded-md px-4 py-2 text-sm font-semibold"
      >
        Neue Liste
      </button>
    );
  }

  return (
    <form
      action={action}
      className="border-border bg-card/40 flex flex-col gap-4 rounded-lg border p-5"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          type="text"
          name="title"
          maxLength={80}
          required
          placeholder="Filme, die im Regen spielen"
          className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Beschreibung</span>
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
        />
        <span className="text-muted-foreground text-xs">Kann leer bleiben.</span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="isPublic" defaultChecked className="mt-1" />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Öffentlich</span>
          <span className="text-muted-foreground text-xs">
            Andere können die Liste sehen und weitergeben. Ändern kannst nur du sie.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={laeuft}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {laeuft ? 'Wird angelegt' : 'Anlegen'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOffen(false);
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Abbrechen
        </button>
        <ActionNote message={state.error} />
      </div>
    </form>
  );
}
