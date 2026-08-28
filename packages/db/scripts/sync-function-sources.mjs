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
const PIPELINE = path.join(HERE, '..', '..', 'pipeline', 'src');
const SHARED = path.join(HERE, '..', 'supabase', 'functions', '_shared');

const HEADER = `/*
 * GENERATED — do not edit.
 *
 * Copied from packages/pipeline/src/wikidata by
 * packages/db/scripts/sync-function-sources.mjs. Change the original.
 */
`;

const FILES = [
  ['wikidata', 'extract.ts'],
  ['wikidata', 'api.ts'],
  ['wikidata', 'types.ts'],
  ['tvdb', 'client.ts'],
];

for (const [folder, name] of FILES) {
  await mkdir(path.join(SHARED, folder), { recursive: true });
  const source = await readFile(path.join(PIPELINE, folder, name), 'utf8');
  await writeFile(path.join(SHARED, folder, name), HEADER + source);
}

// The subclass closure is data, not code, and is copied as it is.
await copyFile(
  path.join(PIPELINE, 'wikidata', 'film-subclasses.json'),
  path.join(SHARED, 'wikidata', 'film-subclasses.json'),
);

console.log(
  `synced ${String(FILES.length + 1)} file(s) into ${path.relative(process.cwd(), SHARED)}`,
);
