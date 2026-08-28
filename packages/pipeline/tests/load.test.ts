/**
 * M1 1.3 — the loader, against a real Postgres with the real schema.
 *
 * Uses the same ephemeral cluster as the M0 schema tests, so the foreign
 * keys, checks and RLS the loader has to satisfy are the deployed ones,
 * not a simplified copy.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { startHarness, type Harness } from '@binge-log/db/testing';

import { extractFilm, extractNamedEntity } from '../src/wikidata/extract.ts';
import {
  countFilm,
  createStagingTables,
  emptyStats,
  formatStats,
  loadCredits,
  loadFilmGenres,
  loadFilms,
  loadGenres,
  loadPeople,
} from '../src/wikidata/load.ts';
import type {
  ExtractedCredit,
  ExtractedEntity,
  ExtractedGenre,
  WikidataEntity,
} from '../src/wikidata/types.ts';

function fixture(id: string): WikidataEntity {
  return JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'fixtures', `${id}.json`), 'utf8'),
  ) as WikidataEntity;
}

const FIXTURE_IDS = ['Q125772', 'Q156911', 'Q271830'];

let h: Harness;
let extracted: ExtractedEntity[] = [];

/** Stand-ins for what the dump's second pass would supply. */
function peopleFor(credits: ExtractedCredit[]) {
  return [...new Set(credits.map((c) => c.personId))].map((id) => ({
    wikidataId: id,
    name: `Person ${id}`,
    sitelinkCount: 3,
  }));
}

function genresFor(links: ExtractedGenre[]) {
  return [...new Set(links.map((l) => l.genreId))].map((id) => ({
    wikidataId: id,
    labelDe: `Genre ${id}`,
    labelEn: `Genre ${id}`,
  }));
}

async function runImport(): Promise<void> {
  const credits = extracted.flatMap((e) => e.credits);
  const genreLinks = extracted.flatMap((e) => e.genres);

  await loadFilms(
    h.sql,
    extracted.map((e) => e.film),
  );
  await loadPeople(h.sql, peopleFor(credits));
  await loadGenres(h.sql, genresFor(genreLinks));
  await loadCredits(h.sql, credits);
  await loadFilmGenres(h.sql, genreLinks);
}

async function count(table: string): Promise<number> {
  const { rows } = await h.sql.query<{ n: string }>(`select count(*) as n from public.${table}`);
  return Number(rows[0]?.n ?? 0);
}

before(async () => {
  h = await startHarness();
  await createStagingTables(h.sql);
  extracted = FIXTURE_IDS.map((id) => extractFilm(fixture(id))).filter(
    (e): e is ExtractedEntity => e !== null,
  );
  assert.equal(extracted.length, 3);
});

after(async () => {
  await h.stop();
});

