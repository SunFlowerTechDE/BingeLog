'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';

import { verlaufLeeren, verlaufLesen, verlaufMerken } from '@/lib/search-history';

/**
 * Der Suchverlauf (Suchkonzept 16, 19-web-nachziehen 10).
 *
 * Steht nur da, wenn gerade nicht gesucht wird — über einer Trefferliste
 * wäre er eine zweite Liste, die vom Ergebnis ablenkt. Löschbar, wie das
 * Konzept es verlangt.
 */
export function SearchHistory({ term }: { term: string }) {
  const [verlauf, setVerlauf] = useState<string[]>([]);

  useEffect(() => {
    if (term.trim().length >= 2) {
      verlaufMerken(term);
      return;
    }
    setVerlauf(verlaufLesen());
  }, [term]);

  if (term.trim().length >= 2 || verlauf.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-muted-foreground text-xs font-medium">Zuletzt gesucht</h2>
        <button
          type="button"
          onClick={() => {
            verlaufLeeren();
            setVerlauf([]);
          }}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Leeren
        </button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {verlauf.map((eintrag) => (
          <li key={eintrag}>
            <Link
              href={`/?${new URLSearchParams({ q: eintrag }).toString()}` as Route}
              className="border-border bg-card/60 hover:bg-card rounded-full border px-3 py-1 text-xs"
            >
              {eintrag}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
