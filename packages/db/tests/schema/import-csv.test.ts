/**
 * Der Leser fuer den Letterboxd-Export.
 *
 * Geprueft gegen einen **echten** Export vom 02.09.2026, nicht gegen
 * eine erfundene Datei. Zwei der Faelle hier waren Fehler, die erst an
 * dieser Datei aufgefallen sind: das Zusammenfuehren von `watched.csv`
 * und `ratings.csv`, und die Ordner `deleted/` und `orphaned/`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  favouriteUris,
  isIgnoredPath,
  kindFor,
  merge,
  parseCsv,
  ratingToScale,
  toRow,
  type ImportRow,
} from '../../supabase/functions/letterboxd-import/csv.ts';

describe('the letterboxd reader', () => {
  it('reads quoted fields with commas and line breaks', () => {
    // Rezensionen enthalten Umbrueche. Ein split('\n') zerlegt sie
    // mitten im Satz.
    const text =
      'Date,Name,Review\n' +
      '2026-01-01,"Dune, Part Two","Erste Zeile\nZweite Zeile"\n' +
      '2026-01-02,Solaris,"Er sagte ""nein"""\n';

    const rows = parseCsv(text);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.Name, 'Dune, Part Two');
    assert.equal(rows[0]?.Review, 'Erste Zeile\nZweite Zeile');
    assert.equal(rows[1]?.Review, 'Er sagte "nein"');
  });

  it('recognises the files by their columns, not their names', () => {
    // Die Spalten des echten Exports.
    assert.equal(kindFor('watched.csv', ['Date', 'Name', 'Year', 'Letterboxd URI']), 'watched');
    assert.equal(
      kindFor('ratings.csv', ['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating']),
      'watched',
      'ratings hat eine Bewertung, aber kein Sichtungsdatum',
    );
    assert.equal(
      kindFor('diary.csv', [
        'Date',
        'Name',
        'Year',
        'Letterboxd URI',
        'Rating',
        'Rewatch',
        'Tags',
        'Watched Date',
      ]),
      'diary',
    );
    assert.equal(
      kindFor('reviews.csv', [
        'Date',
        'Name',
        'Year',
        'Letterboxd URI',
        'Rating',
        'Rewatch',
        'Review',
        'Tags',
        'Watched Date',
      ]),
      'diary',
    );
    assert.equal(kindFor('watchlist.csv', ['Date', 'Name', 'Year', 'Letterboxd URI']), 'watchlist');

    // Umbenannt: die Spalten entscheiden, nicht der Name.
    assert.equal(
      kindFor('journal.csv', ['Date', 'Name', 'Year', 'Watched Date']),
      'diary',
      'ein anderer Dateiname aendert nichts',
    );
  });

  it('ignores files that are not about films', () => {
    // Diese drei haben nur Date,Content — ohne die Namensspalte faenge
    // die Regel fuer `likes/` sie faelschlich ein.
    assert.equal(kindFor('comments.csv', ['Date', 'Content', 'Comment']), null);
    assert.equal(kindFor('likes/reviews.csv', ['Date', 'Content']), null);
    assert.equal(kindFor('likes/lists.csv', ['Date', 'Content']), null);

    // Und gelikte Filme sind keine Favoriten: die vier stehen in
    // profile.csv, gesehen sind sie ohnehin ueber watched.csv.
    assert.equal(kindFor('likes/films.csv', ['Date', 'Name', 'Year', 'Letterboxd URI']), null);
  });

  it('leaves deleted and orphaned entries where they are', () => {
    // Was jemand bei Letterboxd geloescht hat, darf hier nicht
    // wiederauferstehen.
    assert.ok(isIgnoredPath('deleted/diary.csv'));
    assert.ok(isIgnoredPath('orphaned/reviews.csv'));
    assert.ok(!isIgnoredPath('diary.csv'));
    assert.ok(!isIgnoredPath('likes/films.csv'));
  });

  it('takes the rating over as it is', () => {
    // Keine Umrechnung: 4,5 Sterne sind 4,5 Popcorn — nur intern als 9.
    assert.equal(ratingToScale('5'), 10);
    assert.equal(ratingToScale('4.5'), 9);
    assert.equal(ratingToScale('0.5'), 1);
    assert.equal(ratingToScale(''), null, 'keine Bewertung erzeugt keine');
    assert.equal(ratingToScale(undefined), null);
    assert.equal(ratingToScale('0'), null);
  });

  it('never invents a watched date', () => {
    const ohne = toRow('diary', { Name: 'Dune', Year: '2021', 'Watched Date': '' });
    assert.equal(ohne?.kind, 'watched', 'ohne Datum ist es kein Tagebucheintrag');
    assert.equal(ohne?.watchedOn, null);

    const mit = toRow('diary', { Name: 'Dune', Year: '2021', 'Watched Date': '2024-05-01' });
    assert.equal(mit?.kind, 'diary');
    assert.equal(mit?.watchedOn, '2024-05-01');
  });

  it('merges the same film out of watched.csv and ratings.csv', () => {
    // Der echte Export fuehrt beide mit denselben siebzig Filmen. Ohne
    // Zusammenfuehren gewinnt die Datei, die zuerst im Archiv liegt —
    // und das ist die ohne Bewertungen.
    const rows: ImportRow[] = [
      {
        kind: 'watched',
        title: 'The Odyssey',
        year: 2026,
        uri: 'u',
        rating: null,
        watchedOn: null,
        review: null,
      },
      {
        kind: 'watched',
        title: 'The Odyssey',
        year: 2026,
        uri: 'u',
        rating: 10,
        watchedOn: null,
        review: null,
      },
    ];

    const merged = merge(rows);
    assert.equal(merged.length, 1, 'ein Film, eine Zeile');
    assert.equal(merged[0]?.rating, 10, 'die Bewertung ueberlebt');
  });

  it('drops the undated row when a dated one exists', () => {
    const rows: ImportRow[] = [
      {
        kind: 'watched',
        title: 'The Dog Stars',
        year: 2026,
        uri: null,
        rating: 6,
        watchedOn: null,
        review: null,
      },
      {
        kind: 'diary',
        title: 'The Dog Stars',
        year: 2026,
        uri: null,
        rating: 6,
        watchedOn: '2026-08-25',
        review: null,
      },
    ];

    const merged = merge(rows);
    assert.equal(merged.length, 1, 'derselbe Abend nicht zweimal');
    assert.equal(merged[0]?.kind, 'diary');
    assert.equal(merged[0]?.watchedOn, '2026-08-25');
  });

  it('reads the four favourites out of the profile', () => {
    const records = parseCsv(
      'Date Joined,Username,Favorite Films\n' +
        '2026-08-02,KVN_Undso,"https://boxd.it/1RYk, https://boxd.it/aZes"\n',
    );
    assert.deepEqual(favouriteUris(records), ['https://boxd.it/1RYk', 'https://boxd.it/aZes']);
    assert.deepEqual(favouriteUris([]), []);
  });
});
