'use client';

import { useActionState, useEffect, useState } from 'react';

import { RatingInput } from '@/components/rating-input';
import {
  rateFilm,
  saveEntry,
  deleteEntry,
  unrateFilm,
  type EntryResult,
} from '@/lib/diary-actions';
import { ActionNote } from '@/components/action-note';
import { FACET_KINDS, FACET_LABELS_DE } from '@binge-log/db';

export type Visibility = 'public' | 'friends' | 'private';

/**
 * Die drei Stufen samt dem, was sie bewirken.
 *
 * "Nur fuer Freunde" verlangt beidseitiges Folgen. Solange das Folgen
 * selbst noch nicht gebaut ist (M4), ist niemand Freund und die Stufe
 * wirkt wie "Nur fuer mich" — sie faellt zu, nicht auf. Der Hinweis sagt
 * das, statt eine Zusicherung zu geben, die noch niemand einloest.
 */
const VISIBILITIES: readonly { value: Visibility; label: string; hint: string }[] = [
  {
    value: 'public',
    label: 'Öffentlich',
    hint: 'Alle sehen den Eintrag. Deine Bewertung zählt zum Schnitt des Films.',
  },
  {
    value: 'friends',
    label: 'Nur für Freunde',
    hint:
      'Nur wer dir folgt und dem du zurückfolgst. Deine Bewertung zählt zum Schnitt' +
      ' des Films. Solange du niemandem folgst, sieht es niemand.',
  },
  {
    value: 'private',
    label: 'Nur für mich',
    hint: 'Niemand sonst sieht den Eintrag, und deine Bewertung zählt nicht zum Schnitt.',
  },
];

export interface OwnEntry {
  id: string;
  rating: number | null;
  watched_on: string | null;
  review: string | null;
  is_rewatch: boolean;
  visibility: Visibility;
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
  const [facetsOpen, setFacetsOpen] = useState(Object.keys(ownFacets).length > 0);
  const [state, action] = useActionState<EntryResult, FormData>(saveEntry, {});
  // Tapping a popcorn and deleting an entry both go straight to the
  // server without a form, so their answer needs somewhere to land.
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [visibility, setVisibility] = useState<Visibility>(entry?.visibility ?? 'public');
  // Ohne Eintrag ist heute die haeufigste Antwort: man traegt ein, was
  // man gerade gesehen hat.
  const [today, setToday] = useState(!entry);
  const [confirmation, setConfirmation] = useState<string | undefined>(undefined);

  // A save that changed nothing on screen was indistinguishable from a
  // click that never arrived. Closing the form is the clearest sign that
  // something happened; the note says what.
  useEffect(() => {
    if (!state.saved) return;
    setOpen(false);
    setConfirmation('Gespeichert');
    const timer = setTimeout(() => {
      setConfirmation(undefined);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [state]);

  return (
    <section className="border-border flex flex-col gap-3 border-t pt-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-muted-foreground text-xs">Deine Bewertung</span>
        <RatingInput
          value={entry?.rating ?? null}
          onSelect={async (rating) => {
            setProblem(undefined);
            // Clicking the last popcorn away is how a rating is taken
            // back, so zero means remove the entry rather than store a
            // rating the schema does not allow.
            const result = rating === 0 ? await unrateFilm(filmId) : await rateFilm(filmId, rating);
            setProblem(result.error);
            return result;
          }}
        />
      </div>

      <ActionNote message={problem} />
      <ActionNote message={confirmation} tone="info" />

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

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Gesehen am</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <input
                type="date"
                name="watchedOn"
                defaultValue={entry?.watched_on ?? ''}
                disabled={today}
                aria-label="Datum"
                className="border-border bg-card focus:ring-ring w-48 rounded-md border px-3 py-2 text-base outline-none focus:ring-2 disabled:opacity-40"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="watchedToday"
                  checked={today}
                  onChange={(event) => {
                    setToday(event.target.checked);
                  }}
                />
                Heute gesehen
              </label>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Notiz</span>
            <textarea
              name="review"
              rows={4}
              defaultValue={entry?.review ?? ''}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Wer sieht den Eintrag</legend>
            <div className="border-border flex w-fit overflow-hidden rounded-md border">
              {VISIBILITIES.map((step) => (
                <label
                  key={step.value}
                  className={`border-border cursor-pointer border-r px-3 py-1.5 text-sm last:border-r-0 ${
                    visibility === step.value
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-card'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={step.value}
                    checked={visibility === step.value}
                    onChange={() => {
                      setVisibility(step.value);
                    }}
                    className="sr-only"
                  />
                  {step.label}
                </label>
              ))}
            </div>
            {/* Ein Schalter mit Folgen muss die Folgen nennen. Dass die
                eigene Stimme aus dem Schnitt faellt, stand vorher
                nirgends. */}
            <p aria-live="polite" className="text-muted-foreground text-xs">
              {VISIBILITIES.find((step) => step.value === visibility)?.hint}
            </p>
          </fieldset>

          <div className="border-border flex flex-col gap-3 border-t pt-4">
            <button
              type="button"
              onClick={() => {
                setFacetsOpen(!facetsOpen);
              }}
              aria-expanded={facetsOpen}
              className="text-muted-foreground hover:text-foreground self-start text-sm underline underline-offset-4"
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

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold"
            >
              Speichern
            </button>
            <ActionNote message={state.error} />
          </div>
        </form>
      ) : null}
    </section>
  );
}
