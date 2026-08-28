/**
 * Freezes the current catalog as a test fixture.
 *
 * The five search cases M3 makes mandatory only mean something with the
 * wrong answers present too, and those wrong answers are real Wikidata
 * films with real sitelink counts. Hand-written fixtures would encode
 * what the author expected rather than what the data does.
 *
 *   node --experimental-strip-types --env-file=.env scripts/export-catalog-fixture.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error('SUPABASE_DB_URL is not set.');

const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

const films = (
  await db.query(`select wikidata_id, imdb_id, tvdb_id, title_original, title_de, title_en,
                         release_year, runtime_min, sitelink_count, poster_source, poster_url
                  from public.films order by wikidata_id`)
).rows;

// Only the people a credit points at, so the fixture stays small.
const people = (
  await db.query(`select distinct p.wikidata_id, p.name, p.sitelink_count
                  from public.people p
                  join public.film_credits c on c.person_id = p.wikidata_id
                  order by p.wikidata_id`)
).rows;

const genres = (
  await db.query(`select wikidata_id, label_de, label_en from public.genres order by wikidata_id`)
).rows;
const credits = (
  await db.query(
    `select film_id, person_id, role, ord from public.film_credits order by film_id, role, ord`,
  )
).rows;
const filmGenres = (
  await db.query(`select film_id, genre_id from public.film_genres order by film_id, genre_id`)
).rows;

await db.end();

const out = path.join(import.meta.dirname, '..', '..', 'db', 'tests', 'fixtures');
await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, 'catalog.json'),
  `${JSON.stringify(
    {
      $comment:
        'Frozen from the live catalog by packages/pipeline/scripts/export-catalog-fixture.ts. ' +
        'Real Wikidata rows, including the near-miss titles the search tests need.',
      films,
      people,
      genres,
      credits,
      filmGenres,
    },
    null,
    1,
  )}\n`,
);

console.log(
  `films ${String(films.length)}, people ${String(people.length)}, genres ${String(genres.length)}, credits ${String(credits.length)}`,
);
