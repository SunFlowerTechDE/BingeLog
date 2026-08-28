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
 * Wie die anderen im Einzelnen bewertet haben.
 *
 * Ausdruecklich nur die Werte der anderen. Die eigenen stehen im
 * Formular darueber und liessen sich hier bloss ein zweites Mal
 * ablesen — auf demselben Bildschirm, mit denselben Zahlen.
 *
 * Facetten erscheinen erst ab fuenf Stimmen. "Schauspiel 2,0 (1 Stimme)"
 * fuehrt in die Irre und laedt zum Kippen ein (M3, Fallstricke) — die
 * Schwelle sitzt in der materialisierten Sicht, nicht hier.
 *
 * Der eigene Wert steht daneben, wo es einen gibt: ohne Vergleich ist
 * eine Facette nur eine Zahl (M3 3.4b).
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
  const rows = FACET_KINDS.filter((facet) => byFacet.has(facet));

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
        <h2 className="text-base font-semibold tracking-tight">Wie andere bewerten</h2>
        <span aria-hidden="true" className="text-muted-foreground text-sm">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map((facet) => {
            const row = byFacet.get(facet);
            const mine = own[facet];
            const score = row?.avg_score ?? 0;

            return (
              <div key={facet} className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs">
                  {FACET_LABELS_DE[facet]}
                  {/* Deutlich blasser: die Zahl sagt, wie belastbar der
                      Wert ist, und ist nicht Teil des Namens. */}
                  <span className="text-muted-foreground/50 ml-2">
                    {row?.vote_count === 1 ? '1 Stimme' : `${String(row?.vote_count ?? 0)} Stimmen`}
                  </span>
                </dt>
                <dd className="flex items-center gap-2">
                  <PopcornRating rating={score} size={16} />
                  <span className="text-sm tabular-nums">{formatRating(score)}</span>
                  {mine === undefined ? null : (
                    <span className="text-muted-foreground text-xs">du {formatRating(mine)}</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </section>
  );
}
