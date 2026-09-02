'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Die Suchfelder: Titel, und daneben optional das Jahr (19-web-nachziehen 5).
 *
 * Der Term steht in der Adresse, damit eine Trefferliste geteilt und neu
 * geladen werden kann, und wird verzoegert geschrieben, damit nicht
 * jeder Tastendruck eine Abfrage ausloest (M3 3.2).
 *
 * **Das Jahr steht neben dem Titel, nicht in der Kopfleiste.** Die
 * gehoert dem Titel, und eine Leiste mit zwei Feldern ist eine Leiste,
 * in der man das falsche trifft.
 *
 * **Vier Ziffern oder nichts.** Bei dreien wuerde beim Tippen von „1999"
 * kurz nach dem Jahr 199 gesucht und die Liste geleert — das sieht aus,
 * als gaebe es den Film nicht. Solange das Jahr angefangen ist, filtert
 * es nicht und ein Hinweis steht darunter.
 */
export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const [jahr, setJahr] = useState(searchParams.get('j') ?? '');
  const initial = useRef(true);

  const angefangen = jahr.length > 0 && jahr.length < 4;

  useEffect(() => {
    // Nicht noch einmal dorthin navigieren, wo die Seite schon steht.
    if (initial.current) {
      initial.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const trimmed = term.trim();
      // Unter zwei Zeichen trifft jede Anfrage den halben Katalog, also
      // wird die Liste geleert statt mit Rauschen gefuellt.
      if (trimmed.length < 2) {
        router.replace('/', { scroll: false });
        return;
      }

      const params = new URLSearchParams({ q: trimmed });
      if (jahr.length === 4) params.set('j', jahr);
      router.replace(`/?${params.toString()}`, { scroll: false });
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [term, jahr, router]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
          }}
          placeholder="Film suchen"
          aria-label="Film suchen"
          autoComplete="off"
          className="border-border bg-card focus:ring-ring w-full rounded-md border px-4 py-3 text-base outline-none focus:ring-2"
        />
        <input
          type="text"
          inputMode="numeric"
          value={jahr}
          onChange={(event) => {
            // Nur Ziffern, hoechstens vier. Ein Jahrfeld, in das man
            // Buchstaben tippen kann, ist ein Textfeld mit falschem Namen.
            setJahr(event.target.value.replace(/\D/g, '').slice(0, 4));
          }}
          placeholder="Jahr"
          aria-label="Jahr, optional"
          autoComplete="off"
          className="border-border bg-card focus:ring-ring w-24 shrink-0 rounded-md border px-3 py-3 text-base tabular-nums outline-none focus:ring-2"
        />
      </div>

      {angefangen ? (
        <p className="text-muted-foreground text-xs">Das Jahr filtert ab vier Ziffern.</p>
      ) : null}
    </div>
  );
}
