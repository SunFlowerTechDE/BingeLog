'use client';

import { useState, useTransition } from 'react';

import { toggleWatchlist } from '@/lib/diary-actions';

/**
 * Adds or removes a film from the watchlist.
 *
 * Optimistic on purpose: the answer is a single boolean the server
 * already agreed to, and waiting a round trip to flip a label makes a
 * one-tap action feel like a form submission.
 */
export function WatchlistButton({
  filmId,
  initiallyOn,
}: {
  filmId: string;
  initiallyOn: boolean;
}) {
  const [on, setOn] = useState(initiallyOn);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        startTransition(async () => {
          const result = await toggleWatchlist(filmId);
          // Put the label back if the server disagreed.
          if (result.error) setOn(!next);
        });
      }}
      className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm
                 disabled:opacity-60"
    >
      {on ? 'Vorgemerkt' : 'Vormerken'}
    </button>
  );
}
