/**
 * M1 1.2 — extraction, checked against real Wikidata entities.
 *
 * The fixtures are unmodified Special:EntityData payloads, which is the
 * same shape the dump delivers. Testing against trimmed hand-written
 * entities would only prove that the extractor handles what the author
 * happened to think of.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { extractFilm, isFilm, extractNamedEntity, FILM_CLASSES } from '../src/wikidata/extract.ts';
import type { WikidataEntity } from '../src/wikidata/types.ts';

function fixture(id: string): WikidataEntity {
  const file = path.join(import.meta.dirname, 'fixtures', `${id}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as WikidataEntity;
}

const SOLARIS = fixture('Q125772'); // Tarkovsky, 1972
const WINGS = fixture('Q156911'); // Der Himmel über Berlin, 1987
const THIRD_MAN = fixture('Q271830'); // The Third Man, 1949

describe('the film filter', () => {
  it('covers documentaries, animation and shorts, not just Q11424', () => {
    for (const id of ['Q11424', 'Q93204', 'Q202866', 'Q24862', 'Q506240']) {
      assert.ok(FILM_CLASSES.has(id), `${id} must be in the subclass closure`);
    }
  });

  it('accepts a film', () => {
    assert.equal(isFilm(SOLARIS), true);
  });

  it('rejects an entity that is not a film', () => {
    const person: WikidataEntity = {
      id: 'Q853',
      type: 'item',
      claims: {
        P31: [
          {
            rank: 'normal',
            mainsnak: { snaktype: 'value', property: 'P31', datavalue: { value: { id: 'Q5' }, type: 'wikibase-entityid' } },
          },
        ],
      },
    };
    assert.equal(isFilm(person), false);
    assert.equal(extractFilm(person), null);
  });
});

describe('Solaris (Q125772)', () => {
  const result = extractFilm(SOLARIS);
  assert.ok(result);

  it('carries the IMDb id the roadmap names', () => {
    assert.equal(result.film.imdbId, 'tt0069293');
  });

  it('takes the earliest of four release dates, not the first in the array', () => {
    assert.equal(result.film.releaseYear, 1972);
  });

  it('takes the original title from P1476, in its own script', () => {
    assert.equal(result.film.titleOriginal, 'Солярис');
  });

  it('converts the runtime using its unit', () => {
    assert.equal(result.film.runtimeMin, 160);
  });

  it('records the sitelink count as a relevance signal', () => {
    assert.ok(result.film.sitelinkCount > 40, `got ${String(result.film.sitelinkCount)}`);
  });

  it('credits Tarkovsky as director', () => {
    const directors = result.credits.filter((c) => c.role === 'director');
    assert.deepEqual(
      directors.map((c) => c.personId),
      ['Q853'],
    );
    assert.equal(directors[0]?.ord, 0);
  });

  it('numbers the cast in claim order, starting at zero', () => {
    const cast = result.credits.filter((c) => c.role === 'cast');
    assert.ok(cast.length > 0);
    assert.deepEqual(
      cast.map((c) => c.ord),
      cast.map((_, index) => index),
    );
  });

  it('never credits the same person twice in one role', () => {
    const keys = result.credits.map((c) => `${c.personId}:${c.role}`);
    assert.equal(new Set(keys).size, keys.length, 'would collide on the primary key');
  });

  it('links genres by id, not by label', () => {
    for (const genre of result.genres) {
      assert.match(genre.genreId, /^Q\d+$/);
    }
  });
});

describe('German titles', () => {
  it('keeps the German label when there is one', () => {
    const result = extractFilm(WINGS);
    assert.ok(result);
    assert.equal(result.film.titleDe, 'Der Himmel über Berlin');
  });

  it('keeps German and English apart', () => {
    const result = extractFilm(THIRD_MAN);
    assert.ok(result);
    assert.equal(result.film.titleDe, 'Der dritte Mann');
    assert.equal(result.film.titleEn, 'The Third Man');
    assert.equal(result.film.releaseYear, 1949);
  });

  it('leaves title_de null rather than falling back to English', () => {
    const withoutGerman: WikidataEntity = {
      ...SOLARIS,
      labels: { en: { language: 'en', value: 'Solaris' } },
    };
    const result = extractFilm(withoutGerman);
    assert.ok(result);
    assert.equal(result.film.titleDe, null, 'the fallback belongs in the query, not the data');
    assert.equal(result.film.titleEn, 'Solaris');
  });
});

describe('rank and unit handling', () => {
  function filmWith(property: string, claims: unknown[]): WikidataEntity {
    return {
      id: 'Q1',
      type: 'item',
      labels: { en: { language: 'en', value: 'Fixture' } },
      claims: {
        P31: [
          {
            rank: 'normal',
            mainsnak: {
              snaktype: 'value',
              property: 'P31',
              datavalue: { value: { id: 'Q11424' }, type: 'wikibase-entityid' },
            },
          },
        ],
        [property]: claims,
      },
    } as WikidataEntity;
  }

  it('ignores a deprecated IMDb id', () => {
    const entity = filmWith('P345', [
      {
        rank: 'deprecated',
        mainsnak: { snaktype: 'value', property: 'P345', datavalue: { value: 'tt0000001', type: 'string' } },
      },
      {
        rank: 'normal',
        mainsnak: { snaktype: 'value', property: 'P345', datavalue: { value: 'tt0000002', type: 'string' } },
      },
    ]);
    assert.equal(extractFilm(entity)?.film.imdbId, 'tt0000002');
  });

  it('rejects a malformed IMDb id rather than storing it', () => {
    const entity = filmWith('P345', [
      {
        rank: 'normal',
        mainsnak: { snaktype: 'value', property: 'P345', datavalue: { value: 'nm0000040', type: 'string' } },
      },
    ]);
    assert.equal(extractFilm(entity)?.film.imdbId, null);
  });

  it('ignores a somevalue snak', () => {
    const entity = filmWith('P345', [
      { rank: 'normal', mainsnak: { snaktype: 'somevalue', property: 'P345' } },
    ]);
    assert.equal(extractFilm(entity)?.film.imdbId, null);
  });

  it('converts a runtime given in seconds', () => {
    const entity = filmWith('P2047', [
      {
        rank: 'normal',
        mainsnak: {
          snaktype: 'value',
          property: 'P2047',
          datavalue: {
            value: { amount: '+5400', unit: 'http://www.wikidata.org/entity/Q11574' },
            type: 'quantity',
          },
        },
      },
    ]);
    assert.equal(extractFilm(entity)?.film.runtimeMin, 90);
  });

  it('converts a runtime given in hours', () => {
    const entity = filmWith('P2047', [
      {
        rank: 'normal',
        mainsnak: {
          snaktype: 'value',
          property: 'P2047',
          datavalue: {
            value: { amount: '+2', unit: 'http://www.wikidata.org/entity/Q25235' },
            type: 'quantity',
          },
        },
      },
    ]);
    assert.equal(extractFilm(entity)?.film.runtimeMin, 120);
  });

  it('drops a runtime whose unit it does not know', () => {
    const entity = filmWith('P2047', [
      {
        rank: 'normal',
        mainsnak: {
          snaktype: 'value',
          property: 'P2047',
          datavalue: {
            value: { amount: '+90', unit: 'http://www.wikidata.org/entity/Q99999999' },
            type: 'quantity',
          },
        },
      },
    ]);
    assert.equal(extractFilm(entity)?.film.runtimeMin, null, 'a guessed unit is worse than none');
  });

  it('drops a release date coarser than year precision', () => {
    const entity = filmWith('P577', [
      {
        rank: 'normal',
        mainsnak: {
          snaktype: 'value',
          property: 'P577',
          datavalue: { value: { time: '+1970-00-00T00:00:00Z', precision: 8 }, type: 'time' },
        },
      },
    ]);
    assert.equal(extractFilm(entity)?.film.releaseYear, null);
  });

  it('prefers a preferred-rank release date but still takes the earliest usable one', () => {
    const entity = filmWith('P577', [
      {
        rank: 'normal',
        mainsnak: {
          snaktype: 'value',
          property: 'P577',
          datavalue: { value: { time: '+1999-01-01T00:00:00Z', precision: 11 }, type: 'time' },
        },
      },
      {
        rank: 'deprecated',
        mainsnak: {
          snaktype: 'value',
          property: 'P577',
          datavalue: { value: { time: '+1900-01-01T00:00:00Z', precision: 11 }, type: 'time' },
        },
      },
    ]);
    assert.equal(extractFilm(entity)?.film.releaseYear, 1999, 'the deprecated date must not win');
  });
});

describe('referenced entities', () => {
  it('reads a name and sitelink count off a person', () => {
    const person: WikidataEntity = {
      id: 'Q853',
      type: 'item',
      labels: {
        en: { language: 'en', value: 'Andrei Tarkovsky' },
        de: { language: 'de', value: 'Andrei Tarkowski' },
      },
      sitelinks: { enwiki: {}, dewiki: {} },
    };
    const result = extractNamedEntity(person);
    assert.equal(result?.name, 'Andrei Tarkovsky');
    assert.equal(result?.nameDe, 'Andrei Tarkowski');
    assert.equal(result?.sitelinkCount, 2);
  });

  it('returns null for an entity with no label at all', () => {
    assert.equal(extractNamedEntity({ id: 'Q1', type: 'item' }), null);
  });
});
