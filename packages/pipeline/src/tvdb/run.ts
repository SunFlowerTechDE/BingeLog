/**
 * Entry point for the artwork batch (M2 2.2).
 *
 *   pnpm --filter @binge-log/pipeline artwork:tvdb
 *   pnpm --filter @binge-log/pipeline artwork:tvdb -- --limit 100
 */
import { Client } from 'pg';

import { markUnmatchable, runArtworkBatch, formatProgress } from './batch.ts';
import { createTvdbClient } from './client.ts';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See packages/pipeline/.env.example.`);
  return value;
}

const limitArgument = process.argv.indexOf('--limit');
const limit = limitArgument === -1 ? undefined : Number(process.argv[limitArgument + 1]);

const db = new Client({
  connectionString: requireEnv('SUPABASE_DB_URL'),
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const tvdb = createTvdbClient({
  apiKey: requireEnv('TVDB_API_KEY'),
  pin: process.env.TVDB_PIN ?? undefined,
});

const { rows } = await db.query<{ pending: string }>(
  `select count(*) as pending from public.films
   where imdb_id is not null and poster_source is null`,
);
console.log(
  `pending: ${rows[0]?.pending ?? '0'} film(s) with an IMDb id and no artwork decision\n`,
);

const progress = await runArtworkBatch(db, tvdb, {
  ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
  onProgress: (p) => {
    process.stdout.write(
      `\r  ${String(p.processed)} processed, ${String(p.matched)} matched, ${String(p.failed)} failed`,
    );
  },
});

const unmatchable = await markUnmatchable(db);
if (unmatchable > 0) {
  console.log(`\n  ${String(unmatchable)} film(s) without an IMDb id set to 'generated'`);
}

console.log(`\n\n${formatProgress(progress)}`);
console.log(`\nTheTVDB requests: ${String(tvdb.requestCount())}`);

await db.end();
