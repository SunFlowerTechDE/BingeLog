'use client';

import { useState, useTransition } from 'react';

import { logRewatch } from '@/lib/diary-actions';
import { ActionNote } from '@/components/action-note';
import { RatingInput } from '@/components/rating-input';

/**
 * Denselben Film noch einmal eintragen.
 *
 * Bis hierher liess sich zu einem Film genau ein Eintrag anlegen: das
 * Formular kannte die vorhandene Zeile und schrieb sie um. Ein zweites
 * Sehen ueberschrieb damit das erste, statt danebenzustehen — in einem
 * Tagebuch das Gegenteil dessen, was es soll (M3 3.4).
 *
 * Der Weg ist bewusst schmal: aufklappen, Bewertung geben, fertig.
 * Datum, Notiz und Sichtbarkeit gehoeren dann dem neuen Eintrag und
 * lassen sich dort nachtragen. Das Kennzeichen "Wiedersehen" setzt die
 * Datenbank selbst.
 */
export function RewatchButton({ filmId }: { filmId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="border-border hover:bg-card self-start rounded-md border px-3 py-1.5 text-sm"
        >
          Nochmal gesehen
        </button>
        <ActionNote message={note} tone="info" />
      </div>
    );
  }

  return (
    <div className="border-border flex flex-wrap items-center gap-4 rounded-md border p-4">
      <span className="text-sm font-medium">Wie war es diesmal?</span>

      <RatingInput
        value={null}
        size={24}
        onSelect={async (rating) => {
          if (rating === 0) return {};
          const result = await new Promise<{ error?: string }>((resolve) => {
            startTransition(async () => {
              resolve(await logRewatch(filmId, rating));
            });
          });
          if (!result.error) {
            setOpen(false);
            setNote('Als Wiedersehen eingetragen');
          }
          return result;
        }}
      />

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setOpen(false);
        }}
        className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
      >
        Abbrechen
      </button>
    </div>
  );
}
