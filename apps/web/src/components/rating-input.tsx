'use client';

import { useState, useTransition } from 'react';

import { Bucket, fillFor, formatRating } from '@/components/popcorn';
import { nextRating, RATING_MAX } from '@/lib/rating';

/**
 * Rating in popcorn, whole ones first.
 *
 * A click always places whole buckets. Clicking the one you are already
 * standing on refines it: full becomes half, half becomes gone. So the
 * ordinary gesture costs one tap and lands on a round number, and half
 * steps are a deliberate second thought rather than a matter of hitting
 * the correct half of a small target.
 *
 * On the first bucket the third click leaves no rating at all, which is
 * how a rating gets taken back.
 *
 * Hovering previews exactly what a click would do, including the
 * refinement — that is how the cycle is discovered without being
 * explained.
 */

export function RatingInput({
  name = 'rating',
  value,
  onSelect,
  size = 30,
}: {
  name?: string;
  value: number | null;
  onSelect?: (rating: number) => Promise<unknown>;
  size?: number;
}) {
  const [current, setCurrent] = useState<number>(value ?? 0);
  // Which bucket the pointer is on, not what the preview should be. The
  // preview is derived from it, so it cannot survive the rating changing
  // underneath it — storing the computed value left a stale number on
  // screen after every click, because the pointer never re-entered.
  const [hovered, setHovered] = useState<number | null>(null);
  // A click leaves the pointer sitting on the bucket it just used, and
  // the preview would immediately offer the next step — so right after
  // setting 5,0 the display read 4,5, which looks like the wrong thing
  // was saved. The preview stays quiet until the pointer has left once.
  const [previewArmed, setPreviewArmed] = useState(true);
  const [pending, startTransition] = useTransition();

  const shown = hovered !== null && previewArmed ? nextRating(current, hovered) : current;

  function commit(rating: number) {
    setCurrent(rating);
    setPreviewArmed(false);
    if (onSelect) {
      startTransition(async () => {
        await onSelect(rating);
      });
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    // Arrow keys move in half steps, because the keyboard has no notion
    // of clicking the same target twice.
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;

    if (step === 0 && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();

    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? RATING_MAX
          : Math.min(RATING_MAX, Math.max(0, current + step));
    commit(next);
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Bewertung in Popcorn"
        aria-valuemin={0}
        aria-valuemax={RATING_MAX}
        aria-valuenow={current}
        aria-valuetext={current === 0 ? 'keine Bewertung' : `${formatRating(current)} von 5 Popcorn`}
        aria-busy={pending}
        onKeyDown={onKeyDown}
        onMouseLeave={() => {
          setHovered(null);
          setPreviewArmed(true);
        }}
        className="focus-visible:ring-ring inline-flex gap-0.5 rounded outline-none
                   focus-visible:ring-2"
      >
        {[1, 2, 3, 4, 5].map((bucket) => (
          <button
            key={bucket}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            // Deliberately not disabled while saving. A button that goes
            // disabled under the cursor never fires mouseleave, so the
            // preview stayed on screen after the pointer had gone. The
            // action is an idempotent update; the last click wins.
            onMouseEnter={() => {
              setHovered(bucket);
            }}
            onClick={() => {
              commit(nextRating(current, bucket));
            }}
            className="cursor-pointer"
          >
            <Bucket fill={fillFor(shown, bucket - 1)} size={size} />
          </button>
        ))}
      </div>

      {/* Carries the value when this sits inside the details form. */}
      <input type="hidden" name={name} value={current === 0 ? '' : String(current)} />

      {/* Fixed width and a non-breaking space when empty, so the row keeps
          its height whether or not a number is showing. */}
      <span className="text-muted-foreground w-10 text-sm tabular-nums">
        {shown === 0 ? '\u00a0' : formatRating(shown)}
      </span>
    </div>
  );
}
