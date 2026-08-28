'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  myListsFor,
  addToList,
  removeFromList,
  createListWithFilm,
  type ListeFuerFilm,
} from '@/lib/list-actions';
import { ActionNote } from '@/components/action-note';

/**
 * Einen Film auf eine Binge-Liste legen — von der Filmseite aus.
 *
 * Das ist der Weg, auf dem Listen wachsen: man sieht einen Film und
 * denkt "der gehoert zu den anderen". Wer dafuer erst ins Profil und in
 * die Liste und dort in die Suche muss, legt ihn nie dazu.
 *
 * Die Listen werden **beim Aufklappen** geholt, nicht mit der Seite. Die
 * meisten Aufrufe fassen sie nie an.
 */
export function AddToList({ filmId }: { filmId: string }) {
  const [offen, setOffen] = useState(false);
  const [listen, setListen] = useState<ListeFuerFilm[] | null>(null);
  const [neu, setNeu] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();
  const huelle = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!offen) return;

    if (listen === null) void myListsFor(filmId).then(setListen);

    const draussen = (e: MouseEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };
    document.addEventListener('mousedown', draussen);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('mousedown', draussen);
      document.removeEventListener('keydown', taste);
    };
  }, [offen, listen, filmId]);

  const umschalten = (liste: ListeFuerFilm) => {
    setProblem(undefined);
    setMeldung(undefined);
    startTransition(async () => {
      const r = liste.enthaelt
        ? await removeFromList(liste.id, filmId)
        : await addToList(liste.id, filmId);

      if (r.error) setProblem(r.error);
      else {
        setMeldung(liste.enthaelt ? `Aus „${liste.title}" entfernt` : `Zu „${liste.title}"`);
        setListen(
          (listen ?? []).map((l) => (l.id === liste.id ? { ...l, enthaelt: !l.enthaelt } : l)),
        );
      }
    });
  };

  const anlegen = () => {
    setProblem(undefined);
    setMeldung(undefined);
    startTransition(async () => {
      const r = await createListWithFilm(neu, filmId);
      if (r.error) setProblem(r.error);
      else {
        setMeldung(`Liste „${neu.trim()}" angelegt`);
        setListen([
          { id: r.id ?? '', title: neu.trim(), is_public: true, enthaelt: true },
          ...(listen ?? []),
        ]);
        setNeu('');
      }
    });
  };

  return (
    <div ref={huelle} className="relative flex flex-col items-start gap-1.5">
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => {
          setOffen(!offen);
        }}
        className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm"
      >
        Auf eine Liste
      </button>

      {offen ? (
        <div className="border-border bg-card absolute left-0 top-full z-20 mt-2 flex w-72 flex-col gap-3 rounded-lg border p-3 shadow-lg">
          {listen === null ? (
            <p className="text-muted-foreground text-sm">Lädt…</p>
          ) : listen.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Noch keine Liste. Leg unten eine an — der Film kommt gleich hinein.
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
              {listen.map((liste) => (
                <li key={liste.id}>
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => {
                      umschalten(liste);
                    }}
                    className="hover:bg-background flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        liste.enthaelt
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border'
                      }`}
                    >
                      {liste.enthaelt ? '✓' : ''}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{liste.title}</span>
                    {!liste.is_public ? (
                      <span className="text-muted-foreground shrink-0 text-xs">privat</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              anlegen();
            }}
            className="border-border flex gap-2 border-t pt-3"
          >
            <input
              type="text"
              value={neu}
              onChange={(e) => {
                setNeu(e.target.value);
              }}
              maxLength={80}
              placeholder="Neue Liste"
              className="border-border bg-background focus:ring-ring min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2"
            />
            <button
              type="submit"
              disabled={laeuft || neu.trim() === ''}
              className="bg-primary text-primary-foreground shrink-0 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              Anlegen
            </button>
          </form>
        </div>
      ) : null}

      <ActionNote message={problem} />
      <ActionNote message={meldung} tone="info" />
    </div>
  );
}
