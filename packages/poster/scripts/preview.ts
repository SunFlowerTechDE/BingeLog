/**
 * Renders a contact sheet of procedural cards and writes it to
 * data/preview.html, so the grid can actually be looked at.
 *
 * The M2 Definition of Done asks whether 50 cards look coherent at 120 px
 * width. That is not a question a unit test can answer.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { renderPosterSVG, type PosterInput } from '../src/render.ts';
import { SAMPLE_FILMS } from '../tests/samples.ts';

const OUT_DIR = path.join(import.meta.dirname, '..', 'data');

function section(heading: string, films: PosterInput[], tileWidth: number): string {
  const tiles = films
    .map(
      (film) =>
        `<figure style="width:${String(tileWidth)}px">` +
        `<div class="tile">${renderPosterSVG(film)}</div>` +
        `<figcaption>${film.title}</figcaption>` +
        `</figure>`,
    )
    .join('');

  return `<h2>${heading} <span>${String(tileWidth)} px</span></h2><div class="grid">${tiles}</div>`;
}

const page = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>BingeLog — Kartenvorschau</title>
<style>
  body { background:#0f1114; color:#e8eaed; font:14px/1.5 -apple-system, system-ui, sans-serif;
         margin:0; padding:32px; }
  h2 { font-size:15px; font-weight:600; letter-spacing:.02em; margin:36px 0 14px;
       border-bottom:1px solid #262a30; padding-bottom:8px; }
  h2 span { color:#767d8a; font-weight:400; }
  .grid { display:flex; flex-wrap:wrap; gap:18px; align-items:flex-start; }
  .tile svg { width:100%; height:auto; display:block; border-radius:3px; }
  figcaption { color:#767d8a; font-size:10px; margin-top:6px; line-height:1.3;
               overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
</style></head><body>
<h1 style="font-size:18px;font-weight:600;margin:0">Prozedurale Karten (M2 2.1)</h1>
${section('Rastergröße', SAMPLE_FILMS, 120)}
${section('Detailgröße', SAMPLE_FILMS.slice(0, 12), 220)}
</body></html>`;

await mkdir(OUT_DIR, { recursive: true });
const out = path.join(OUT_DIR, 'preview.html');
await writeFile(out, page);
console.log(`wrote ${out}`);
