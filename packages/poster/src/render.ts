/**
 * M2 2.1 — the procedural card.
 *
 * A deterministic typographic poster for every film in the catalog, so
 * the app is fully usable without TheTVDB (ADR-004). This is not a
 * placeholder: a generated card and a real poster stand next to each
 * other in the same grid as equals (02-product.md).
 *
 * Rendered server-side as SVG and cached by the client, identical on web,
 * iOS and Android. Reimplementing it natively three times would guarantee
 * that the same film looks different on three devices (ADR-012).
 */
import { hash32, pick, seededRandom } from './hash.ts';
import { PALETTES, type PosterPalette } from './palette.ts';
import { fitTitle, measure } from './text.ts';

export interface PosterInput {
  /** The seed. Same id in, same card out, always. */
  wikidataId: string;
  /** German title where there is one, original title otherwise. */
  title: string;
  releaseYear?: number | null;
  /** Director name. One is enough; the card is not a credits list. */
  director?: string | null;
}

/**
 * 2:3, the format of a film poster. All geometry below is in these user
 * units and scales with the rendered size.
 */
const WIDTH = 400;
const HEIGHT = 600;

const MARGIN = 34;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;

/**
 * The stack is deliberately broad: the card has to set Latin, Cyrillic
 * and CJK, and no single embeddable subset covers all three at a size
 * worth shipping in every tile. Layout keeps generous margins so a
 * different fallback metric shifts the line without breaking it.
 */
const FONT_STACK =
  "'Helvetica Neue', Helvetica, 'Segoe UI', 'Noto Sans', 'Hiragino Sans', " +
  "'Yu Gothic', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * A quiet generative texture on the same seed.
 *
 * Concentric arcs anchored at one of the four corners. The parameters
 * vary per film, the visual weight does not: the same ring count, the
 * same hairline stroke, the same near-background colour every time. That
 * is the point of a system — a grid of these should read as one family,
 * and no single card should announce itself.
 *
 * The earlier version drew randomly sized circles with heavy strokes. On
 * a contact sheet the arcs became the dominant element and the title read
 * as a caption on a pattern, which is precisely what M2 2.1 rules out.
 *
 * At 120 px the texture all but disappears, which is correct: at that
 * size contrast carries the tile, not detail (02-product.md).
 */
function renderPattern(seed: number, palette: PosterPalette): string {
  const random = seededRandom(seed);

  const corners = [
    { x: 0, y: 0 },
    { x: WIDTH, y: 0 },
    { x: 0, y: HEIGHT },
    { x: WIDTH, y: HEIGHT },
  ] as const;
  const anchor = corners[seed % corners.length] ?? corners[0];

  // A little drift off the corner so the rings are not perfectly
  // symmetric, bounded so the motif never migrates to the centre.
  const cx = anchor.x + (anchor.x === 0 ? 1 : -1) * Math.round(random() * WIDTH * 0.22);
  const cy = anchor.y + (anchor.y === 0 ? 1 : -1) * Math.round(random() * HEIGHT * 0.14);

  const base = WIDTH * (0.3 + random() * 0.16);
  const spacing = WIDTH * (0.15 + random() * 0.07);

  const rings = Array.from({ length: 5 }, (_, index) => {
    const r = Math.round(base + index * spacing);
    return (
      `<circle cx="${String(cx)}" cy="${String(cy)}" r="${String(r)}" ` +
      `fill="none" stroke="${palette.accent}" stroke-width="7"/>`
    );
  });

  return `<g clip-path="url(#frame)">${rings.join('')}</g>`;
}

/**
 * The card taken apart.
 *
 * Same geometry, same palette, same order — just handed over in pieces
 * so a caller can reveal them one at a time. The build order is not a
 * presentation choice: it is how the card is actually composed, ground
 * first and type last, and an animation that follows it shows what is
 * happening rather than decorating it.
 */
export interface PosterLayers {
  width: number;
  height: number;
  palette: PosterPalette;
  /** clipPath the pattern needs. */
  defs: string;
  background: string;
  pattern: string;
  /** One string per line of the title, in reading order. */
  titleLines: string[];
  rule: string;
  meta: string;
  /** Font stack the text layers expect on their group. */
  fontFamily: string;
  /** True when the title had to be cut to fit. */
  truncated: boolean;
}

