'use client';

import { useState } from 'react';

import { PopcornRating, formatRating } from '@/components/popcorn';
import { FACET_KINDS, FACET_LABELS_DE, type FacetKind } from '@binge-log/db';

export interface FacetAverage {
  facet: FacetKind;
  avg_score: number;
  vote_count: number;
}

/**
 * Die detaillierte Bewertung, zwei Spalten breit und aufklappbar.
 *
 * Facetten erscheinen erst ab fuenf Stimmen. "Schauspiel 2,0 (1 Stimme)"
 * fuehrt in die Irre und laedt zum Kippen ein (M3, Fallstricke) — die
 * Schwelle sitzt in der materialisierten Sicht, nicht hier.
 *
 * Wo eine eigene Bewertung vorliegt, steht sie neben der der anderen.
 * Ohne Vergleich ist eine Facette nur eine Zahl.
 */
export function FacetPanel({
  averages,
  own,
}: {
  averages: FacetAverage[];
  own: Partial<Record<string, number>>;
}) {
  const [open, setOpen] = useState(true);

  const byFacet = new Map(averages.map((row) => [row.facet, row]));
  const rows = FACET_KINDS.filter((facet) => byFacet.has(facet) || own[facet] !== undefined);

  if (rows.length === 0) return null;

  return (
    <section className="border-border bg-card/40 rounded-lg border p-5">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-base font-semibold tracking-tight">Detaillierte Bewertung</h2>
        <span aria-hidden="true" className="text-muted-foreground text-sm">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map((facet) => {
            const row = byFacet.get(facet);
            const mine = own[facet];
            const score = row?.avg_score ?? mine ?? 0;

            return (
              <div key={facet} className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs">{FACET_LABELS_DE[facet]}</dt>
                <dd className="flex items-center gap-2">
                  <PopcornRating rating={score} size={16} />
                  <span className="text-sm tabular-nums">{formatRating(score)}</span>
                  {mine !== undefined && row ? (
                    <span className="text-muted-foreground text-xs">du {formatRating(mine)}</span>
                  ) : null}
                  {row ? null : <span className="text-muted-foreground text-xs">nur deine</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </section>
  );
}
