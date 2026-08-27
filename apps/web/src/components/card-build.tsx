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

/** Shown instead when TheTVDB already has the poster. */
const FOUND_STEPS = [
  { caption: 'Bei TheTVDB nachgesehen' },
  { caption: 'Plakat gefunden' },
] as const;

const STEP_MS = 420;

// A found poster is one image, not four layers: it needs longer per step
// and a longer hold at the end, or it is gone before it has been looked
// at. Measured at 2.1s before, which was not enough to see it.
const FOUND_STEP_MS = 620;
const FOUND_HOLD_MS = 1600;

export function CardBuild({
  film,
  posterUrl,
  onDone,
}: {
  film: PosterInput;
  posterUrl?: string | null;
  onDone?: () => void;
}) {
  const layers = posterLayers(film);
  // A real poster is not built, it is found. Building a procedural card
  // and then replacing it in the list with a different image means the
  // wrong thing was watched being made.
  const steps = posterUrl ? FOUND_STEPS : STEPS;

  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [step, setStep] = useState(reduced ? steps.length : 0);

  useEffect(() => {
    if (reduced) {
      const done = setTimeout(() => onDone?.(), 600);
      return () => {
        clearTimeout(done);
      };
    }

    if (step >= steps.length) {
      const done = setTimeout(() => onDone?.(), posterUrl ? FOUND_HOLD_MS : 700);
      return () => {
        clearTimeout(done);
      };
    }

    const timer = setTimeout(
      () => {
        setStep((current) => current + 1);
      },
      posterUrl ? FOUND_STEP_MS : STEP_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [step, steps.length, reduced, posterUrl, onDone]);

  const visible = (index: number) => step > index;

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="overflow-hidden rounded-lg shadow-2xl"
        style={{ width: 220, aspectRatio: '2 / 3', backgroundColor: '#0b0d11' }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{
              // >= , not > : the poster belongs to the step that says it
              // was found, otherwise it only appears under "Fertig".
              opacity: step >= 1 ? 1 : 0,
              transform: step >= 1 ? 'scale(1)' : 'scale(1.06)',
              transition: 'opacity 600ms ease-out, transform 900ms cubic-bezier(.2,.8,.2,1)',
            }}
          />
        ) : (
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
        )}
      </div>

      <p aria-live="polite" className="text-muted-foreground h-5 text-sm">
        {step >= steps.length ? 'Fertig' : (steps[step]?.caption ?? '')}
      </p>
    </div>
  );
}
