/**
 * Renders the catalog as a contact sheet: real TheTVDB posters and
 * procedural cards side by side, at the size the app actually uses.
 *
 * This answers the M2 Definition of Done question that no unit test can:
 * do the two kinds of tile sit together without one looking like a
 * stopgap? The generated card is meant to be an equal state, not a
 * placeholder (ADR-004, 02-product.md).
 *
 *   node --experimental-strip-types --env-file=.env scripts/preview-catalog.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';
import { renderPosterSVG } from '@binge-log/poster';

interface Row {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_url: string | null;
  director: string | null;
}

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error('SUPABASE_DB_URL is not set.');

const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows } = await db.query<Row>(`
  select f.wikidata_id, f.title_de, f.title_original, f.release_year, f.poster_url,
         (select p.name
          from public.film_credits c
          join public.people p on p.wikidata_id = c.person_id
          where c.film_id = f.wikidata_id and c.role = 'director'
          order by c.ord limit 1) as director
  from public.films f
  order by f.sitelink_count desc
`);
await db.end();

function tile(row: Row, forceGenerated: boolean): string {
  const title = row.title_de ?? row.title_original;

  const art =
    !forceGenerated && row.poster_url
      ? `<img src="${row.poster_url}" alt="" loading="lazy">`
      : renderPosterSVG({
          wikidataId: row.wikidata_id,
          title,
          releaseYear: row.release_year,
          director: row.director,
        });

  const badge = !forceGenerated && row.poster_url ? 'TheTVDB' : 'generiert';
  return `<figure><div class="tile">${art}</div><figcaption>${badge}</figcaption></figure>`;
}

// Alternating, so the eye has to compare rather than see two blocks.
const mixed = rows.map((row, index) => tile(row, index % 2 === 1)).join('');
const real = rows.map((row) => tile(row, false)).join('');
const generated = rows.map((row) => tile(row, true)).join('');

const page = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>BingeLog — Katalogvorschau</title>
<style>
  body { background:#0f1114; color:#e8eaed; font:13px/1.5 -apple-system, system-ui, sans-serif;
         margin:0; padding:28px; }
  h2 { font-size:14px; font-weight:600; margin:32px 0 12px; border-bottom:1px solid #262a30;
       padding-bottom:7px; }
  h2 span { color:#767d8a; font-weight:400; }
  .grid { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-start; }
  figure { width:120px; margin:0; }
  .tile { aspect-ratio:2/3; overflow:hidden; border-radius:3px; background:#1a1d22; }
  .tile img, .tile svg { width:100%; height:100%; object-fit:cover; display:block; }
  figcaption { color:#5f6672; font-size:9px; margin-top:4px; letter-spacing:.04em; }
</style></head><body>
<h1 style="font-size:17px;font-weight:600;margin:0">Katalog bei 120 px <span style="color:#767d8a;font-weight:400">${String(rows.length)} Filme</span></h1>
<h2>Gemischt <span>abwechselnd echt und generiert — der eigentliche Test</span></h2>
<div class="grid">${mixed}</div>
<h2>Nur TheTVDB</h2>
<div class="grid">${real}</div>
<h2>Nur generiert</h2>
<div class="grid">${generated}</div>
</body></html>`;

const outDir = path.join(import.meta.dirname, '..', 'data');
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, 'catalog-preview.html');
await writeFile(out, page);
console.log(`wrote ${out} (${String(rows.length)} films)`);
