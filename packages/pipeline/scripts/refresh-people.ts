/**
 * Re-reads every person and genre name from Wikidata.
 *
 *   pnpm --filter @binge-log/pipeline refresh:people
 *
 * Written for a specific failure and kept because it will recur: name
 * selection changed, and every row imported under the old rule was
 * wrong. Wikidata had moved names that read the same everywhere onto the
 * `mul` label, so people with ninety labels had neither `en` nor `de`
 * among them and the importer fell through to an arbitrary script — a
 * German film page credited كريستوفر نولان for Christopher Nolan.
 *
 * Cheap enough to run whenever the extraction changes: fifty ids per
 * request, so a thousand people is twenty calls.
 */
import { Client } from 'pg';

import { fetchEntities } from '../src/wikidata/api.ts';
import { extractNamedEntity } from '../src/wikidata/extract.ts';

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error('SUPABASE_DB_URL is not set.');

const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows: people } = await db.query<{ wikidata_id: string; name: string }>(
  'select wikidata_id, name from public.people order by wikidata_id',
);
const { rows: genres } = await db.query<{ wikidata_id: string; label_de: string | null }>(
  'select wikidata_id, label_de from public.genres order by wikidata_id',
);

console.log(`${String(people.length)} people, ${String(genres.length)} genres`);

const before = new Map(people.map((row) => [row.wikidata_id, row.name]));
let changed = 0;

const BATCH = 200;
const ids = people.map((row) => row.wikidata_id);

for (let offset = 0; offset < ids.length; offset += BATCH) {
  const entities = await fetchEntities(ids.slice(offset, offset + BATCH));

  for (const entity of entities) {
    const named = extractNamedEntity(entity);
    if (!named) continue;

    const previous = before.get(named.wikidataId);
    if (previous === named.name) continue;

    await db.query('update public.people set name = $2, sitelink_count = $3 where wikidata_id = $1', [
      named.wikidataId,
      named.name,
      named.sitelinkCount,
    ]);

    console.log(`  ${named.wikidataId}: ${previous ?? '?'} -> ${named.name}`);
    changed++;
  }

  process.stdout.write(`\r  ${String(Math.min(offset + BATCH, ids.length))}/${String(ids.length)}\n`);
}

const genreEntities = await fetchEntities(genres.map((row) => row.wikidata_id));
for (const entity of genreEntities) {
  const named = extractNamedEntity(entity);
  if (!named) continue;
  await db.query('update public.genres set label_de = $2, label_en = $3 where wikidata_id = $1', [
    named.wikidataId,
    named.nameDe,
    named.nameEn,
  ]);
}

console.log(`\n${String(changed)} name(s) corrected`);
await db.end();
