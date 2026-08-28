/**
 * Ephemeral Postgres for schema and policy verification.
 *
 * This exists so the M0 Definition of Done can be checked without a
 * Supabase project: it boots a throwaway cluster, recreates the parts of
 * a Supabase database the migrations depend on, and applies every
 * migration in order.
 *
 * What it does NOT replace: the REST-level tests in tests/*.test.ts.
 * Those go through PostgREST and prove the gate holds for a real client.
 * This harness proves the SQL itself is correct and that the policies
 * behave as written.
 *
 * Known divergences from hosted Supabase, deliberate:
 *   - Postgres 18 here, 15/17 there. All DDL used is standard.
 *   - pg_cron is absent, so the facet refresh is not scheduled. The
 *     migration handles that and verify.sql check 8 catches it in prod.
 */
import { createServer } from 'node:net';
import { readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';
import type { Client } from 'pg';

const MIGRATIONS_DIR = path.join(import.meta.dirname, '..', '..', 'supabase', 'migrations');

export type SupabaseRole = 'anon' | 'authenticated' | 'service_role';

/**
 * Roles, grants and auth helpers that Supabase provides out of the box.
 * The migrations assume all of this exists, so a local run has to supply
 * it or it would be testing a different database than the one we deploy.
 *
 * The table-level grants matter: on Supabase, anon really does hold
 * INSERT on public tables, and RLS is the only thing standing in the way.
 * Skipping the grants here would make the catalog look protected for the
 * wrong reason.
 */
const SUPABASE_SHIM = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;

  create schema if not exists extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  create schema if not exists auth;

  create table auth.users (
    id    uuid primary key default gen_random_uuid(),
    email text unique
  );

  -- Mirrors Supabase's own auth.uid(). The nullif has to sit on the
  -- setting string: casting an empty string to jsonb is an error, and an
  -- anonymous request carries exactly that.
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $fn$
    select (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid;
  $fn$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export interface RoleRunner {
  query: <T = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<T[]>;
  /** Runs a statement and resolves to the error message, or null on success. */
  expectError: (text: string, values?: unknown[]) => Promise<string | null>;
}

export interface Harness {
  /** Superuser connection. Used for fixtures and for inspecting state. */
  sql: Client;
  /** Runs statements as a given Supabase role on behalf of a given user. */
  as: (role: SupabaseRole, userId: string | null) => RoleRunner;
  stop: () => Promise<void>;
}

/**
 * A port the operating system says is free right now.
 *
 * Deriving one from the process id looked fine and was not: node --test
 * runs each file in its own process, every file starts its own cluster,
 * and two pids that agree modulo the range collide. That produced a test
 * run that failed once and passed on the retry, which is the worst kind.
 */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('could not determine a free port'));
        return;
      }
      const { port } = address;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

export async function startHarness(): Promise<Harness> {
  const databaseDir = path.join(
    tmpdir(),
    `bingelog-schema-${String(process.pid)}-${String(Date.now())}`,
  );

  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: await freePort(),
    persistent: false,
    // Dieselbe Locale wie das Projekt (en_US.UTF-8). Ohne Angabe erbt
    // initdb die des Rechners, und in der C-Locale wirft pg_trgm
    // nichtlateinische Zeichen aus den Trigrammen. Ein Suchtest lief
    // deshalb auf macOS gruen und auf dem CI-Rechner rot — und die
    // gruene Seite war die falsche: sie prueft Bedingungen, die es auf
    // dem Projekt nicht gibt.
    initdbFlags: ['--locale=en_US.UTF-8', '--encoding=UTF8'],
  });

  await postgres.initialise();
  await postgres.start();

  const sql = postgres.getPgClient();
  await sql.connect();
  await sql.query(SUPABASE_SHIM);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error(`no migrations found in ${MIGRATIONS_DIR}`);

  for (const file of files) {
    const body = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await sql.query(body);
    } catch (cause) {
      throw new Error(`migration ${file} failed: ${String(cause)}`, { cause });
    }
  }

  const as = (role: SupabaseRole, userId: string | null): RoleRunner => {
    const enter = async () => {
      await sql.query('begin');
      await sql.query(`select set_config('request.jwt.claims', $1, true)`, [
        userId === null ? '' : JSON.stringify({ sub: userId, role }),
      ]);
      await sql.query(`set local role ${role}`);
    };

    return {
      async query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<T[]> {
        await enter();
        try {
          const result = await sql.query(text, values);
          return result.rows as T[];
        } finally {
          await sql.query('commit');
        }
      },
      async expectError(text: string, values?: unknown[]): Promise<string | null> {
        await enter();
        try {
          await sql.query(text, values);
          await sql.query('commit');
          return null;
        } catch (error) {
          await sql.query('rollback');
          return error instanceof Error ? error.message : String(error);
        }
      },
    };
  };

  return {
    sql,
    as,
    stop: async () => {
      await sql.end();
      await postgres.stop();
    },
  };
}

/** Creates an auth user plus its profile via the superuser connection. */
export async function seedUser(h: Harness, username: string): Promise<string> {
  const { rows } = await h.sql.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [`${username}@bingelog.test`],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('auth user insert returned no id');

  await h.sql.query(`insert into public.profiles (id, username) values ($1, $2)`, [id, username]);
  return id;
}

export async function seedFilm(h: Harness, wikidataId: string): Promise<void> {
  await h.sql.query(
    `insert into public.films (wikidata_id, imdb_id, title_original, title_de, release_year)
     values ($1, $2, 'Fixture', 'Vorrichtung', 2000)`,
    [wikidataId, `tt${wikidataId.replace(/\D/g, '').padStart(7, '0').slice(0, 7)}`],
  );
}
