import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  jahre,
  sichtungsnummern,
  sortiereEintraege,
  spaeterEingetragen,
  waehleEintraege,
  wirksamesDatum,
  KEINE_DIARY_AUSWAHL,
  type DiaryEintrag,
} from '../src/lib/diary.ts';

function eintrag(teil: Partial<DiaryEintrag> & { id: string }): DiaryEintrag {
  return {
    film_id: 'Q1',
    title_de: null,
    title_original: 'Fixture',
    release_year: 2000,
    runtime_min: 100,
    poster_source: null,
    poster_url: null,
    rating: null,
    review: null,
    has_spoilers: false,
    watched_on: null,
    is_rewatch: false,
    visibility: 'public',
    created_at: '2026-08-01T10:00:00+00:00',
    genre_ids: [],
    genre_labels: [],
    ...teil,
  };
}

describe('the diary', () => {
  it('files an entry without a watch date under when it was logged', () => {
    // Sonst stuende er als Eintrag von 1970 ganz unten.
    const ohne = eintrag({ id: 'a', created_at: '2026-08-20T21:00:00+00:00' });
    assert.equal(wirksamesDatum(ohne).getFullYear(), 2026);

    const mit = eintrag({ id: 'b', watched_on: '2024-03-05' });
    assert.equal(wirksamesDatum(mit).getFullYear(), 2024);
  });

  it('says "logged on" only when the two dates differ', () => {
    // Bei einem Film, den man am selben Abend eintraegt, waere die
    // Zeile Laerm.
    // 20 Uhr UTC ist 22 Uhr in Berlin, also derselbe Tag. Mit 22 Uhr
    // UTC waere es dort schon der zweite — die Zone ist hier keine
    // Feinheit, sondern der ganze Fall.
    const gleich = eintrag({
      id: 'a',
      watched_on: '2026-08-01',
      created_at: '2026-08-01T20:00:00+00:00',
    });
    assert.equal(spaeterEingetragen(gleich), false);

    const spaeter = eintrag({
      id: 'b',
      watched_on: '2026-07-04',
      created_at: '2026-08-01T20:00:00+00:00',
    });
    assert.equal(spaeterEingetragen(spaeter), true);

    // Und der Fall, der den Fehler zeigte: 22 Uhr UTC am 1. ist in
    // Berlin der 2., also wurde der Eintrag wirklich spaeter geschrieben.
    assert.equal(
      spaeterEingetragen(
        eintrag({ id: 'd', watched_on: '2026-08-01', created_at: '2026-08-01T22:00:00+00:00' }),
      ),
      true,
    );

    // Ohne Sehdatum gibt es nichts zu vergleichen.
    assert.equal(spaeterEingetragen(eintrag({ id: 'c' })), false);
  });

  it('numbers viewings per film, oldest first', () => {
    // "3. Sichtung" sagt mehr als "Wiedergesehen", und jede Sichtung
    // bleibt ihr eigener Eintrag mit eigener Bewertung.
    const erste = eintrag({ id: 'a', film_id: 'Q1', watched_on: '2024-01-01' });
    const zweite = eintrag({ id: 'b', film_id: 'Q1', watched_on: '2025-01-01' });
    const dritte = eintrag({ id: 'c', film_id: 'Q1', watched_on: '2026-01-01' });
    const anderer = eintrag({ id: 'd', film_id: 'Q2', watched_on: '2026-01-01' });

    const nummern = sichtungsnummern([dritte, erste, anderer, zweite]);
    assert.equal(nummern.a, 1);
    assert.equal(nummern.b, 2);
    assert.equal(nummern.c, 3);
    assert.equal(nummern.d, 1, 'ein anderer Film faengt wieder bei eins an');
  });

  it('searches the review, not only the title', () => {
    // "Was habe ich damals ueber den Schluss geschrieben" ist eine echte
    // Frage an ein Tagebuch.
    const mit = eintrag({ id: 'a', review: 'Der Schluss war stark.' });
    const ohne = eintrag({ id: 'b', review: 'Nichts dazu.' });

    assert.deepEqual(
      waehleEintraege([mit, ohne], { ...KEINE_DIARY_AUSWAHL, term: 'schluss' }).map((e) => e.id),
      ['a'],
    );
  });

  it('separates rated from unrated', () => {
    const bewertet = eintrag({ id: 'a', rating: 8 });
    const offen = eintrag({ id: 'b' });
    const alle = [bewertet, offen];

    assert.deepEqual(
      waehleEintraege(alle, { ...KEINE_DIARY_AUSWAHL, ratedState: 'rated' }).map((e) => e.id),
      ['a'],
    );
    assert.deepEqual(
      waehleEintraege(alle, { ...KEINE_DIARY_AUSWAHL, ratedState: 'unrated' }).map((e) => e.id),
      ['b'],
    );
  });

  it('never sorts a missing rating to the front', () => {
    const mit = eintrag({ id: 'a', rating: 4 });
    const ohne = eintrag({ id: 'b' });
    assert.equal(sortiereEintraege([ohne, mit], 'worstRated')[0]?.id, 'a');
    assert.equal(sortiereEintraege([ohne, mit], 'bestRated')[0]?.id, 'a');
  });

  it('lists the years that actually occur, newest first', () => {
    const jahresliste = jahre([
      eintrag({ id: 'a', watched_on: '2024-05-01' }),
      eintrag({ id: 'b', watched_on: '2026-05-01' }),
      eintrag({ id: 'c', watched_on: '2024-11-01' }),
    ]);
    assert.deepEqual(jahresliste, [2026, 2024]);
  });
});
