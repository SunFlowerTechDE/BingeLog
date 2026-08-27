'use client';

import { useState, useTransition } from 'react';

import { formatRating } from '@/components/stars';

const STAR_PATH =
  'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z';

/**
 * Ten radio inputs behind five stars.
 *
 * Real radios rather than buttons with ARIA: arrow keys, focus and
 * screen-reader semantics then come from the browser instead of from
 * code that has to be kept correct.
 *
 * `onSelect` makes this the two-tap path — one tap on a star logs the
 * film. Without it the component is just a field inside a larger form.
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
      <legend className="sr-only">Bewertung in halben Sternen</legend>

      <div className="relative inline-flex" style={{ height: size }}>
        {[0, 1, 2, 3, 4].map((index) => {
          const portion = Math.max(0, Math.min(1, shown / 2 - index));
          const id = `input-star-${String(index)}`;
          return (
            <svg
              key={index}
              width={size}
              height={size}
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="shrink-0"
            >
              <defs>
                <linearGradient id={`${id}-${String(Math.round(portion * 100))}`}>
                  <stop offset={`${String(portion * 100)}%`} stopColor="currentColor" />
                  <stop offset={`${String(portion * 100)}%`} stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d={STAR_PATH}
                fill={`url(#${id}-${String(Math.round(portion * 100))})`}
                className="text-primary"
              />
              <path
                d={STAR_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                className="text-muted-foreground opacity-40"
              />
            </svg>
          );
        })}

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
              <span className="sr-only">{formatRating(rating)} Sterne</span>
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
