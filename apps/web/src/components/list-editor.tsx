'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  addToList,
  removeFromList,
  swapInList,
  noteOnItem,
  updateList,
  deleteList,
} from '@/lib/list-actions';
import { searchCatalogue, type FilmTreffer } from '@/lib/catalogue-search';
import { ActionNote } from '@/components/action-note';
import { Symbol } from '@/components/icons';

export interface ListeneintragFilm {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_source: string | null;
  poster_url: string | null;
}

export interface Listeneintrag {
  film: ListeneintragFilm;
  note: string | null;
}

function plakat(film: ListeneintragFilm): string {
  return film.poster_source === 'tvdb' && film.poster_url
    ? film.poster_url
    : `/poster/${film.wikidata_id}`;
}

function titel(film: ListeneintragFilm): string {
  return film.title_de ?? film.title_original;
}

/**
 * Eine Binge-Liste fuehren.
 *
 * Alles am selben Ort: Filme suchen und anhaengen, umsortieren, Notizen
 * schreiben, Name und Sichtbarkeit aendern, die Liste loeschen. Die
 * Werkzeuge erscheinen nur fuer den Besitzer — wer eine fremde Liste
 * liest, sieht die Liste und nicht die Werkstatt.
 */
export function ListEditor({
  listId,
  anfang,
  titelJetzt,
  beschreibungJetzt,
  oeffentlichJetzt,
}: {
  listId: string;
  anfang: Listeneintrag[];
  titelJetzt: string;
  beschreibungJetzt: string | null;
  oeffentlichJetzt: boolean;
}) {
  const [eintraege, setEintraege] = useState(anfang);
  const [term, setTerm] = useState('');
  const [treffer, setTreffer] = useState<FilmTreffer[]>([]);
  const [sucht, setSucht] = useState(false);
  const [notizFuer, setNotizFuer] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const [state, action, speichert] = useActionState(updateList, {});
  const router = useRouter();

  const melden = (r: { error?: string; message?: string }) => {
    setProblem(r.error);
    setMeldung(r.message);
  };

  const suchen = (wert: string) => {
    setTerm(wert);
    const trimmed = wert.trim();
    if (trimmed.length < 2) {
      setTreffer([]);
      return;
    }
    setSucht(true);
    void searchCatalogue(trimmed).then((rows) => {
      // Eine langsame Antwort darf eine neuere nicht ueberschreiben.
      setTerm((aktuell) => {
        if (aktuell.trim() === trimmed) {
          setTreffer(rows);
          setSucht(false);
        }
        return aktuell;
      });
    });
  };

  const anhaengen = (film: FilmTreffer) => {
    startTransition(async () => {
      const r = await addToList(listId, film.wikidata_id);
      melden(r);
      if (!r.error) {
        setEintraege([...eintraege, { film, note: null }]);
        setTerm('');
        setTreffer([]);
      }
    });
  };

  const entfernen = (wikidataId: string) => {
    startTransition(async () => {
      const r = await removeFromList(listId, wikidataId);
      melden(r);
      if (!r.error) setEintraege(eintraege.filter((e) => e.film.wikidata_id !== wikidataId));
    });
  };

  const schieben = (index: number, richtung: -1 | 1) => {
    const ziel = index + richtung;
    const a = eintraege[index];
    const b = eintraege[ziel];
    if (!a || !b) return;

    startTransition(async () => {
      const r = await swapInList(listId, a.film.wikidata_id, b.film.wikidata_id);
      melden(r);
      if (!r.error) {
        const kopie = [...eintraege];
        kopie[index] = b;
        kopie[ziel] = a;
        setEintraege(kopie);
      }
    });
  };

  const notieren = (wikidataId: string, text: string) => {
    startTransition(async () => {
      const r = await noteOnItem(listId, wikidataId, text);
      melden(r);
      if (!r.error) {
        setEintraege(
          eintraege.map((e) =>
            e.film.wikidata_id === wikidataId
              ? { ...e, note: text.trim() === '' ? null : text.trim() }
              : e,
          ),
        );
        setNotizFuer(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setEinstellungenOffen(!einstellungenOffen);
          }}
          className="border-border hover:bg-card rounded-md border px-3 py-2 text-sm"
        >
          {einstellungenOffen ? 'Fertig' : 'Liste bearbeiten'}
        </button>
      </div>

      {einstellungenOffen ? (
        <form
          action={action}
          className="border-border bg-card/40 flex flex-col gap-4 rounded-lg border p-5"
        >
          <input type="hidden" name="id" value={listId} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <input
              type="text"
              name="title"
              maxLength={80}
              required
              defaultValue={titelJetzt}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Beschreibung</span>
            <textarea
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={beschreibungJetzt ?? ''}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            />
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="isPublic" defaultChecked={oeffentlichJetzt} />
            <span className="text-sm font-medium">Öffentlich</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={speichert}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {speichert ? 'Wird gespeichert' : 'Speichern'}
            </button>
            <ActionNote message={state.error} />
            <ActionNote message={state.message} tone="info" />

            {/* Loeschen ganz rechts und ohne Farbe, bis man es meint. */}
            <button
              type="button"
              disabled={laeuft}
              onClick={() => {
                if (!confirm('Die Liste und alles darin löschen?')) return;
                startTransition(async () => {
                  const r = await deleteList(listId);
                  if (r.error) melden(r);
                  else router.push('/');
                });
              }}
              className="text-muted-foreground hover:text-destructive ml-auto text-sm underline underline-offset-4"
            >
              Liste löschen
            </button>
          </div>
        </form>
      ) : null}

      <div className="border-border bg-card/40 flex flex-col gap-3 rounded-lg border p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Film hinzufügen</span>
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
                  anhaengen(film);
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
      </div>

      {eintraege.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Noch nichts drin. Such oben einen Film und häng ihn an.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {eintraege.map((eintrag, index) => (
            <li key={eintrag.film.wikidata_id} className="flex gap-4">
              <span className="text-muted-foreground w-6 shrink-0 pt-1 text-right text-sm tabular-nums">
                {index + 1}
              </span>

              <Link
                href={`/film/${eintrag.film.wikidata_id}` as Route}
                className="bg-card w-14 shrink-0 overflow-hidden rounded"
              >
                <img
                  src={plakat(eintrag.film)}
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Link
                  href={`/film/${eintrag.film.wikidata_id}` as Route}
                  className="font-medium hover:underline"
                >
                  {titel(eintrag.film)}
                  {eintrag.film.release_year ? (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      {eintrag.film.release_year}
                    </span>
                  ) : null}
                </Link>

                {notizFuer === eintrag.film.wikidata_id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const feld = e.currentTarget.elements.namedItem('note');
                      if (feld instanceof HTMLTextAreaElement) {
                        notieren(eintrag.film.wikidata_id, feld.value);
                      }
                    }}
                    className="flex flex-col gap-2"
                  >
                    <textarea
                      name="note"
                      rows={2}
                      maxLength={300}
                      defaultValue={eintrag.note ?? ''}
                      placeholder="Warum steht der Film hier?"
                      className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                    />
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={laeuft}
                        className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
                      >
                        Notiz speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotizFuer(null);
                        }}
                        className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </form>
                ) : eintrag.note ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">{eintrag.note}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    disabled={laeuft || index === 0}
                    onClick={() => {
                      schieben(index, -1);
                    }}
                    className="border-border hover:bg-card rounded border px-2 py-0.5 text-xs disabled:opacity-30"
                    aria-label="Nach oben"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={laeuft || index === eintraege.length - 1}
                    onClick={() => {
                      schieben(index, 1);
                    }}
                    className="border-border hover:bg-card rounded border px-2 py-0.5 text-xs disabled:opacity-30"
                    aria-label="Nach unten"
                  >
                    ↓
                  </button>
                  {notizFuer === eintrag.film.wikidata_id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setNotizFuer(eintrag.film.wikidata_id);
                      }}
                      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                    >
                      {eintrag.note ? 'Notiz ändern' : 'Notiz'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => {
                      entfernen(eintrag.film.wikidata_id);
                    }}
                    className="text-muted-foreground hover:text-destructive ml-auto flex items-center gap-1 text-xs"
                    aria-label={`${titel(eintrag.film)} entfernen`}
                  >
                    <Symbol art="schliessen" size={12} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ActionNote message={problem} />
      <ActionNote message={meldung} tone="info" />
    </div>
  );
}
