'use client';

import { useState, useTransition } from 'react';

import { Bucket, formatRating } from '@/components/popcorn';

/**
 * Ten radio inputs behind five buckets of popcorn.
 *
 * Real radios rather than buttons with ARIA: arrow keys, focus and
 * screen-reader semantics then come from the browser instead of from
 * code that has to be kept correct.
 *
 * `onSelect` makes this the two-tap path — one tap logs the film.
 * Without it the component is just a field inside a larger form.
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
  const [current, setCurrent] = useState<number | null>(value);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = hovered ?? current ?? 0;

  function choose(rating: number) {
    setCurrent(rating);
    if (onSelect) {
      startTransition(async () => {
        await onSelect(rating);
      });
    }
  }

  return (
    <fieldset
      className="flex items-center gap-2"
      disabled={pending}
      onMouseLeave={() => {
        setHovered(null);
      }}
    >
      <legend className="sr-only">Bewertung in halben Popcorn</legend>

      <div className="relative inline-flex gap-0.5" style={{ height: size }}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Bucket key={index} portion={shown / 2 - index} size={size} />
        ))}

        {/* The radios sit on top as half-width hit areas, invisible but
            focusable, so the whole control works from the keyboard. */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
            <label
              key={rating}
              className="focus-within:ring-ring flex-1 cursor-pointer rounded-sm focus-within:ring-2"
              onMouseEnter={() => {
                setHovered(rating);
              }}
            >
              <input
                type="radio"
                name={name}
                value={rating}
                checked={current === rating}
                onChange={() => {
                  choose(rating);
                }}
                className="sr-only"
              />
              <span className="sr-only">{formatRating(rating)} Popcorn</span>
            </label>
          ))}
        </div>
      </div>

      <span className="text-muted-foreground w-10 text-sm tabular-nums">
        {current === null ? '' : formatRating(current)}
      </span>
    </fieldset>
  );
}
