/**
 * M1 1.3 — Loading extracted rows into Postgres.
 *
 * Bulk load via COPY into unlogged staging tables, then a single upsert
 * per target table. Row-by-row inserts over 350.000 films would take
 * hours; COPY plus one statement takes seconds per batch.
 *
 * Every load is idempotent. Re-running the import must converge on the
 * same catalog, not duplicate it (M1, Definition of Done).
 */
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import type { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';

import type { ExtractedCredit, ExtractedFilm, ExtractedGenre } from './types.ts';

export interface NamedEntity {
  wikidataId: string;
  name: string;
  nameDe?: string | null;
  nameEn?: string | null;
  sitelinkCount: number;
}

/** COPY text format: backslash escapes, \N for null. */
function encodeField(value: string | number | null): string {
  if (value === null) return '\\N';
  if (typeof value === 'number') return String(value);
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t');
}

function encodeRow(fields: (string | number | null)[]): string {
  return `${fields.map(encodeField).join('\t')}\n`;
}

async function copyInto(
  client: Client,
  table: string,
  columns: string[],
  rows: (string | number | null)[][],
): Promise<void> {
  if (rows.length === 0) return;

  const stream = client.query(
    copyFrom(`copy ${table} (${columns.join(', ')}) from stdin with (format text)`),
  );
  await pipeline(Readable.from(rows.map(encodeRow)), stream);
}

/**
 * Staging tables live for the session and are truncated between batches.
 * UNLOGGED skips WAL, which is safe because nothing here survives a
 * crash by design.
 */
export async function createStagingTables(client: Client): Promise<void> {
  await client.query(`
    create unlogged table if not exists staging_films (
      wikidata_id    text primary key,
      imdb_id        text,
      title_original text,
      title_de       text,
      title_en       text,
      release_year   integer,
      runtime_min    integer,
      sitelink_count integer
    );
    create unlogged table if not exists staging_people (
      wikidata_id    text primary key,
      name           text,
      sitelink_count integer
    );
    create unlogged table if not exists staging_genres (
      wikidata_id text primary key,
      label_de    text,
      label_en    text
    );
    create unlogged table if not exists staging_credits (
      film_id   text,
      person_id text,
      role      text,
      ord       integer
    );
    create unlogged table if not exists staging_film_genres (
      film_id  text,
      genre_id text
    );
  `);
}

async function truncate(client: Client, table: string): Promise<void> {
  await client.query(`truncate ${table}`);
}

// ---------------------------------------------------------------------------

export async function loadFilms(client: Client, films: ExtractedFilm[]): Promise<number> {
  if (films.length === 0) return 0;
  await truncate(client, 'staging_films');

  await copyInto(
    client,
    'staging_films',
    [
      'wikidata_id',
      'imdb_id',
      'title_original',
      'title_de',
      'title_en',
      'release_year',
      'runtime_min',
      'sitelink_count',
    ],
    films.map((f) => [
      f.wikidataId,
      f.imdbId,
      f.titleOriginal,
      f.titleDe,
      f.titleEn,
      f.releaseYear,
      f.runtimeMin,
      f.sitelinkCount,
    ]),
  );

  // imdb_id is unique. Two Wikidata items claiming the same IMDb id does
  // happen (a work and its re-release), and the second one would abort
  // the whole batch, so the duplicate is dropped rather than the batch.
  const { rowCount } = await client.query(`
    with deduped as (
      select distinct on (coalesce(imdb_id, wikidata_id)) *
      from staging_films
      order by coalesce(imdb_id, wikidata_id), sitelink_count desc, wikidata_id
    )
    insert into public.films as f (
      wikidata_id, imdb_id, title_original, title_de, title_en,
      release_year, runtime_min, sitelink_count, updated_at
    )
    select wikidata_id, imdb_id, title_original, title_de, title_en,
           release_year, runtime_min, coalesce(sitelink_count, 0), now()
    from deduped
    on conflict (wikidata_id) do update set
      imdb_id        = excluded.imdb_id,
      -- A field a human corrected stays corrected. manual_fields records
      -- which ones, per field rather than per row: someone who fixes a
      -- title still wants the new runtime from Wikidata (M4, migration
      -- 20260828390000).
      --
      -- Without this the next import silently reverted every correction,
      -- and silently is the bad part — nobody would have seen why the
      -- wrong title was back.
      title_original = case when 'title_original' = any(f.manual_fields)
                            then f.title_original else excluded.title_original end,
      title_de       = case when 'title_de' = any(f.manual_fields)
                            then f.title_de else excluded.title_de end,
      title_en       = case when 'title_en' = any(f.manual_fields)
                            then f.title_en else excluded.title_en end,
      release_year   = case when 'release_year' = any(f.manual_fields)
                            then f.release_year else excluded.release_year end,
      runtime_min    = case when 'runtime_min' = any(f.manual_fields)
                            then f.runtime_min else excluded.runtime_min end,
      sitelink_count = excluded.sitelink_count,
      updated_at     = now()
    -- poster_source, poster_url and tvdb_id belong to M2 and are never
    -- touched here: a re-import must not discard resolved artwork. The
    -- same now goes for fsk, which has no source but a person.
  `);

  return rowCount ?? 0;
}

export async function loadPeople(client: Client, people: NamedEntity[]): Promise<number> {
  if (people.length === 0) return 0;
  await truncate(client, 'staging_people');

  await copyInto(
    client,
    'staging_people',
    ['wikidata_id', 'name', 'sitelink_count'],
    people.map((p) => [p.wikidataId, p.name, p.sitelinkCount]),
  );

  const { rowCount } = await client.query(`
    insert into public.people (wikidata_id, name, sitelink_count)
    select wikidata_id, name, coalesce(sitelink_count, 0)
    from staging_people
    where name is not null
    on conflict (wikidata_id) do update set
      name           = excluded.name,
      sitelink_count = excluded.sitelink_count
  `);

  return rowCount ?? 0;
}

export async function loadGenres(
  client: Client,
  genres: { wikidataId: string; labelDe: string | null; labelEn: string | null }[],
): Promise<number> {
  if (genres.length === 0) return 0;
  await truncate(client, 'staging_genres');

  await copyInto(
    client,
    'staging_genres',
    ['wikidata_id', 'label_de', 'label_en'],
    genres.map((g) => [g.wikidataId, g.labelDe, g.labelEn]),
  );

  const { rowCount } = await client.query(`
    insert into public.genres (wikidata_id, label_de, label_en)
    select wikidata_id, label_de, label_en from staging_genres
    on conflict (wikidata_id) do update set
      label_de = excluded.label_de,
      label_en = excluded.label_en
  `);

  return rowCount ?? 0;
}

/**
 * Credits and genre links reference people, genres and films. Rows whose
 * target never made it into the catalog are dropped here rather than
 * aborting the batch on a foreign key violation.
 */
export async function loadCredits(client: Client, credits: ExtractedCredit[]): Promise<number> {
  if (credits.length === 0) return 0;
  await truncate(client, 'staging_credits');

  await copyInto(
    client,
    'staging_credits',
    ['film_id', 'person_id', 'role', 'ord'],
    credits.map((c) => [c.filmId, c.personId, c.role, c.ord]),
  );

  const { rowCount } = await client.query(`
    insert into public.film_credits (film_id, person_id, role, ord)
    select distinct on (s.film_id, s.person_id, s.role)
           s.film_id, s.person_id, s.role, s.ord
    from staging_credits s
    join public.films  f on f.wikidata_id = s.film_id
    join public.people p on p.wikidata_id = s.person_id
    order by s.film_id, s.person_id, s.role, s.ord
    on conflict (film_id, person_id, role) do update set ord = excluded.ord
  `);

  return rowCount ?? 0;
}

export async function loadFilmGenres(client: Client, links: ExtractedGenre[]): Promise<number> {
  if (links.length === 0) return 0;
  await truncate(client, 'staging_film_genres');

  await copyInto(
    client,
    'staging_film_genres',
    ['film_id', 'genre_id'],
    links.map((l) => [l.filmId, l.genreId]),
  );

  const { rowCount } = await client.query(`
    insert into public.film_genres (film_id, genre_id)
    select distinct s.film_id, s.genre_id
    from staging_film_genres s
    join public.films  f on f.wikidata_id = s.film_id
    join public.genres g on g.wikidata_id = s.genre_id
    on conflict (film_id, genre_id) do nothing
  `);

  return rowCount ?? 0;
}

// ---------------------------------------------------------------------------

export interface ImportStats {
  filmsSeen: number;
  filmsLoaded: number;
  withImdbId: number;
  withGermanTitle: number;
  withManySitelinks: number;
}

export function emptyStats(): ImportStats {
  return {
    filmsSeen: 0,
    filmsLoaded: 0,
    withImdbId: 0,
    withGermanTitle: 0,
    withManySitelinks: 0,
  };
}

export function countFilm(stats: ImportStats, film: ExtractedFilm): void {
  stats.filmsSeen++;
  if (film.imdbId) stats.withImdbId++;
  if (film.titleDe) stats.withGermanTitle++;
  if (film.sitelinkCount > 10) stats.withManySitelinks++;
}

/**
 * The measured expectation from ADR-001: 348.586 films, 78,5 percent of
 * them with an IMDb id. A large deviation means the dump filter is wrong
 * (M1 1.3), so the numbers are reported rather than merely logged.
 */
export function formatStats(stats: ImportStats): string {
  const share = (n: number) =>
    stats.filmsSeen === 0 ? '0.0' : ((n / stats.filmsSeen) * 100).toFixed(1);

  return [
    `films seen        ${String(stats.filmsSeen)}`,
    `films loaded      ${String(stats.filmsLoaded)}`,
    `with IMDb id      ${String(stats.withImdbId)} (${share(stats.withImdbId)} %, expected ~78.5 %)`,
    `with German title ${String(stats.withGermanTitle)} (${share(stats.withGermanTitle)} %)`,
    `sitelinks > 10    ${String(stats.withManySitelinks)} (${share(stats.withManySitelinks)} %)`,
  ].join('\n');
}
