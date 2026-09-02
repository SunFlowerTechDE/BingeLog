import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

import {
  genreArtwork,
  genreLabel,
  GENRE_ARTWORK_IDS,
  GENRE_SHORT_LABELS,
} from '../src/lib/genres.ts';

/**
 * Bild und kurzer Name je Genre (19-web-nachziehen 1–2).
 *
 * Die Zuordnung laeuft ueber die Wikidata-ID, nie ueber die
 * Beschriftung. Diese Faelle halten fest, dass sie das auch dann noch
 * tut, wenn jemand eine Beschriftung im Katalog aendert.
 */
describe('the genre tiles', () => {
  it('has a file for every id it claims to have a picture for', () => {
    const vorhanden = new Set(
      readdirSync(new URL('../public/genres', import.meta.url)).map((f) => f.replace(/\.png$/, '')),
    );

    for (const id of GENRE_ARTWORK_IDS) {
      assert.ok(vorhanden.has(id), `${id} hat keine Datei`);
    }
    assert.equal(vorhanden.size, GENRE_ARTWORK_IDS.length, 'kein Bild ohne Zuordnung');
  });

  it('answers with a path, not a guess', () => {
    assert.equal(genreArtwork('Q200092'), '/genres/Q200092.png');
    // Der Katalog kennt vierzig Genres, Bilder gibt es fuer sechzehn.
    // Die uebrigen bekommen eine Kachel ohne Bild, keinen toten Pfad.
    assert.equal(genreArtwork('Q99999999'), null);
  });

  it('drops the redundant film from the label but never mangles it', () => {
    assert.equal(genreLabel('Q200092', 'Horrorfilm'), 'Horror');
    // Nicht "Kriminal": eine Regel "hinten film abschneiden" waere hier
    // falsch, deshalb steht die Tabelle von Hand da.
    assert.equal(genreLabel('Q959790', 'Kriminalfilm'), 'Krimi');
    // Keine Kuerzung, sondern ein anderes Wort.
    assert.equal(genreLabel('Q1054574', 'Liebesfilm'), 'Romantik');
    assert.equal(genreLabel('Q652256', 'Monumentalfilm'), 'Epos');
    // Ohne Eintrag bleibt die Beschriftung aus dem Katalog stehen.
    assert.equal(genreLabel('Q99999999', 'Stummfilm'), 'Stummfilm');
  });

  it('matches the app, label for label', () => {
    // Dieselbe Tabelle wie `GenreLabel` in GenreTile.swift. Weicht eine
    // Seite ab, heisst dasselbe Genre auf zwei Geraeten verschieden.
    assert.deepEqual(GENRE_SHORT_LABELS, {
      Q130232: 'Drama',
      Q157443: 'Komödie',
      Q157394: 'Fantasy',
      Q2484376: 'Thriller',
      Q319221: 'Abenteuer',
      Q188473: 'Action',
      Q959790: 'Krimi',
      Q471839: 'Science-Fiction',
      Q842256: 'Musik',
      Q102429885: 'Coming of Age',
      Q200092: 'Horror',
      Q1200678: 'Mystery',
      Q859369: 'Dramedy',
      Q93204: 'Doku',
      Q1054574: 'Romantik',
      Q652256: 'Epos',
    });
  });

  it('gives every short label a picture', () => {
    // Die sechzehn mit Bild sind dieselben sechzehn mit kurzem Namen.
    assert.deepEqual([...GENRE_ARTWORK_IDS].sort(), Object.keys(GENRE_SHORT_LABELS).sort());
  });
});
