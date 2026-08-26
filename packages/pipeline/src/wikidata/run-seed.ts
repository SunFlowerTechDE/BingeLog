/**
 * Builds the base catalog (M1).
 *
 *   pnpm --filter @binge-log/pipeline catalog:seed
 *   pnpm --filter @binge-log/pipeline catalog:seed -- --min-sitelinks 20
 *   pnpm --filter @binge-log/pipeline catalog:seed -- --limit 200
 */
import { Client } from 'pg';

import { seedCatalog } from './seed.ts';
import { formatStats } from './load.ts';

function numericArgument(name: string): number | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error('SUPABASE_DB_URL is not set. See packages/pipeline/.env.example.');

const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

const started = process.hrtime.bigint();

const limit = numericArgument('limit');

const result = await seedCatalog(db, {
  minSitelinks: numericArgument('min-sitelinks') ?? 10,
  ...(limit === undefined ? {} : { limit }),
  onProgress: (message) => {
    console.log(message);
  },
});

const seconds = Number(process.hrtime.bigint() - started) / 1e9;

console.log(`\n${formatStats(result)}`);
console.log(`people            ${String(result.people)}`);
console.log(`genres            ${String(result.genres)}`);
console.log(`credits           ${String(result.credits)}`);
console.log(`genre links       ${String(result.genreLinks)}`);
console.log(`\nruntime           ${seconds.toFixed(1)} s`);

await db.end();
