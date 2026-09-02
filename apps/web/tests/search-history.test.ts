import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { verlaufMit } from '../src/lib/search-history.ts';

/**
 * Der Suchverlauf (Suchkonzept 16).
 *
 * Dieselben Regeln wie in der App, und aus demselben Grund als eigene
 * Funktion: `localStorage` laesst sich schlecht pruefen, die Regel gut.
 */
describe('the search history', () => {
  it('does not remember what was never searched', () => {
    // Unter zwei Zeichen wird gar nicht erst gesucht.
    assert.deepEqual(verlaufMit('a', ['Alien']), ['Alien']);
    assert.deepEqual(verlaufMit('   ', ['Alien']), ['Alien']);
  });

  it('moves a repeated term up instead of listing it twice', () => {
    assert.deepEqual(verlaufMit('Alien', ['Dune', 'Alien', 'Heat']), ['Alien', 'Dune', 'Heat']);
    // Gross- und Kleinschreibung zaehlt dabei nicht.
    assert.deepEqual(verlaufMit('alien', ['Dune', 'Alien']), ['alien', 'Dune']);
  });

  it('keeps at most eight', () => {
    const voll = ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => `Film ${n}`);
    const danach = verlaufMit('Neu', voll);
    assert.equal(danach.length, 8);
    assert.equal(danach[0], 'Neu');
    assert.ok(!danach.includes('Film 8'), 'der aelteste faellt hinten heraus');
  });

  it('trims what it stores', () => {
    assert.deepEqual(verlaufMit('  Dune  ', []), ['Dune']);
  });
});
