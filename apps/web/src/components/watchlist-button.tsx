'use client';

import { useState, useTransition } from 'react';

import { toggleWatchlist } from '@/lib/diary-actions';
import { ActionNote } from '@/components/action-note';

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
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        setProblem(undefined);
        startTransition(async () => {
          const result = await toggleWatchlist(filmId);
          // Put the label back if the server disagreed, and say so.
          if (result.error) {
            setOn(!next);
            setProblem(result.error);
          }
        });
      }}
      className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm
                 disabled:opacity-60"
    >
        {on ? 'Vorgemerkt' : 'Vormerken'}
      </button>
      <ActionNote message={problem} />
    </div>
  );
}
