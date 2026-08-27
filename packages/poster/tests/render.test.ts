/**
 * M2 2.1 — the procedural card.
 *
 * These tests pin the requirements the roadmap states outright. What they
 * cannot answer is whether a grid of these looks like one system; that
 * question is settled by looking at scripts/preview.ts, not here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderPosterSVG, posterLayers } from '../src/render.ts';
import { posterVersion } from '../src/version.ts';
import { PALETTES } from '../src/palette.ts';
import { hash32, seededRandom } from '../src/hash.ts';
import { fitTitle, measure, tokenize, wrap } from '../src/text.ts';
import { HARD_CASES, SAMPLE_FILMS } from './samples.ts';

const WIDTH = 400;
const HEIGHT = 600;
const MARGIN = 34;

describe('determinism', () => {
  it('renders the same card for the same id, every time', () => {
    const film = { wikidataId: 'Q125772', title: 'Солярис', releaseYear: 1972 };
    assert.equal(renderPosterSVG(film), renderPosterSVG(film));
  });

  it('does not depend on anything outside its input', () => {
    // A card that changed between renders could not be cached, and would
    // look different on three devices (ADR-012).
    const first = renderPosterSVG({ wikidataId: 'Q1', title: 'Test' });
    const second = renderPosterSVG({ wikidataId: 'Q1', title: 'Test' });
    assert.equal(first, second);
  });

  it('gives different films different cards', () => {
    const a = renderPosterSVG({ wikidataId: 'Q1', title: 'Test' });
    const b = renderPosterSVG({ wikidataId: 'Q2', title: 'Test' });
    assert.notEqual(a, b);
  });

  it('hashes stably across runs', () => {
    assert.equal(hash32('Q125772'), hash32('Q125772'));
    assert.notEqual(hash32('Q125772'), hash32('Q125773'));
  });

  it('seeds its generator reproducibly', () => {
    const a = Array.from({ length: 5 }, seededRandom(42));
    const b = Array.from({ length: 5 }, seededRandom(42));
    assert.deepEqual(a, b);
  });
});

describe('the palette', () => {
  it('offers between 8 and 12 pairs', () => {
    assert.ok(PALETTES.length >= 8 && PALETTES.length <= 12, `got ${String(PALETTES.length)}`);
  });

  it('meets WCAG AA for the title on its background', () => {
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (hex: string) =>
      0.2126 * channel(parseInt(hex.slice(1, 3), 16)) +
      0.7152 * channel(parseInt(hex.slice(3, 5), 16)) +
      0.0722 * channel(parseInt(hex.slice(5, 7), 16));
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
    };

    for (const [index, palette] of PALETTES.entries()) {
      // Contrast is what carries a 120 px tile, not detail.
      assert.ok(
        contrast(palette.background, palette.title) >= 4.5,
        `palette ${String(index)}: title contrast too low`,
      );
      assert.ok(
        contrast(palette.background, palette.secondary) >= 3,
        `palette ${String(index)}: secondary contrast too low`,
      );
    }
  });

  it('spreads films across the whole palette', () => {
    const used = new Set(
      SAMPLE_FILMS.map((film) => {
        const match = /<rect width="400" height="600" fill="(#[0-9a-f]{6})"/.exec(
          renderPosterSVG(film),
        );
        return match?.[1];
      }),
    );
    assert.ok(used.size >= 8, `only ${String(used.size)} palettes used across the sample`);
  });
});

describe('the format', () => {
  it('is 2:3', () => {
    const svg = renderPosterSVG({ wikidataId: 'Q1', title: 'Test' });
    assert.match(svg, /viewBox="0 0 400 600"/);
  });

  it('carries the title as its accessible name', () => {
    const svg = renderPosterSVG({ wikidataId: 'Q1', title: 'Die Wand' });
    assert.match(svg, /aria-label="Die Wand"/);
  });

  it('escapes a title that would otherwise break the document', () => {
    const svg = renderPosterSVG({
      wikidataId: 'Q1',
      title: 'Fish & <script>alert("x")</script>',
    });
    assert.ok(!svg.includes('<script>'), 'markup in a title must not survive as markup');
    assert.match(svg, /Fish &amp;/);
  });
});

describe('what the card must never contain', () => {
  const svgs = SAMPLE_FILMS.map(renderPosterSVG);

  it('has no emoji and no icons', () => {
    for (const svg of svgs) {
      assert.ok(
        !/\p{Extended_Pictographic}/u.test(svg),
        'no emoji, no icons, no genre symbols (M2 2.1)',
      );
    }
  });

  it('never says that an image is missing', () => {
    for (const svg of svgs) {
      assert.ok(!/kein bild|no image|placeholder/i.test(svg));
    }
  });

  it('references no external asset', () => {
    for (const svg of svgs) {
      // The SVG namespace declaration is a name, not a fetch, so it does
      // not count as an external reference.
      const withoutNamespace = svg.replace('xmlns="http://www.w3.org/2000/svg"', '');
      assert.ok(
        !/<image|xlink:href|https?:\/\//.test(withoutNamespace),
        'the card is self-contained',
      );
    }
  });
});

describe('long titles', () => {
  for (const film of HARD_CASES) {
    it(`fits "${film.title}" inside its box`, () => {
      const svg = renderPosterSVG(film);
      const texts = [...svg.matchAll(/<text x="(\d+)" y="(\d+)" font-size="(\d+)"/g)];
      assert.ok(texts.length > 0);

      for (const [, x, y] of texts) {
        assert.ok(Number(x) >= MARGIN, 'text starts inside the left margin');
        assert.ok(Number(y) <= HEIGHT - 20, 'text stays above the bottom edge');
        assert.ok(Number(y) >= 0, 'text stays below the top edge');
      }
    });
  }

  it('wraps at word boundaries for Latin scripts', () => {
    const lines = wrap('Jeder für sich und Gott gegen alle', 300, 40);
    assert.ok(lines.length > 1);
    for (const line of lines) {
      assert.ok(!line.startsWith(' ') && !line.endsWith(' '));
    }
    assert.equal(lines.join(' '), 'Jeder für sich und Gott gegen alle');
  });

  it('shrinks rather than overflowing', () => {
    const short = fitTitle('M', { maxWidth: 332, maxHeight: 400, maxFontSize: 62, minFontSize: 19, leading: 1.06, maxLines: 7 });
    const long = fitTitle('Orgullo, Pasión, y Gloria: Tres Noches en la Ciudad de México', {
      maxWidth: 332, maxHeight: 400, maxFontSize: 62, minFontSize: 19, leading: 1.06, maxLines: 7,
    });
    assert.ok(long.fontSize < short.fontSize);
    assert.ok(long.lines.every((line) => measure(line, long.fontSize) <= 332));
  });

  it('truncates only when even the smallest size cannot hold the title', () => {
    const absurd = fitTitle('Wort '.repeat(400).trim(), {
      maxWidth: 332, maxHeight: 400, maxFontSize: 62, minFontSize: 19, leading: 1.06, maxLines: 7,
    });
    assert.equal(absurd.truncated, true);
    assert.ok(absurd.lines.length <= 7);
    assert.match(absurd.lines.at(-1) ?? '', /…$/);
  });
});

describe('non-Latin scripts', () => {
  it('breaks CJK between characters, since it carries no spaces', () => {
    assert.deepEqual(tokenize('万引き家族'), ['万', '引', 'き', '家', '族']);
  });

  it('sets a Japanese title', () => {
    const svg = renderPosterSVG({ wikidataId: 'Q48765577', title: '万引き家族', releaseYear: 2018 });
    assert.match(svg, /万引き家族|万/);
  });

  it('sets a Cyrillic title', () => {
    const svg = renderPosterSVG({ wikidataId: 'Q125772', title: 'Солярис', releaseYear: 1972 });
    assert.match(svg, /Солярис/);
  });

  it('sets a Korean title', () => {
    const svg = renderPosterSVG({ wikidataId: 'Q-parasite', title: '기생충', releaseYear: 2019 });
    assert.match(svg, /기생충/);
  });

  it('measures full-width characters as wider than Latin ones', () => {
    assert.ok(measure('万', 40) > measure('n', 40));
  });

  it('wraps a mixed-script title without losing characters', () => {
    const title = 'Drive My Car ドライブ・マイ・カー';
    const lines = wrap(title, 300, 30);
    const rejoined = lines.join('').replace(/\s+/g, '');
    assert.equal(rejoined, title.replace(/\s+/g, ''));
  });
});

describe('missing metadata', () => {
  it('renders without a year or a director', () => {
    const svg = renderPosterSVG({ wikidataId: 'Q1', title: 'Ohne alles' });
    assert.match(svg, /Ohne alles/);
    assert.match(svg, /viewBox/);
  });

  it('renders with a year but no director', () => {
    const svg = renderPosterSVG({ wikidataId: 'Q1', title: 'Nur Jahr', releaseYear: 1999 });
    assert.match(svg, />1999</);
  });

  it('shortens a director name rather than letting it run off the card', () => {
    const svg = renderPosterSVG({
      wikidataId: 'Q1',
      title: 'Test',
      releaseYear: 2009,
      director: 'Florian Henckel von Donnersmarck und noch jemand dazu',
    });
    const meta = [...svg.matchAll(/<text x="(\d+)" y="\d+" font-size="(\d+)"[^>]*>([^<]*)</g)];
    const last = meta.at(-1);
    assert.ok(last);
    assert.ok(Number(last[1]) + measure(last[3] ?? '', Number(last[2])) <= WIDTH, 'stays on the card');
  });
});

describe('the cache version token', () => {
  it('is stable for the same timestamp', () => {
    const stamp = '2026-08-26T15:00:00.334+00:00';
    assert.equal(posterVersion(stamp), posterVersion(stamp));
  });

  it('changes when the film changes', () => {
    assert.notEqual(
      posterVersion('2026-08-26T15:00:00.334+00:00'),
      posterVersion('2026-08-26T15:00:00.335+00:00'),
    );
  });

  it('does not lose the milliseconds the way Date.parse on a Date does', () => {
    // The bug this replaced: one side parsed the JSON string and kept the
    // milliseconds, the other parsed a Date object and dropped them, so
    // the tokens never matched and immutable was never granted.
    const withMillis = '2026-08-26T15:00:00.334+00:00';
    const withoutMillis = '2026-08-26T15:00:00.000+00:00';
    assert.notEqual(posterVersion(withMillis), posterVersion(withoutMillis));
  });
});

describe('the card taken apart', () => {
  it('composes back into exactly the same card', () => {
    // The layers exist so an animation can reveal them one at a time.
    // If assembling them by hand drifted from renderPosterSVG, the built
    // card would differ from the one the grid shows afterwards.
    for (const film of SAMPLE_FILMS) {
      const layers = posterLayers(film);
      const rebuilt =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(layers.width)} ${String(layers.height)}" ` +
        `width="${String(layers.width)}" height="${String(layers.height)}" role="img" ` +
        `aria-label="${film.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')}">` +
        `<defs>${layers.defs}</defs>` +
        layers.background +
        layers.pattern +
        `<g font-family="${layers.fontFamily}">${layers.titleLines.join('')}${layers.rule}${layers.meta}</g>` +
        `</svg>`;

      assert.equal(rebuilt, renderPosterSVG(film), `mismatch for ${film.title}`);
    }
  });

  it('hands over the layers in the order the card is built', () => {
    const layers = posterLayers(SAMPLE_FILMS[0] ?? { wikidataId: 'Q1', title: 'Test' });

    // Ground first, type last. An animation that follows this shows how
    // the card is made rather than decorating it.
    assert.match(layers.background, /^<rect/);
    assert.match(layers.pattern, /clip-path/);
    assert.ok(layers.titleLines.length > 0);
    assert.match(layers.rule, /^<rect/);
  });

  it('carries the palette, so a caller can tint the frame it draws', () => {
    const layers = posterLayers({ wikidataId: 'Q125772', title: 'Solaris' });
    assert.match(layers.palette.background, /^#[0-9a-f]{6}$/);
    assert.match(layers.palette.title, /^#[0-9a-f]{6}$/);
  });
});
