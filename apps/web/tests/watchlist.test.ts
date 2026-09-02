import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sortiere,
  sozialerHinweis,
  waehle,
  KEINE_AUSWAHL,
  type WatchlistEintrag,
} from '../src/lib/watchlist.ts';

/**
 * Auswahl und Ordnung der Watchlist (19-web-nachziehen 9).
 *
 * Dieselben Zusicherungen wie in der App, und aus demselben Grund als
 * eigene Funktionen: eine Liste laesst sich schlecht pruefen, die
 * Ordnung dahinter gut.
 */
function eintrag(teil: Partial<WatchlistEintrag> & { film_id: string }): WatchlistEintrag {
  return {
    title_de: null,
    title_original: teil.film_id,
    release_year: 2000,
    runtime_min: 100,
    poster_source: null,
    poster_url: null,
    added_at: '2026-08-01T10:00:00+00:00',
    average: null,
    votes: 0,
    genre_ids: [],
    genre_labels: [],
    recommenders: 0,
    first_friend: null,
    priority: 'normal',
    group_ids: [],
    friends_seen: 0,
    friend_name: null,
    friend_rating: null,
    ...teil,
  };
}

describe('the watchlist', () => {
  it('never sorts a missing figure to the front', () => {
    // Ein Film ohne Laufzeit ist nicht der kuerzeste, und einer ohne
    // Bewertung nicht der schlechteste.
    const mit = eintrag({ film_id: 'Q1', runtime_min: 90, average: 8, release_year: 1990 });
    const ohne = eintrag({ film_id: 'Q2', runtime_min: null, average: null, release_year: null });

    for (const ordnung of [
      'bestRated',
      'worstRated',
      'newestFilm',
      'oldestFilm',
      'shortest',
      'longest',
    ] as const) {
      assert.equal(
        sortiere([ohne, mit], ordnung, {})[0]?.film_id,
        'Q1',
        `${ordnung} stellt den leeren nach vorn`,
      );
    }
  });

  it('excludes a film with no runtime from any maximum', () => {
    // Dieselbe Regel wie beim Jahr in der Suche: unbekannt ist nicht kurz.
    const kurz = eintrag({ film_id: 'Q1', runtime_min: 80 });
    const ohne = eintrag({ film_id: 'Q3', runtime_min: null });
    const alle = [kurz, ohne];

    assert.deepEqual(
      waehle(alle, { ...KEINE_AUSWAHL, maximumRuntime: 90 }).map((e) => e.film_id),
      ['Q1'],
    );
    assert.equal(waehle(alle, KEINE_AUSWAHL).length, 2);
  });

  it('applies filters together, not one after another', () => {
    const a = eintrag({ film_id: 'Q1', genre_ids: ['Q200092'], priority: 'next' });
    const b = eintrag({ film_id: 'Q2', genre_ids: ['Q200092'] });
    const c = eintrag({ film_id: 'Q3', genre_ids: ['Q157443'], priority: 'next' });

    assert.deepEqual(
      waehle([a, b, c], { ...KEINE_AUSWAHL, genre: 'Q200092', priority: 'next' }).map(
        (e) => e.film_id,
      ),
      ['Q1'],
    );
  });

  it('keeps a stable order inside one priority step', () => {
    const alt = eintrag({ film_id: 'Q1', added_at: '2026-07-01T10:00:00+00:00' });
    const neu = eintrag({ film_id: 'Q2', added_at: '2026-08-20T10:00:00+00:00' });
    const dringend = eintrag({
      film_id: 'Q3',
      priority: 'next',
      added_at: '2026-01-01T10:00:00+00:00',
    });
    const irgendwann = eintrag({
      film_id: 'Q4',
      priority: 'someday',
      added_at: '2026-08-30T10:00:00+00:00',
    });

    assert.deepEqual(
      sortiere([alt, neu, dringend, irgendwann], 'byPriority', {}).map((e) => e.film_id),
      ['Q3', 'Q2', 'Q1', 'Q4'],
    );
  });

  it('sorts a film without a match value last', () => {
    const gut = eintrag({ film_id: 'Q1' });
    const mittel = eintrag({ film_id: 'Q2' });
    const ohne = eintrag({ film_id: 'Q3' });

    assert.deepEqual(
      sortiere([ohne, mittel, gut], 'bestMatch', { Q1: 91, Q2: 54 }).map((e) => e.film_id),
      ['Q1', 'Q2', 'Q3'],
    );
  });

  it('carries one social hint, and the recommendation wins', () => {
    // Eine Empfehlung ist an mich gerichtet, "hat ihn gesehen" nicht.
    assert.equal(
      sozialerHinweis(
        eintrag({ film_id: 'Q1', recommenders: 1, first_friend: 'Pascal', friends_seen: 3 }),
      ),
      'Empfohlen von Pascal',
    );
    assert.equal(
      sozialerHinweis(
        eintrag({ film_id: 'Q2', friends_seen: 1, friend_name: 'Sarah', friend_rating: 9 }),
      ),
      'Sarah gab 4,5 Popcorn',
    );
    assert.equal(
      sozialerHinweis(eintrag({ film_id: 'Q3', friends_seen: 1, friend_name: 'Pascal' })),
      'Pascal hat ihn gesehen',
    );
    // Ab zwei die Zahl, nicht die Liste — sonst sprengt sie die Karte.
    assert.equal(
      sozialerHinweis(
        eintrag({ film_id: 'Q4', friends_seen: 3, friend_name: 'Sarah', friend_rating: 8 }),
      ),
      '3 Freunde gesehen',
    );
    assert.equal(sozialerHinweis(eintrag({ film_id: 'Q5' })), null);
  });
});
