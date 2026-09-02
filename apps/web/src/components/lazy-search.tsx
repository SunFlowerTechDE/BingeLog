'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import {
  adoptFilm,
  previewMissingFilm,
  type Candidate,
  type CreatedFilm,
} from '@/lib/search-actions';
import { suggestsDroppingTheYear } from '@/lib/search-reasons';
import { ActionNote } from '@/components/action-note';
import { CardBuild, type BuildPhase } from '@/components/card-build';
import { FilmTile, type TileFilm, type TileMark } from '@/components/film-tile';

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
export function LazySearch({
  term,
  films,
  year,
  marks,
}: {
  term: string;
  films: TileFilm[];
  year: number | null;
  marks: Record<string, TileMark>;
}) {
  const router = useRouter();
  const [note, setNote] = useState<string | undefined>(undefined);
  // Was die Vorschau gefunden hat, noch ungeschrieben.
  const [gefunden, setGefunden] = useState<Candidate[] | null>(null);
  const [ohneJahrHilft, setOhneJahrHilft] = useState(false);
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
            <FilmTile key={film.wikidata_id} film={film} mark={marks[film.wikidata_id]} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nichts im Katalog. Wir können nachsehen — gefundene Filme siehst du erst und entscheidest
          dann.
        </p>
      )}

      {films.length === 0 && gefunden === null ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setNote(undefined);
            setOhneJahrHilft(false);
            startTransition(async () => {
              const result = await previewMissingFilm(term, year ?? undefined);
              if (!result.candidates?.length) {
                setNote(result.error ?? 'Nichts gefunden.');
                setOhneJahrHilft(year !== null && suggestsDroppingTheYear(result.reason));
                return;
              }
              setGefunden(result.candidates);
            });
          }}
          className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {pending ? 'Sucht' : 'Weiter suchen'}
        </button>
      ) : null}

      {/* Ohne Jahr suchen statt eines leeren Ergebnisses. Der Fall ist
          der einzige, den der Suchende selbst beheben kann. */}
      {ohneJahrHilft ? (
        <Link
          href={`/?${new URLSearchParams({ q: term }).toString()}` as Route}
          className="text-foreground text-sm underline underline-offset-4"
        >
          Ohne Jahr suchen
        </Link>
      ) : null}

      {/* Die Prüfkarten: mehrere Treffer zur Auswahl statt des ersten.
          „Halloween" sind drei Filme, und den ersten stillschweigend
          aufzunehmen ist ein Rateschluss, den danach alle mitlesen. */}
      {gefunden !== null ? (
        <div className="flex w-full flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {gefunden.length === 1
              ? 'Ist das der Film?'
              : `${String(gefunden.length)} Treffer. Welcher ist gemeint?`}
          </p>

          <ul className="flex flex-col gap-2">
            {gefunden.map((kandidat) => (
              <li key={kandidat.wikidataId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setNote(undefined);
                    setGefunden(null);
                    startTransition(async () => {
                      const result = await adoptFilm(kandidat.wikidataId);
                      if (result.error ?? !result.films?.length) {
                        setNote(result.error ?? 'Der Film konnte nicht gespeichert werden.');
                        return;
                      }
                      setBuilding(result.films[0] ?? null);
                    });
                  }}
                  className="border-border hover:bg-card flex w-full items-center gap-3 rounded-md border p-2 text-left disabled:opacity-60"
                >
                  <span className="bg-card h-[72px] w-12 shrink-0 overflow-hidden rounded">
                    {kandidat.posterUrl ? (
                      // Verlinkt, nicht gespiegelt (docs/legal/thetvdb-lizenz.md).
                      <img
                        src={kandidat.posterUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{kandidat.title}</span>
                    {/* Der Originaltitel neben dem deutschen, aber nur
                        wenn er etwas hinzufügt. */}
                    {kandidat.titleOriginal !== kandidat.title ? (
                      <span className="text-muted-foreground truncate text-xs">
                        {kandidat.titleOriginal}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {[
                        kandidat.releaseYear === null ? null : String(kandidat.releaseYear),
                        kandidat.director,
                        kandidat.runtimeMin === null
                          ? null
                          : `${String(kandidat.runtimeMin)} Minuten`,
                      ]
                        .filter((teil) => teil !== null)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => {
              setGefunden(null);
            }}
            className="text-muted-foreground hover:text-foreground self-start text-sm"
          >
            Keiner davon
          </button>
        </div>
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
