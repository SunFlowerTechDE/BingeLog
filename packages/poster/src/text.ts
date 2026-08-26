/**
 * Typesetting for the procedural card.
 *
 * The card is rendered on a server with no layout engine, so the width of
 * a line has to be estimated rather than measured. The estimate is a
 * per-character advance table for a bold grotesque, which is accurate
 * enough for a layout that keeps generous margins and never sets text to
 * the edge of its box.
 *
 * Titles are not captions here: the title is the image (M2 2.1). Long
 * titles shrink and wrap, non-Latin scripts break by character because
 * they carry no spaces.
 */

/** Advance widths in em, approximating a bold grotesque. */
const NARROW = new Set("iljItf().,;:!'\"|[]{}/\\-·");
const WIDE = new Set('mwMW@%');

function isFullWidth(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) || // Hangul Jamo
    (codePoint >= 0x2e80 && codePoint <= 0x303e) || // CJK radicals, punctuation
    (codePoint >= 0x3041 && codePoint <= 0x33ff) || // Kana, CJK compatibility
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK extension A
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK unified ideographs
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) || // Yi
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul syllables
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK compatibility ideographs
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) || // CJK compatibility forms
    (codePoint >= 0xff00 && codePoint <= 0xff60) || // Fullwidth forms
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}

/** True for scripts that break between characters rather than at spaces. */
export function isIdeographic(char: string): boolean {
  const codePoint = char.codePointAt(0);
  return codePoint !== undefined && isFullWidth(codePoint);
}

export function advanceEm(char: string): number {
  if (isIdeographic(char)) return 1;
  if (char === ' ') return 0.26;
  if (NARROW.has(char)) return 0.3;
  if (WIDE.has(char)) return 0.86;
  if (char >= '0' && char <= '9') return 0.56;
  // Uppercase in Latin, Greek and Cyrillic alike.
  if (char !== char.toLowerCase() && char === char.toUpperCase()) return 0.68;
  return 0.55;
}

/** Estimated width of a string at a given font size, in user units. */
export function measure(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) em += advanceEm(char);
  return em * fontSize;
}

/**
 * Splits a title into the smallest units a line break may fall between.
 * Words for space-separated scripts, single characters for ideographic
 * ones, and both at once for a mixed title.
 */
export function tokenize(title: string): string[] {
  const tokens: string[] = [];
  let current = '';

  const flush = () => {
    if (current) tokens.push(current);
    current = '';
  };

  for (const char of title) {
    if (char === ' ') {
      flush();
    } else if (isIdeographic(char)) {
      flush();
      tokens.push(char);
    } else {
      current += char;
    }
  }
  flush();

  return tokens;
}

/**
 * Greedy wrap. A token wider than the line on its own is kept whole and
 * allowed to overflow rather than being broken mid-word; the caller
 * responds by reducing the font size.
 */
export function wrap(title: string, maxWidth: number, fontSize: number): string[] {
  const tokens = tokenize(title);
  const lines: string[] = [];
  let line = '';

  for (const token of tokens) {
    const separator = line === '' || isIdeographic(token) || isIdeographic(line.at(-1) ?? '') ? '' : ' ';
    const candidate = line + separator + token;

    if (line !== '' && measure(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }
  }

  if (line !== '') lines.push(line);
  return lines;
}

export interface FittedText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  /** True when the title had to be cut to fit even at the smallest size. */
  truncated: boolean;
}

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  maxFontSize: number;
  minFontSize: number;
  /** Multiple of the font size. Tight, because the title is the image. */
  leading: number;
  maxLines: number;
}

/**
 * Finds the largest size at which the title fits its box.
 *
 * Steps down in whole units rather than solving for it: the measurement
 * is an estimate, and a smooth optimum on an estimate is false precision.
 */
export function fitTitle(title: string, options: FitOptions): FittedText {
  const { maxWidth, maxHeight, maxFontSize, minFontSize, leading, maxLines } = options;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lines = wrap(title, maxWidth, fontSize);
    const widest = Math.max(...lines.map((line) => measure(line, fontSize)), 0);

    if (lines.length <= maxLines && widest <= maxWidth && lines.length * fontSize * leading <= maxHeight) {
      return { lines, fontSize, lineHeight: fontSize * leading, truncated: false };
    }
  }

  // Nothing fit. Set at the floor, keep as many lines as the box holds,
  // and mark the last one. Losing the tail of a very long title is
  // better than a card whose text runs off the edge.
  const lines = wrap(title, maxWidth, minFontSize);
  const fitting = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (minFontSize * leading))));
  const kept = lines.slice(0, fitting);
  const truncated = kept.length < lines.length;

  if (truncated) {
    const last = kept.length - 1;
    const lastLine = kept[last];
    if (lastLine !== undefined) kept[last] = `${lastLine.replace(/[\s]+$/, '')}…`;
  }

  return { lines: kept, fontSize: minFontSize, lineHeight: minFontSize * leading, truncated };
}
