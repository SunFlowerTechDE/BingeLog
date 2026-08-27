/**
 * Copies the shared Wikidata code into the edge function tree.
 *
 * Supabase uploads a function by following its imports, and it will not
 * step outside supabase/functions — a relative path into
 * packages/pipeline fails with "invalid argument". So the files are
 * copied in before every deploy.
 *
 * The copies are generated and gitignored. Keeping a second edited
 * version of the extractor would mean two readings of the same Wikidata
 * entity with tests covering only one of them, which is the failure this
 * whole arrangement exists to avoid.
 */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const HERE = import.meta.dirname;
const FROM = path.join(HERE, '..', '..', 'pipeline', 'src', 'wikidata');
const TO = path.join(HERE, '..', 'supabase', 'functions', '_shared', 'wikidata');

const HEADER = `/*
 * GENERATED — do not edit.
 *
 * Copied from packages/pipeline/src/wikidata by
 * packages/db/scripts/sync-function-sources.mjs. Change the original.
 */
`;

await mkdir(TO, { recursive: true });

for (const name of ['extract.ts', 'api.ts', 'types.ts']) {
  const source = await readFile(path.join(FROM, name), 'utf8');
  await writeFile(path.join(TO, name), HEADER + source);
}

// The subclass closure is data, not code, and is copied as it is.
await copyFile(path.join(FROM, 'film-subclasses.json'), path.join(TO, 'film-subclasses.json'));

console.log(`synced 4 file(s) into ${path.relative(process.cwd(), TO)}`);