describe('loading', () => {
  it('writes the films with their credits and genres', async () => {
    await runImport();

    assert.equal(await count('films'), 3);
    assert.ok((await count('film_credits')) > 0);
    assert.ok((await count('film_genres')) > 0);
  });

  it('stores Solaris the way the roadmap describes it', async () => {
    const { rows } = await h.sql.query<{
      imdb_id: string;
      title_original: string;
      title_de: string;
      release_year: number;
      runtime_min: number;
      sitelink_count: number;
    }>(
      `select imdb_id, title_original, title_de, release_year, runtime_min, sitelink_count
       from public.films where wikidata_id = 'Q125772'`,
    );

    const film = rows[0];
    assert.ok(film);
    assert.equal(film.imdb_id, 'tt0069293');
    assert.equal(film.title_original, 'Солярис');
    assert.equal(film.title_de, 'Solaris');
    assert.equal(film.release_year, 1972);
    assert.equal(film.runtime_min, 160);
    assert.ok(film.sitelink_count > 40);
  });

  it('leaves poster fields untouched for M2', async () => {
    const { rows } = await h.sql.query<{ poster_source: string | null; tvdb_id: number | null }>(
      `select poster_source, tvdb_id from public.films where wikidata_id = 'Q125772'`,
    );
    assert.equal(rows[0]?.poster_source, null);
    assert.equal(rows[0]?.tvdb_id, null);
  });

  it('is idempotent: a second run changes no counts', async () => {
    const before = {
      films: await count('films'),
      credits: await count('film_credits'),
      genres: await count('film_genres'),
      people: await count('people'),
    };

    await runImport();

    assert.equal(await count('films'), before.films);
    assert.equal(await count('film_credits'), before.credits);
    assert.equal(await count('film_genres'), before.genres);
    assert.equal(await count('people'), before.people);
  });

  it('does not clobber artwork resolved by M2 on re-import', async () => {
    await h.sql.query(
      `update public.films
       set tvdb_id = 4242, poster_source = 'tvdb', poster_url = 'https://artworks.thetvdb.com/x.jpg'
       where wikidata_id = 'Q125772'`,
    );

    await runImport();

    const { rows } = await h.sql.query<{ tvdb_id: number; poster_source: string }>(
      `select tvdb_id, poster_source from public.films where wikidata_id = 'Q125772'`,
    );
    assert.equal(rows[0]?.tvdb_id, 4242);
    assert.equal(rows[0]?.poster_source, 'tvdb');
  });

  it('picks up a changed title on re-import', async () => {
    const changed = extracted.map((e) =>
      e.film.wikidataId === 'Q271830' ? { ...e.film, titleDe: 'Der dritte Mann (neu)' } : e.film,
    );
    await loadFilms(h.sql, changed);

    const { rows } = await h.sql.query<{ title_de: string }>(
      `select title_de from public.films where wikidata_id = 'Q271830'`,
    );
    assert.equal(rows[0]?.title_de, 'Der dritte Mann (neu)');
  });

  it('leaves a hand-corrected field alone on re-import, and only that one', async () => {
    // Der eigentliche Grund fuer manual_fields: eine Korrektur im
    // Dashboard darf beim naechsten Import nicht still verschwinden.
    await h.sql.query(
      `update public.films
          set title_de = 'Der dritte Mann (von Hand)',
              manual_fields = array['title_de']
        where wikidata_id = 'Q271830'`,
    );

    const wikidata = extracted.map((e) =>
      e.film.wikidataId === 'Q271830'
        ? { ...e.film, titleDe: 'Aus Wikidata', runtimeMin: 111 }
        : e.film,
    );
    await loadFilms(h.sql, wikidata);

    const { rows } = await h.sql.query<{ title_de: string; runtime_min: number }>(
      `select title_de, runtime_min from public.films where wikidata_id = 'Q271830'`,
    );

    assert.equal(rows[0]?.title_de, 'Der dritte Mann (von Hand)', 'die Korrektur bleibt');
    // Und der Rest laeuft weiter: wer einen Titel richtigstellt, will
    // trotzdem die neue Laufzeit. Deshalb je Feld und nicht je Zeile.
    assert.equal(rows[0]?.runtime_min, 111, 'ungesperrte Felder folgen Wikidata weiter');

    await h.sql.query(`update public.films set manual_fields = '{}' where wikidata_id = 'Q271830'`);
  });

  it('drops a credit whose person is not in the catalog', async () => {
    const before = await count('film_credits');

    await loadCredits(h.sql, [
      { filmId: 'Q125772', personId: 'Q999999999', role: 'director', ord: 0 },
    ]);

    assert.equal(await count('film_credits'), before, 'a dangling credit must not abort the batch');
  });

  it('drops a second film claiming an IMDb id that is already taken', async () => {
    const before = await count('films');

    await loadFilms(h.sql, [
      {
        wikidataId: 'Q800001',
        imdbId: 'tt7777777',
        titleOriginal: 'Erster',
        titleDe: null,
        titleEn: null,
        releaseYear: 2001,
        runtimeMin: 90,
        sitelinkCount: 9,
      },
      {
        wikidataId: 'Q800002',
        imdbId: 'tt7777777',
        titleOriginal: 'Zweiter',
        titleDe: null,
        titleEn: null,
        releaseYear: 2002,
        runtimeMin: 91,
        sitelinkCount: 2,
      },
    ]);

    assert.equal(await count('films'), before + 1, 'the batch survives, the duplicate does not');

    const { rows } = await h.sql.query<{ wikidata_id: string }>(
      `select wikidata_id from public.films where imdb_id = 'tt7777777'`,
    );
    assert.equal(rows[0]?.wikidata_id, 'Q800001', 'the better-linked item wins');
  });

  it('escapes tabs and newlines in titles rather than corrupting the COPY stream', async () => {
    await loadFilms(h.sql, [
      {
        wikidataId: 'Q800003',
        imdbId: null,
        titleOriginal: 'Titel\tmit\tTabs\nund Zeilenumbruch \\ Backslash',
        titleDe: null,
        titleEn: null,
        releaseYear: 2003,
        runtimeMin: null,
        sitelinkCount: 0,
      },
    ]);

    const { rows } = await h.sql.query<{ title_original: string }>(
      `select title_original from public.films where wikidata_id = 'Q800003'`,
    );
    assert.equal(rows[0]?.title_original, 'Titel\tmit\tTabs\nund Zeilenumbruch \\ Backslash');
  });
});

describe('import statistics', () => {
  it('reports the shares the roadmap uses as a sanity check', () => {
    const stats = emptyStats();
    for (const entity of extracted) countFilm(stats, entity.film);
    stats.filmsLoaded = stats.filmsSeen;

    assert.equal(stats.filmsSeen, 3);
    assert.equal(stats.withImdbId, 3);
    assert.match(formatStats(stats), /expected ~78\.5 %/);
  });
});

describe('referenced entities', () => {
  it('loads people with the names the second dump pass supplies', async () => {
    const person = extractNamedEntity({
      id: 'Q853',
      type: 'item',
      labels: { en: { language: 'en', value: 'Andrei Tarkovsky' } },
      sitelinks: { enwiki: {}, dewiki: {} },
    });
    assert.ok(person);

    await loadPeople(h.sql, [person]);

    const { rows } = await h.sql.query<{ name: string; sitelink_count: number }>(
      `select name, sitelink_count from public.people where wikidata_id = 'Q853'`,
    );
    assert.equal(rows[0]?.name, 'Andrei Tarkovsky');
    assert.equal(rows[0]?.sitelink_count, 2);
  });
});
