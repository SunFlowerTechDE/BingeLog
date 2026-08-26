/**
 * M3 3.2 — the five search cases the milestone makes mandatory.
 *
 * These are exactly the queries TheTVDB's title search got wrong
 * (ADR-003), which is why they are here rather than in a list of nice
 * ideas. They run against the real ranking function on real catalog rows,
 * with the near misses present: a ranking test in which only the right
 * answer exists proves nothing, because every ranking puts the only
 * candidate first.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { startHarness, type Harness } from './harness.ts';

interface Catalog {
  films: Record<string, string | number | null>[];
  people: Record<string, string | number | null>[];
  genres: Record<string, string | null>[];
  credits: Record<string, string | number | null>[];
  filmGenres: Record<string, string>[];
}

const catalog = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'catalog.json'), 'utf8'),
) as Catalog;

let h: Harness;

interface Hit {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  sitelink_count: number;
  director: string | null;
  score: number;
}

async function search(term: string, limit = 5): Promise<Hit[]> {
  const { rows } = await h.sql.query<Hit>('select * from public.search_films($1, $2)', [
    term,
    limit,
  ]);
  return rows;
}

before(async () => {
  h = await startHarness();

  const insertMany = async (table: string, columns: string[], rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const placeholders = columns.map((_, index) => `$${String(index + 1)}`).join(', ');
      await h.sql.query(
        `insert into public.${table} (${columns.join(', ')}) values (${placeholders})
         on conflict do nothing`,
        columns.map((column) => row[column]),
      );
    }
  };

  await insertMany(
    'films',
    [
      'wikidata_id',
      'imdb_id',
      'tvdb_id',
      'title_original',
      'title_de',
      'title_en',
      'release_year',
      'runtime_min',
      'sitelink_count',
      'poster_source',
      'poster_url',
    ],
    catalog.films,
  );
  await insertMany('people', ['wikidata_id', 'name', 'sitelink_count'], catalog.people);
  await insertMany('genres', ['wikidata_id', 'label_de', 'label_en'], catalog.genres);
  await insertMany('film_credits', ['film_id', 'person_id', 'role', 'ord'], catalog.credits);
  await insertMany('film_genres', ['film_id', 'genre_id'], catalog.filmGenres);
});

after(async () => {
  await h.stop();
});

describe('the fixture actually contains the near misses', () => {
  it('holds three films called Solaris, including the 1968 television one', async () => {
    const { rows } = await h.sql.query<{ release_year: number }>(
      `select release_year from public.films
       where lower(coalesce(title_de, title_original)) = 'solaris' order by release_year`,
    );
    assert.deepEqual(
      rows.map((r) => r.release_year),
      [1968, 1972, 2002],
    );
  });

  it('holds a film whose title merely contains "Die Wand" and outranks it on sitelinks', async () => {
    const { rows } = await h.sql.query<{ title_de: string; sitelink_count: number }>(
      `select title_de, sitelink_count from public.films
       where title_de in ('Die Wand', 'Gegen die Wand') order by sitelink_count desc`,
    );
    // This is the case that breaks a relevance-first ranking: the wrong
    // film has roughly three times the language versions.
    assert.equal(rows[0]?.title_de, 'Gegen die Wand');
    assert.ok((rows[0]?.sitelink_count ?? 0) > (rows[1]?.sitelink_count ?? 0) * 2);
  });
});

describe('the mandatory search cases (M3 3.2)', () => {
  const cases: [term: string, year: number, note: string][] = [
    ['Solaris', 1972, 'Tarkovsky, not the 1968 television version'],
    ['Die Wand', 2012, 'Pölsler, not Gegen die Wand'],
    ['Der dritte Mann', 1949, 'Reed'],
    ['Shoplifters', 2018, 'Kore-eda'],
    ['Jeder für sich und Gott gegen alle', 1974, 'Herzog'],
  ];

  for (const [term, year, note] of cases) {
    it(`ranks "${term}" first: ${note}`, async () => {
      const hits = await search(term);
      assert.ok(hits.length > 0, 'no results at all');
      assert.equal(
        hits[0]?.release_year,
        year,
        `got ${hits[0]?.title_de ?? '?'} (${String(hits[0]?.release_year)})`,
      );
    });
  }
});

describe('what the ranking has to weigh', () => {
  it('lets an exact match beat a far more linked partial one', async () => {
    const hits = await search('Die Wand');
    const wand = hits[0];
    const gegen = hits.find((h) => h.title_de === 'Gegen die Wand');

    assert.equal(wand?.title_de, 'Die Wand');
    assert.ok(gegen, 'the distractor should still be offered, just lower');
    assert.ok(
      wand.score > gegen.score * 10,
      'the gap must be decisive, not a coincidence of rounding',
    );
  });

  it('separates equally exact matches by sitelink count', async () => {
    const hits = await search('Solaris');
    const years = hits.map((h) => h.release_year);

    // All three are exact title matches, so only the relevance signal
    // can order them (ADR-008).
    assert.deepEqual(years.slice(0, 3), [1972, 2002, 1968]);
  });

  it('returns the director, since titles collide', async () => {
    const hits = await search('Solaris');
    assert.equal(hits[0]?.director, 'Andrei Tarkovsky');
    assert.ok(hits.every((hit) => hit.director !== null));
  });

  it('returns nothing below two characters', async () => {
    assert.deepEqual(await search('S'), []);
    assert.deepEqual(await search(''), []);
  });

  it('ignores surrounding whitespace and case', async () => {
    const hits = await search('   dER DRItte mann  ');
    assert.equal(hits[0]?.release_year, 1949);
  });

  it('finds a film by its original title as well as its German one', async () => {
    const byEnglish = await search('The Third Man');
    assert.equal(byEnglish[0]?.release_year, 1949);
  });

  it('survives a typo through trigram similarity', async () => {
    const hits = await search('Solars');
    assert.ok(
      hits.some((hit) => hit.release_year === 1972),
      'a single dropped letter must not empty the result',
    );
  });

  it('honours the result limit', async () => {
    assert.ok((await search('a', 3)).length <= 3);
    assert.ok((await search('der', 2)).length <= 2);
  });

  it('is readable by an anonymous visitor', async () => {
    const rows = await h
      .as('anon', null)
      .query(`select wikidata_id from public.search_films('Solaris', 3)`);
    assert.ok(rows.length > 0, 'search must work before signing up');
  });
});
