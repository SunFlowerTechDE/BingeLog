'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hash32, posterLayers, renderPosterSVG, type PosterInput } from '@binge-log/poster';

/**
 * The card being made, on a fixed fifteen-second clock.
 *
 * The length is deliberate and does not vary with what was found. A film
 * that comes with a poster and one that gets a procedural card take the
 * same time and pass through the same six moments, because both are the
 * same event: someone put a film into the catalog that was not there
 * before, and it is there for everyone from now on.
 *
 * 2s  the room goes quiet — the page behind blurs and darkens
 * 3s  a thousand fragments gather into a blank card
 * 3s  the title is set, line by line
 * 2s  the poster unrolls from the bottom edge, if there is one
 * 3s  the card turns on its vertical axis
 * 2s  the page comes back
 *
 * Honoured for anyone who asked for less motion: the finished card
 * appears at once, held long enough to read, and the caption still says
 * what happened.
 */

const CARD_W = 220;
const CARD_H = 330;

const PHASES = [
  { key: 'dim', ms: 2000 },
  { key: 'assemble', ms: 3000 },
  { key: 'title', ms: 3000 },
  { key: 'unroll', ms: 2000 },
  { key: 'flip', ms: 3000 },
  { key: 'restore', ms: 2000 },
] as const;

export type BuildPhase = (typeof PHASES)[number]['key'] | 'done';

const ORDER: readonly BuildPhase[] = [...PHASES.map((phase) => phase.key), 'done'];

/** Milliseconds from the start at which each phase hands over. */
const BOUNDARIES: readonly number[] = PHASES.reduce<number[]>((out, entry, index) => {
  out.push((out[index - 1] ?? 0) + entry.ms);
  return out;
}, []);

/** When the fragments start gathering: after the room has gone quiet. */
const ASSEMBLE_FROM = 2000;
const ASSEMBLE_MS = 3000;
const TITLE_MS = 3000;
const UNROLL_MS = 2000;
const FLIP_MS = 3000;

/** 25 × 40. The count is the point, so it is spelled out as a grid. */
const COLS = 25;
const ROWS = 40;

/** Share of the assemble phase any one fragment spends travelling. */
const TRAVEL = 0.45;

/** Height of the bright band that rides the poster's unrolling edge. */
const ROLL_EDGE = 26;

interface Fragment {
  x: number;
  y: number;
  w: number;
  h: number;
  fromX: number;
  fromY: number;
  rot: number;
  delay: number;
  color: string;
}

/** Small deterministic generator: the same film scatters the same way. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixHex(from: string, to: string, amount: number): string {
  const parts = [1, 3, 5].map((offset) => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * amount);
  });
  return `rgb(${parts.map(String).join(',')})`;
}

/** Share of a fragment's flight spent losing its own tint again. */
const SETTLE = 0.32;

/** Built when the gathering starts, not when the overlay opens. */
function buildFragments(seed: string, ground: string, accent: string): Fragment[] {
  const random = mulberry32(hash32(seed));
  const cellW = CARD_W / COLS;
  const cellH = CARD_H / ROWS;
  const out: Fragment[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const angle = random() * Math.PI * 2;
      const distance = 160 + random() * 320;
      out.push({
        x: col * cellW,
        y: row * cellH,
        w: cellW,
        h: cellH,
        fromX: CARD_W / 2 + Math.cos(angle) * distance,
        fromY: CARD_H / 2 + Math.sin(angle) * distance,
        rot: (random() - 0.5) * 2.4,
        delay: random() * (1 - TRAVEL),
        color: mixHex(ground, accent, random() * 0.85),
      });
    }
  }

  return out;
}

function paint(
  ctx: CanvasRenderingContext2D,
  fragments: readonly Fragment[],
  ground: string,
  progress: number,
) {
  ctx.clearRect(0, 0, CARD_W, CARD_H);

  for (const fragment of fragments) {
    const raw = (progress - fragment.delay) / TRAVEL;
    if (raw <= 0) continue;

    const p = raw >= 1 ? 1 : raw;
    const eased = 1 - Math.pow(1 - p, 3);
    const scale = 0.3 + 0.7 * eased;

    // The half-pixel overspill closes the seams once they are all home.
    const w = fragment.w * scale + 0.6;
    const h = fragment.h * scale + 0.6;
    const x = (-fragment.w * scale) / 2;
    const y = (-fragment.h * scale) / 2;

    ctx.save();
    ctx.translate(
      fragment.fromX + (fragment.x + fragment.w / 2 - fragment.fromX) * eased,
      fragment.fromY + (fragment.y + fragment.h / 2 - fragment.fromY) * eased,
    );
    ctx.rotate(fragment.rot * (1 - eased));

    // In flight each fragment carries its own tint, which is what makes a
    // thousand of them legible as a thousand. Landing, it gives that up:
    // a blank card is one even ground, not a mosaic.
    ctx.globalAlpha = eased;
    ctx.fillStyle = fragment.color;
    ctx.fillRect(x, y, w, h);

    const settled = (eased - (1 - SETTLE)) / SETTLE;
    if (settled > 0) {
      ctx.globalAlpha = settled;
      ctx.fillStyle = ground;
      ctx.fillRect(x, y, w, h);
    }

    ctx.restore();
  }
}

