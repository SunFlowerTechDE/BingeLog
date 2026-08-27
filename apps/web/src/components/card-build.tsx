'use client';

import { useEffect, useState } from 'react';
import { posterLayers, type PosterInput } from '@binge-log/poster';

/**
 * The card being built, one layer at a time.
 *
 * The order is not a presentation choice — it is how the card is
 * actually composed: the ground colour comes from a hash of the film's
 * id, the ring texture from the same seed, then the type. Showing that
 * order shows what is happening.
 *
 * Honoured for anyone who asked for less motion: the whole card appears
 * at once and the captions still run, so the information is the same and
 * only the theatre is gone.
 */

const STEPS = [
  { key: 'background', caption: 'Farben aus der Kennung ableiten' },
  { key: 'pattern', caption: 'Muster zeichnen' },
  { key: 'title', caption: 'Titel setzen' },
  { key: 'meta', caption: 'Jahr und Regie' },
] as const;

const STEP_MS = 420;

export function CardBuild({ film, onDone }: { film: PosterInput; onDone?: () => void }) {
  const layers = posterLayers(film);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [step, setStep] = useState(reduced ? STEPS.length : 0);

  useEffect(() => {
    if (reduced) {
      const done = setTimeout(() => onDone?.(), 600);
      return () => {
        clearTimeout(done);
      };
    }

    if (step >= STEPS.length) {
      const done = setTimeout(() => onDone?.(), 700);
      return () => {
        clearTimeout(done);
      };
    }

    const timer = setTimeout(() => {
      setStep((current) => current + 1);
    }, STEP_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [step, reduced, onDone]);

  const visible = (index: number) => step > index;

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="overflow-hidden rounded-lg shadow-2xl"
        style={{ width: 220, aspectRatio: '2 / 3', backgroundColor: '#0b0d11' }}
      >
        <svg
          viewBox={`0 0 ${String(layers.width)} ${String(layers.height)}`}
          width="100%"
          height="100%"
          role="img"
          aria-label={`Karte für ${film.title} wird gebaut`}
        >
          <defs dangerouslySetInnerHTML={{ __html: layers.defs }} />

          <g style={{ opacity: visible(0) ? 1 : 0, transition: 'opacity 400ms ease-out' }}>
            <g dangerouslySetInnerHTML={{ __html: layers.background }} />
          </g>

          <g
            style={{
              opacity: visible(1) ? 1 : 0,
              transform: visible(1) ? 'scale(1)' : 'scale(1.12)',
              transformOrigin: 'center',
              transition: 'opacity 500ms ease-out, transform 700ms cubic-bezier(.2,.8,.2,1)',
            }}
          >
            <g dangerouslySetInnerHTML={{ __html: layers.pattern }} />
          </g>

          <g fontFamily={layers.fontFamily}>
            {layers.titleLines.map((line, index) => (
              <g
                key={index}
                style={{
                  opacity: visible(2) ? 1 : 0,
                  transform: visible(2) ? 'translateY(0)' : 'translateY(10px)',
                  // Lines land in reading order, the way they are set.
                  transition: `opacity 320ms ease-out ${String(index * 90)}ms, transform 320ms ease-out ${String(index * 90)}ms`,
                }}
                dangerouslySetInnerHTML={{ __html: line }}
              />
            ))}

            <g
              style={{
                opacity: visible(3) ? 1 : 0,
                transition: 'opacity 300ms ease-out',
              }}
            >
              <g dangerouslySetInnerHTML={{ __html: layers.rule + layers.meta }} />
            </g>
          </g>
        </svg>
      </div>

      <p aria-live="polite" className="text-muted-foreground h-5 text-sm">
        {step >= STEPS.length ? 'Fertig' : (STEPS[step]?.caption ?? '')}
      </p>
    </div>
  );
}
