'use client';

import { useActionState, useState } from 'react';

import { RatingInput } from '@/components/rating-input';
import { rateFilm, saveEntry, deleteEntry, type EntryResult } from '@/lib/diary-actions';
import { ActionNote } from '@/components/action-note';
import { FACET_KINDS, FACET_LABELS_DE } from '@binge-log/db';

export interface OwnEntry {
  id: string;
  rating: number | null;
  watched_on: string | null;
  review: string | null;
  is_rewatch: boolean;
  is_private: boolean;
}

/**
 * M3 3.4 and 3.4b — rating and logging a film.
 *
 * The star row is the whole feature for most visits: one tap saves. The
 * form below it is folded away and stays that way unless someone opens
 * it, because every extra required tap costs logging frequency, which is
 * the app's most important retention number (ADR-009, 02-product.md).
 *
 * The seven facets live inside that fold, one level deeper still.
 */
export function LogPanel({
  filmId,
  entry,
  ownFacets,
}: {
  filmId: string;
  entry: OwnEntry | null;
  ownFacets: Partial<Record<string, number>>;
}) {
  const [open, setOpen] = useState(false);
  const [facetsOpen, setFacetsOpen] = useState(
    Object.keys(ownFacets).length > 0,
  );
  const [state, action] = useActionState<EntryResult, FormData>(saveEntry, {});
  // Tapping a popcorn and deleting an entry both go straight to the
  // server without a form, so their answer needs somewhere to land.
  const [problem, setProblem] = useState<string | undefined>(undefined);

  return (
    <section className="border-border flex flex-col gap-3 border-t pt-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-muted-foreground text-xs">Deine Bewertung</span>
        <RatingInput
          value={entry?.rating ?? null}
          onSelect={async (rating) => {
            setProblem(undefined);
            const result = await rateFilm(filmId, rating);
            setProblem(result.error);
            return result;
          }}
        />
      </div>

      <ActionNote message={problem} />

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
          }}
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {open ? 'Details zuklappen' : 'Details eintragen'}
        </button>

        {entry ? (
          <form
            action={async () => {
              setProblem(undefined);
              const result = await deleteEntry(entry.id, filmId);
              setProblem(result.error);
            }}
          >
            <button
              type="submit"
              className="text-muted-foreground hover:text-destructive underline underline-offset-4"
            >
              Eintrag löschen
            </button>
          </form>
        ) : null}
      </div>

      {open ? (
        <form action={action} className="flex max-w-lg flex-col gap-4 pt-1">
          <input type="hidden" name="filmId" value={filmId} />
          {entry ? <input type="hidden" name="entryId" value={entry.id} /> : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Bewertung</span>
            <RatingInput value={entry?.rating ?? null} size={26} />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Gesehen am</span>
            <input
              type="date"
              name="watchedOn"
              defaultValue={entry?.watched_on ?? ''}
              className="border-border bg-card focus:ring-ring w-48 rounded-md border px-3 py-2
                         text-base outline-none focus:ring-2"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Notiz</span>
            <textarea
              name="review"
              rows={4}
              defaultValue={entry?.review ?? ''}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2
                         text-base outline-none focus:ring-2"
            />
          </label>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isRewatch" defaultChecked={entry?.is_rewatch} />
              Wiedersehen
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPrivate" defaultChecked={entry?.is_private} />
              Nur für mich
            </label>
          </div>

          <div className="border-border flex flex-col gap-3 border-t pt-4">
            <button
              type="button"
              onClick={() => {
                setFacetsOpen(!facetsOpen);
              }}
              aria-expanded={facetsOpen}
              className="text-muted-foreground hover:text-foreground self-start text-sm
                         underline underline-offset-4"
            >
              {facetsOpen ? 'Detailliert bewerten zuklappen' : 'Detailliert bewerten'}
            </button>

            {facetsOpen ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-muted-foreground text-xs">
                  Alles freiwillig. Was du auslässt, bleibt leer.
                </p>
                {FACET_KINDS.map((facet) => (
                  <div key={facet} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{FACET_LABELS_DE[facet]}</span>
                    <RatingInput
                      name={`facet.${facet}`}
                      value={ownFacets[facet] ?? null}
                      size={20}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <ActionNote message={state.error} />

          <button
            type="submit"
            className="bg-primary text-primary-foreground self-start rounded-md px-4 py-2
                       text-sm font-semibold"
          >
            Speichern
          </button>
        </form>
      ) : null}
    </section>
  );
}
