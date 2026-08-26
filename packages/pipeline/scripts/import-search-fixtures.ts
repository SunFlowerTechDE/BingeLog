/**
 * Imports the films that M3's mandatory search tests need.
 *
 * Not just the five expected answers, but the wrong ones alongside them.
 * A ranking test where only the right film exists proves nothing: every
 * ranking puts the only candidate first. The distractors here are the
 * actual failures TheTVDB's title search produced (ADR-003) — the 1968
 * television Solaris, the documentary about The Third Man, and whatever
 * else Wikidata offers under the same titles.
 *
 *   node --experimental-strip-types --env-file=.env scripts/import-search-fixtures.ts
 */
import { Client } from 'pg';

import { findFilmIdsByTitle } from '../src/wikidata/api.ts';
import { importFilmsByIds } from '../src/wikidata/seed.ts';

const TERMS = [
  'Solaris',
  'Die Wand',
  'Der dritte Mann',
  'The Third Man',
  'Shoplifters',
  'Jeder für sich und Gott gegen alle',
  'Amrum',
  'Das Kanu des Manitu',
  'Der Himmel über Berlin',
];

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error('SUPABASE_DB_URL is not set.');

const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

const ids = new Set<string>();

for (const term of TERMS) {
  const found = await findFilmIdsByTitle(term, { limit: 8 });
  for (const id of found) ids.add(id);
  console.log(`${term.padEnd(36)} ${String(found.length)} candidate(s)`);
}

console.log(`\nimporting ${String(ids.size)} film(s) with their people and genres`);
const result = await importFilmsByIds(db, [...ids]);

console.log(`films   ${String(result.filmsLoaded)}`);
console.log(`people  ${String(result.people)}`);
console.log(`genres  ${String(result.genres)}`);
console.log(`credits ${String(result.credits)}`);

await db.end();
