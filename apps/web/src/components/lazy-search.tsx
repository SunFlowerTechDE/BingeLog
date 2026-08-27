'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { fetchMissingFilm, type CreatedFilm } from '@/lib/search-actions';
import { ActionNote } from '@/components/action-note';
import { CardBuild, type BuildPhase } from '@/components/card-build';
import { FilmTile, type TileFilm } from '@/components/film-tile';

/**
 * Offered when a search finds nothing, and the small ceremony that
 * follows.
 *
 * A button rather than an automatic lookup. Every typo would otherwise
 * become a query against Wikidata, which is a donated service, and a
 * mistyped title can still match something — writing an unrelated film
 * into the catalog because someone slipped is worse than one more tap on
 * a path that is rare by definition.
 *
 * The card is then built in the open. It takes a few seconds either way
 * while Wikidata answers, and showing the work turns waiting into
 * watching something you caused.
 *
 * It owns the result list too, rather than being rendered only when that
 * list is empty. Every server action makes Next render the route again,
 * so the moment the film existed this component was replaced by the
 * grid — and the overlay went with it, before it had shown anything.
 */
export function LazySearch({ term, films }: { term: string; films: TileFilm[] }) {
  const router = useRouter();
  const [note, setNote] = useState<string | undefined>(undefined);
  const [building, setBuilding] = useState<CreatedFilm | null>(null);
  // The backdrop is the first and last beat of the ceremony, so it is
  // driven by the same clock as the card rather than being simply on.
  const [phase, setPhase] = useState<BuildPhase | null>(null);
  const [pending, startTransition] = useTransition();

  const finish = useCallback(() => {
    setBuilding(null);
    setPhase(null);
    // The catalog changed underneath the result list that is still on
    // screen behind the overlay.
    router.refresh();
  }, [router]);

  // Escape leaves early. The film is already saved by then; the animation
  // is a report, not a step that can be cancelled.
  useEffect(() => {
    if (!building) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [building, finish]);

  // Clear before the first beat and again once the last one starts.
  const dimmed = phase !== null && phase !== 'restore' && phase !== 'done';

  return (
    <div className="flex flex-col items-start gap-3">
      {films.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-6">
          {films.map((film) => (
            <FilmTile key={film.wikidata_id} film={film} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nichts im Katalog. Wenn es den Film bei Wikidata gibt, kannst du ihn hier anlegen — danach
          steht er für alle bereit.
        </p>
      )}

      {films.length === 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setNote(undefined);
            startTransition(async () => {
              const result = await fetchMissingFilm(term);
              if (result.error ?? !result.films?.length) {
                setNote(result.error ?? 'Nichts gefunden.');
                return;
              }
              // Only the first is built on screen; the rest are in the list
              // once the overlay closes.
              setBuilding(result.films[0] ?? null);
            });
          }}
          className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {pending ? 'Sucht bei Wikidata' : 'Film anlegen'}
        </button>
      ) : null}

      <ActionNote message={note} />

      {building ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Film wird angelegt"
          onClick={finish}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 px-6"
          style={{
            // Two seconds down at the start, two seconds back at the end.
            backgroundColor: dimmed ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0)',
            backdropFilter: dimmed ? 'blur(14px)' : 'blur(0px)',
            WebkitBackdropFilter: dimmed ? 'blur(14px)' : 'blur(0px)',
            transition:
              'background-color 2000ms ease-in-out, backdrop-filter 2000ms ease-in-out,' +
              ' -webkit-backdrop-filter 2000ms ease-in-out',
          }}
        >
          <p
            className="text-center text-lg font-semibold tracking-tight"
            style={{
              opacity: phase && phase !== 'dim' ? 1 : 0,
              transition: 'opacity 700ms ease-out',
            }}
          >
            {building.title}
            {building.releaseYear ? (
              <span className="text-muted-foreground font-normal"> ({building.releaseYear})</span>
            ) : null}
          </p>

          <CardBuild
            film={{
              wikidataId: building.wikidataId,
              title: building.title,
              releaseYear: building.releaseYear,
              director: building.director,
            }}
            posterUrl={building.posterUrl}
            onPhase={setPhase}
            onDone={finish}
          />
        </div>
      ) : null}
    </div>
  );
}
