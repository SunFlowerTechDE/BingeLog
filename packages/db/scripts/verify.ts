/**
 * M0 Definition of Done — schema checks against the linked project.
 *
 *   pnpm --filter @binge-log/db verify
 *
 * The local schema harness proves the migrations are correct. This proves
 * the project they were pushed to actually looks the way they describe,
 * including the parts the harness cannot cover — pg_cron above all.
 *
 * Needs SUPABASE_DB_URL: Settings -> Database -> Connection string.
 */
import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. See packages/db/.env.example.');
  process.exit(2);
}

interface Check {
  name: string;
  sql: string;
  /** Reads the first row and decides. Returns null when fine, else why not. */
  verdict: (row: Record<string, unknown> | undefined) => string | null;
}

const EXPECTED_FACETS = [
  'acting',
  'story',
  'directing',
  'cinematography',
  'sound',
  'production_design',
  'pacing',
];

/**
 * pg_class.relname and pg_policies.policyname are of type `name`, and
 * node-postgres hands `name[]` back as a raw string rather than an array.
 * The queries cast to text so this stays an array; the guard keeps a
 * future slip from surfacing as "join is not a function".
 */
function list(row: Record<string, unknown> | undefined, key: string): string[] {
  const value = row?.[key];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    return value
      .replace(/^\{|\}$/g, '')
      .split(',')
      .filter((entry) => entry !== '');
  }
  return [];
}

const CHECKS: Check[] = [
  {
    name: 'every table in public has RLS enabled',
    sql: `
      select coalesce(array_agg(c.relname::text order by c.relname), '{}') as offenders
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    verdict: (row) => {
      const offenders = list(row, 'offenders');
      return offenders.length === 0 ? null : `without RLS: ${offenders.join(', ')}`;
    },
  },
  {
    name: 'catalog tables carry SELECT policies only',
    sql: `
      select coalesce(array_agg(tablename || ':' || policyname || ':' || cmd), '{}') as offenders
      from pg_policies
      where schemaname = 'public'
        and tablename in ('films', 'people', 'film_credits', 'genres', 'film_genres')
        and cmd <> 'SELECT'`,
    verdict: (row) => {
      const offenders = list(row, 'offenders');
      return offenders.length === 0 ? null : `writable: ${offenders.join(', ')}`;
    },
  },
  {
    name: 'no policy on thread_messages grants anon anything',
    sql: `
      select coalesce(array_agg(policyname::text), '{}') as offenders
      from pg_policies
      where schemaname = 'public' and tablename = 'thread_messages' and 'anon' = any(roles)`,
    verdict: (row) => {
      const offenders = list(row, 'offenders');
      return offenders.length === 0 ? null : `anon-facing policies: ${offenders.join(', ')}`;
    },
  },
  {
    name: 'facet_kind holds exactly the seven facets of ADR-009',
    sql: `
      select coalesce(array_agg(e.enumlabel::text order by e.enumsortorder), '{}') as facets
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'facet_kind'`,
    verdict: (row) => {
      const facets = list(row, 'facets');
      return facets.join(',') === EXPECTED_FACETS.join(',') ? null : `got: ${facets.join(', ')}`;
    },
  },
  {
    name: 'the facet aggregate exists as a materialized view',
    sql: `select count(*)::int as n from pg_matviews
          where schemaname = 'public' and matviewname = 'film_facet_averages'`,
    verdict: (row) => (row?.n === 1 ? null : 'missing'),
  },
  {
    name: 'the trigram index on the film titles is in place',
    sql: `select count(*)::int as n from pg_indexes
          where schemaname = 'public' and indexname = 'films_title_trgm'`,
    verdict: (row) => (row?.n === 1 ? null : 'missing'),
  },
  {
    name: 'no facet average is published below five votes',
    sql: `select coalesce(min(vote_count), 5)::int as lowest from public.film_facet_averages`,
    verdict: (row) =>
      Number(row?.lowest) >= 5 ? null : `lowest vote_count is ${String(row?.lowest)}`,
  },
  {
    name: 'the facet refresh is scheduled in pg_cron',
    sql: `select coalesce(max(schedule), '') as schedule
          from cron.job where jobname = 'refresh-film-facet-averages'`,
    verdict: (row) =>
      row?.schedule === '' ? 'no cron job: the facet averages would never refresh (M0 0.4b)' : null,
  },
  {
    name: 'the facet aggregate refreshes on demand',
    sql: `select public.refresh_film_facet_averages() as done`,
    verdict: () => null,
  },
];

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

let failed = 0;

for (const check of CHECKS) {
  let verdict: string | null;
  try {
    const { rows } = await client.query<Record<string, unknown>>(check.sql);
    verdict = check.verdict(rows[0]);
  } catch (error) {
    verdict = error instanceof Error ? error.message : String(error);
  }

  if (verdict === null) {
    console.log(`ok    ${check.name}`);
  } else {
    failed++;
    console.log(`FAIL  ${check.name}\n      ${verdict}`);
  }
}

await client.end();

console.log(failed === 0 ? '\nAll checks passed.' : `\n${String(failed)} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
