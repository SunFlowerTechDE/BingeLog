'use client';

import { useState, useTransition } from 'react';

import {
  addFavourite,
  removeFavourite,
  swapFavourites,
  searchCatalogue,
  type FilmTreffer,
} from '@/lib/favourite-actions';
import { ActionNote } from '@/components/action-note';
import { Symbol } from '@/components/icons';

export interface Favorit {
  position: number;
  film: FilmTreffer;
}

// Zehn seit dem 31.08.2026, wie in `favourites.position` und in der
// iOS-App.
const PLAETZE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function plakat(film: FilmTreffer): string {
  return film.poster_source === 'tvdb' && film.poster_url
    ? film.poster_url
    : `/poster/${film.wikidata_id}`;
}

function titel(film: FilmTreffer): string {
  return film.title_de ?? film.title_original;
}

/**
 * Die vier Lieblingsfilme waehlen.
 *
 * Die Suche erscheint **nur im Bearbeiten-Modus**. Ausserhalb zeigt der
 * Bereich zehn Plaetze und sonst nichts — ein Suchfeld, das immer offen
 * steht, sieht aus wie eine Aufgabe, die noch offen ist.
 *
 * Gesucht wird im ganzen Katalog. Einen Lieblingsfilm hat man oft, lange
 * bevor man ihn hier eintraegt.
 */
export function FavouriteEditor({ anfang }: { anfang: Favorit[] }) {
  const [favoriten, setFavoriten] = useState(anfang);
  const [bearbeitet, setBearbeitet] = useState(false);
  const [term, setTerm] = useState('');
  const [treffer, setTreffer] = useState<FilmTreffer[]>([]);
  const [sucht, setSucht] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  const beiPlatz = (p: number) => favoriten.find((f) => f.position === p);
  const voll = favoriten.length >= PLAETZE.length;

  const suchen = (wert: string) => {
    setTerm(wert);
    const trimmed = wert.trim();
    if (trimmed.length < 2) {
      setTreffer([]);
      return;
    }
    setSucht(true);
    void searchCatalogue(trimmed).then((rows) => {
      // Nur uebernehmen, wenn das Feld noch dasselbe sagt: eine langsame
      // Antwort darf eine neuere nicht ueberschreiben.
      setTerm((aktuell) => {
        if (aktuell.trim() === trimmed) {
          setTreffer(rows);
          setSucht(false);
        }
        return aktuell;
      });
    });
  };

  const melden = (r: { error?: string; message?: string }) => {
    setProblem(r.error);
    setMeldung(r.message);
  };

  const hinzufuegen = (film: FilmTreffer) => {
    setProblem(undefined);
    setMeldung(undefined);
    startTransition(async () => {
      const r = await addFavourite(film.wikidata_id);
      melden(r);
      if (!r.error) {
        const frei = PLAETZE.find((p) => !favoriten.some((f) => f.position === p));
        if (frei !== undefined) setFavoriten([...favoriten, { position: frei, film }]);
        setTerm('');
        setTreffer([]);
      }
    });
  };

  const entfernen = (position: number) => {
    setProblem(undefined);
    setMeldung(undefined);
    startTransition(async () => {
      const r = await removeFavourite(position);
      melden(r);
      if (!r.error) setFavoriten(favoriten.filter((f) => f.position !== position));
    });
  };

  const tauschen = (a: number, b: number) => {
    setProblem(undefined);
    setMeldung(undefined);
    startTransition(async () => {
      const r = await swapFavourites(a, b);
      melden(r);
      if (!r.error) {
        setFavoriten(
          favoriten.map((f) =>
            f.position === a ? { ...f, position: b } : f.position === b ? { ...f, position: a } : f,
          ),
        );
      }
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Favoriten</h2>
          <p className="text-muted-foreground text-xs">
            Vier Filme, die oben auf deinem Profil stehen. Jeder kann sie sehen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setBearbeitet(!bearbeitet);
            setTerm('');
            setTreffer([]);
            setProblem(undefined);
            setMeldung(undefined);
          }}
          className="border-border hover:bg-card ml-auto rounded-md border px-3 py-2 text-sm"
        >
          {bearbeitet ? 'Fertig' : 'Bearbeiten'}
        </button>
      </div>

      <ol className="grid grid-cols-4 gap-3 sm:max-w-md">
        {PLAETZE.map((p) => {
          const favorit = beiPlatz(p);
          return (
            <li key={p} className="flex flex-col gap-1.5">
              <div className="border-border bg-card relative overflow-hidden rounded border">
                {favorit ? (
                  <img
                    src={plakat(favorit.film)}
                    alt=""
                    className="aspect-[2/3] w-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground flex aspect-[2/3] w-full items-center justify-center text-2xl">
                    {p}
                  </div>
                )}

                {bearbeitet && favorit ? (
                  <button
                    type="button"
                    disabled={laeuft}
                    aria-label={`${titel(favorit.film)} entfernen`}
                    onClick={() => {
                      entfernen(p);
                    }}
                    className="bg-background/80 text-foreground hover:bg-destructive hover:text-destructive-foreground absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded"
                  >
                    <Symbol art="schliessen" size={13} />
                  </button>
                ) : null}
              </div>

              {favorit ? (
                <span className="truncate text-xs" title={titel(favorit.film)}>
                  {titel(favorit.film)}
                </span>
              ) : null}

              {/* Tauschen statt Ziehen: zehn Plaetze, und ein
                  Ziehen-und-Fallenlassen auf dem Handy ist mehr
                  Fehlerquelle als Bequemlichkeit. */}
              {bearbeitet && favorit ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={laeuft || p === 1}
                    aria-label="Nach vorn"
                    onClick={() => {
                      tauschen(p, p - 1);
                    }}
                    className="border-border hover:bg-card flex-1 rounded border py-1 text-xs disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={laeuft || p === PLAETZE.length}
                    aria-label="Nach hinten"
                    onClick={() => {
                      tauschen(p, p + 1);
                    }}
                    className="border-border hover:bg-card flex-1 rounded border py-1 text-xs disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {bearbeitet ? (
        <div className="border-border bg-card/40 flex flex-col gap-3 rounded-lg border p-4">
          {voll ? (
            <p className="text-muted-foreground text-sm">
              Alle Plätze sind belegt. Nimm erst einen heraus.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Film suchen</span>
                <input
                  type="search"
                  value={term}
                  onChange={(e) => {
                    suchen(e.target.value);
                  }}
                  placeholder="Titel eingeben"
                  autoComplete="off"
                  className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
                />
              </label>

              {sucht ? <p className="text-muted-foreground text-sm">Sucht…</p> : null}

              {!sucht && term.trim().length >= 2 && treffer.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nichts gefunden. Trag den Film einmal ein, dann steht er im Katalog.
                </p>
              ) : null}

              <ul className="flex flex-col gap-1">
                {treffer.map((film) => (
                  <li key={film.wikidata_id}>
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() => {
                        hinzufuegen(film);
                      }}
                      className="hover:bg-card flex w-full items-center gap-3 rounded-md p-1.5 text-left disabled:opacity-60"
                    >
                      <img
                        src={plakat(film)}
                        alt=""
                        className="bg-card w-8 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{titel(film)}</span>
                      {film.release_year ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {film.release_year}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <ActionNote message={problem} />
      <ActionNote message={meldung} tone="info" />
    </section>
  );
}