export function posterLayers(film: PosterInput): PosterLayers {
  const seed = hash32(film.wikidataId);
  const palette = pick(PALETTES, seed);

  // The block of metadata at the foot sets the height the title may use.
  const footTop = HEIGHT - MARGIN - 46;

  // The block is set from its bottom edge upward, so the height it may
  // occupy is exactly the distance from that edge to the top margin.
  const titleBottom = footTop - MARGIN * 1.5;

  const title = fitTitle(film.title.trim(), {
    maxWidth: CONTENT_WIDTH,
    maxHeight: titleBottom - MARGIN,
    maxFontSize: 62,
    minFontSize: 19,
    leading: 1.06,
    maxLines: 7,
  });

  // Short and long titles share the same bottom edge, so the type sits on
  // one line across the grid regardless of how many rows it needs.
  const titleTop = titleBottom - title.lines.length * title.lineHeight;

  const titleLines = title.lines.map((line, index) => {
    const y = titleTop + (index + 0.78) * title.lineHeight;
    const attributes = [
      `x="${String(MARGIN)}"`,
      `y="${String(Math.round(y))}"`,
      `font-size="${String(title.fontSize)}"`,
      'font-weight="700"',
      'letter-spacing="-0.015em"',
      `fill="${palette.title}"`,
    ].join(' ');
    return `<text ${attributes}>${escapeXml(line)}</text>`;
  });

  const year = film.releaseYear ? String(film.releaseYear) : '';
  const director = film.director?.trim() ?? '';

  // Year and director on one line, separated by a rule rather than a
  // bullet: no icons, no symbols (M2 2.1, "Nicht tun").
  const metaParts: string[] = [];
  const metaFontSize = 15;
  let cursor = MARGIN;

  if (year) {
    metaParts.push(
      `<text x="${String(cursor)}" y="${String(HEIGHT - MARGIN - 14)}" font-size="${String(metaFontSize)}" ` +
        `font-weight="600" letter-spacing="0.14em" fill="${palette.secondary}">${escapeXml(year)}</text>`,
    );
    cursor += measure(year, metaFontSize) + metaFontSize * 0.14 * year.length + 16;
  }

  if (director) {
    const available = WIDTH - MARGIN - cursor;
    const fitted = fitTitle(director, {
      maxWidth: available,
      maxHeight: metaFontSize * 1.4,
      maxFontSize: metaFontSize,
      minFontSize: 10,
      leading: 1.2,
      maxLines: 1,
    });
    const line = fitted.lines[0] ?? '';
    if (line) {
      metaParts.push(
        `<text x="${String(Math.round(cursor))}" y="${String(HEIGHT - MARGIN - 14)}" ` +
          `font-size="${String(fitted.fontSize)}" font-weight="500" letter-spacing="0.04em" ` +
          `fill="${palette.secondary}">${escapeXml(line)}</text>`,
      );
    }
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    palette,
    defs: `<clipPath id="frame"><rect width="${String(WIDTH)}" height="${String(HEIGHT)}"/></clipPath>`,
    background: `<rect width="${String(WIDTH)}" height="${String(HEIGHT)}" fill="${palette.background}"/>`,
    pattern: renderPattern(seed, palette),
    titleLines,
    rule:
      `<rect x="${String(MARGIN)}" y="${String(footTop - 2)}" width="${String(Math.round(CONTENT_WIDTH * 0.22))}" ` +
      `height="2" fill="${palette.secondary}" opacity="0.55"/>`,
    meta: metaParts.join(''),
    fontFamily: FONT_STACK,
    truncated: title.truncated,
  };
}

export function renderPosterSVG(film: PosterInput): string {
  const layers = posterLayers(film);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(layers.width)} ${String(layers.height)}" ` +
    `width="${String(layers.width)}" height="${String(layers.height)}" role="img" ` +
    `aria-label="${escapeXml(film.title)}">` +
    `<defs>${layers.defs}</defs>` +
    layers.background +
    layers.pattern +
    `<g font-family="${layers.fontFamily}">${layers.titleLines.join('')}${layers.rule}${layers.meta}</g>` +
    `</svg>`
  );
}

/** Convenience for embedding the card directly in an img src. */
export function renderPosterDataUri(film: PosterInput): string {
  return `data:image/svg+xml;base64,${Buffer.from(renderPosterSVG(film), 'utf8').toString('base64')}`;
}
