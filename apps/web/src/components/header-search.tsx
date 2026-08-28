'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Symbol } from '@/components/icons';

/**
 * Die Suche in der Kopfleiste.
 *
 * Ein Symbol statt eines Feldes: gesucht wird selten und gelesen oft,
 * und ein Feld, das immer offen steht, nimmt der Leiste die Ruhe. Der
 * Klick klappt das Feld auf und setzt den Schreibmarke hinein — wer die
 * Lupe drueckt, will tippen.
 *
 * Gesucht wird auf der Startseite ueber `?q=`, denselben Weg wie das
 * grosse Feld dort. Zwei Wege in dieselbe Ansicht, nicht zwei Suchen.
 */
export function HeaderSearch() {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [term, setTerm] = useState('');
  const feld = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (offen) feld.current?.focus();
  }, [offen]);

  // Escape schliesst. Ohne das bleibt das Feld offen stehen, und die
  // Tastatur kommt nicht mehr heraus.
  useEffect(() => {
    if (!offen) return;
    const hoerer = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };
    document.addEventListener('keydown', hoerer);
    return () => {
      document.removeEventListener('keydown', hoerer);
    };
  }, [offen]);

  if (!offen) {
    return (
      <button
        type="button"
        aria-label="Suchen"
        onClick={() => {
          setOffen(true);
        }}
        className="text-muted-foreground hover:text-foreground hover:bg-card flex h-9 w-9 items-center justify-center rounded-md"
      >
        <Symbol art="lupe" size={19} />
      </button>
    );
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = term.trim();
        // Unter zwei Zeichen trifft jede Anfrage den halben Katalog.
        if (trimmed.length < 2) return;
        router.push(`/?q=${encodeURIComponent(trimmed)}`);
        setOffen(false);
        setTerm('');
      }}
      className="flex items-center gap-1"
    >
      <input
        ref={feld}
        type="search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
        }}
        placeholder="Film suchen"
        aria-label="Film suchen"
        autoComplete="off"
        className="border-border bg-card focus:ring-ring w-40 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 sm:w-56"
      />
      <button
        type="button"
        aria-label="Suche schließen"
        onClick={() => {
          setOffen(false);
          setTerm('');
        }}
        className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-md"
      >
        <Symbol art="schliessen" size={17} />
      </button>
    </form>
  );
}