export function CardBuild({
  film,
  posterUrl,
  onPhase,
  onDone,
}: {
  film: PosterInput;
  posterUrl?: string | null;
  onPhase?: (phase: BuildPhase) => void;
  onDone?: () => void;
}) {
  // Destructured so the memos depend on the values rather than on the
  // object, which the caller builds fresh on every render.
  const { wikidataId, title } = film;
  const releaseYear = film.releaseYear ?? null;
  const director = film.director ?? null;

  const layers = useMemo(
    () => posterLayers({ wikidataId, title, releaseYear, director }),
    [wikidataId, title, releaseYear, director],
  );

  const { background: groundColor, accent: accentColor } = layers.palette;

  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [phase, setPhase] = useState<BuildPhase>(reduced ? 'restore' : 'dim');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const at = ORDER.indexOf(phase);
  const reached = useCallback((key: BuildPhase) => at >= ORDER.indexOf(key), [at]);

  // The back of the card is not on screen until the turn, so composing
  // it is kept off the mount path: everything done between the overlay
  // appearing and the clock starting comes out of the first beat.
  const finishedCard = useMemo(
    () =>
      reached('unroll') && !posterUrl
        ? renderPosterSVG({ wikidataId, title, releaseYear, director })
        : '',
    [reached, posterUrl, wikidataId, title, releaseYear, director],
  );

  // Held in refs so the clock below does not depend on them: a caller
  // whose callback changes identity mid-phase would otherwise tear the
  // timer down and start it over, stretching the phase.
  const onPhaseRef = useRef(onPhase);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onPhaseRef.current = onPhase;
    onDoneRef.current = onDone;
  }, [onPhase, onDone]);

  useEffect(() => {
    onPhaseRef.current?.(phase);
  }, [phase]);

  // The clock, anchored once. Every handover is scheduled against the
  // moment the overlay opened rather than against the previous timer, so
  // a re-render in the middle of a phase cannot push the end out: the
  // whole thing is fifteen seconds, always.
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      const done = setTimeout(() => onDoneRef.current?.(), 2600);
      return () => {
        clearTimeout(done);
      };
    }

    startedAt.current ??= performance.now();

    if (phase === 'done') {
      onDoneRef.current?.();
      return;
    }

    const index = PHASES.findIndex((entry) => entry.key === phase);
    if (index < 0) return;

    const next = PHASES[index + 1];
    const dueAt = startedAt.current + (BOUNDARIES[index] ?? 0);
    const timer = setTimeout(
      () => {
        setPhase(next ? next.key : 'done');
      },
      Math.max(0, dueAt - performance.now()),
    );

    return () => {
      clearTimeout(timer);
    };
  }, [phase, reduced]);

  // The fragments are drawn rather than laid out: a thousand elements
  // moving at once is a thousand things for the layout engine to do
  // every frame, and a canvas has to do none of it. Progress comes off
  // the same anchored clock, so they finish landing as the phase ends.
  useEffect(() => {
    if (!reached('assemble')) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CARD_W * ratio);
    canvas.height = Math.round(CARD_H * ratio);
    ctx.scale(ratio, ratio);

    const fragments = buildFragments(wikidataId, groundColor, accentColor);

    // Past the phase there is nothing left to animate, only a card that
    // has to be there. A hidden tab suspends requestAnimationFrame, so
    // coming back to a blank card is otherwise exactly what happens.
    if (phase !== 'assemble') {
      paint(ctx, fragments, groundColor, 1);
      return;
    }

    const from = (startedAt.current ?? performance.now()) + ASSEMBLE_FROM;
    let frame = requestAnimationFrame(function step(now: number) {
      const progress = Math.min(Math.max((now - from) / ASSEMBLE_MS, 0), 1);
      paint(ctx, fragments, groundColor, progress);
      if (progress < 1) frame = requestAnimationFrame(step);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [phase, reached, wikidataId, groundColor, accentColor]);

  const caption = ((): string => {
    if (reduced) return 'Angelegt';
    switch (phase) {
      case 'dim':
        return 'Wird angelegt';
      case 'assemble':
        return 'Die Karte setzt sich zusammen';
      case 'title':
        return 'Der Titel wird gesetzt';
      case 'unroll':
        return posterUrl ? 'Das Plakat wird abgerollt' : 'TheTVDB hat kein Plakat';
      case 'flip':
        return 'Die Karte wird gewendet';
      default:
        return 'Fertig';
    }
  })();

  const faceStyle = {
    position: 'absolute' as const,
    inset: 0,
    backfaceVisibility: 'hidden' as const,
    borderRadius: 10,
    overflow: 'hidden' as const,
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div style={{ perspective: 1200 }}>
        <div
          role="img"
          aria-label={`Karte für ${title} wird angelegt`}
          className="shadow-2xl"
          style={{
            position: 'relative',
            width: CARD_W,
            height: CARD_H,
            borderRadius: 10,
            transformStyle: 'preserve-3d',
            // The turn is around the vertical axis, so the card sweeps
            // sideways rather than tumbling end over end.
            transform: reached('flip') ? 'rotateY(180deg)' : 'rotateY(0deg)',
            opacity: reached('assemble') ? 1 : 0,
            transition: reduced
              ? 'none'
              : `transform ${String(FLIP_MS)}ms cubic-bezier(.65,0,.35,1), opacity 500ms ease-out`,
          }}
        >
          {/* Front: the card while it is being made. */}
          <div style={faceStyle}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

            <svg
              viewBox={`0 0 ${String(layers.width)} ${String(layers.height)}`}
              width="100%"
              height="100%"
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0 }}
            >
              <defs dangerouslySetInnerHTML={{ __html: layers.defs }} />

              {/* The texture arrives as the last fragments land. */}
              <g
                style={{
                  opacity: reached('assemble') ? 1 : 0,
                  transition: 'opacity 700ms ease-out 2300ms',
                }}
                dangerouslySetInnerHTML={{ __html: layers.pattern }}
              />

              <g fontFamily={layers.fontFamily}>
                {layers.titleLines.map((line, index) => {
                  const step = TITLE_MS / (layers.titleLines.length + 1);
                  const delay = String(Math.round(index * step));
                  const span = String(Math.round(step * 1.6));
                  return (
                    <g
                      key={index}
                      style={{
                        opacity: reached('title') ? 1 : 0,
                        filter: reached('title') ? 'blur(0px)' : 'blur(5px)',
                        transform: reached('title') ? 'translateY(0)' : 'translateY(12px)',
                        transition:
                          `opacity ${span}ms ease-out ${delay}ms,` +
                          ` filter ${span}ms ease-out ${delay}ms,` +
                          ` transform ${span}ms cubic-bezier(.2,.8,.2,1) ${delay}ms`,
                      }}
                      dangerouslySetInnerHTML={{ __html: line }}
                    />
                  );
                })}

                {/* Year and director close the card off in the fourth
                    beat, which is what that beat is for when TheTVDB has
                    nothing to unroll. */}
                <g
                  style={{
                    opacity: reached('unroll') ? 1 : 0,
                    transition: 'opacity 900ms ease-out',
                  }}
                  dangerouslySetInnerHTML={{ __html: layers.rule + layers.meta }}
                />
              </g>
            </svg>

            {posterUrl ? (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    // Inset from the top: the visible area grows upward
                    // out of the bottom edge, the way a poster unrolls.
                    clipPath: reached('unroll') ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)',
                    transition: `clip-path ${String(UNROLL_MS)}ms linear`,
                  }}
                >
                  <img
                    src={posterUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: ROLL_EDGE,
                    background:
                      'linear-gradient(to bottom, rgba(0,0,0,.5), rgba(255,255,255,.2) 62%,' +
                      ' rgba(255,255,255,0))',
                    transform: reached('unroll')
                      ? `translateY(${String(-ROLL_EDGE)}px)`
                      : `translateY(${String(CARD_H)}px)`,
                    opacity: reached('unroll') && !reached('flip') ? 1 : 0,
                    transition: `transform ${String(UNROLL_MS)}ms linear, opacity 400ms ease-out`,
                  }}
                />
              </>
            ) : null}
          </div>

          {/* Back: the finished card, which is what the turn reveals and
              what the list will show from here on. */}
          <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
            {posterUrl ? (
              <img
                src={posterUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="[&>svg]:h-full [&>svg]:w-full"
                style={{ width: '100%', height: '100%' }}
                dangerouslySetInnerHTML={{ __html: finishedCard }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p aria-live="polite" className="text-muted-foreground h-5 text-sm">
          {caption}
        </p>
        <p className="text-muted-foreground/60 h-4 text-xs">Esc überspringt</p>
      </div>
    </div>
  );
}
