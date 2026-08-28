import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { zerlegen } from '../src/lib/discussion-text.ts';

/**
 * Der Auszeichnungssatz der Diskussion (M4 4.5).
 *
 * Die wichtigste Zusicherung steht ganz unten: was nicht zum Satz
 * gehoert, bleibt Text. Ein Beitrag darf kein Markup werden, nur weil
 * jemand spitze Klammern tippt.
 */
describe('the discussion markup', () => {
  it('leaves plain text alone', () => {
    assert.deepEqual(zerlegen('Ein guter Film.'), [{ art: 'text', wert: 'Ein guter Film.' }]);
  });

  it('reads bold before italic, so ** does not become two *', () => {
    assert.deepEqual(zerlegen('**sehr** gut'), [
      { art: 'fett', wert: 'sehr' },
      { art: 'text', wert: ' gut' },
    ]);
    assert.deepEqual(zerlegen('*leise*'), [{ art: 'kursiv', wert: 'leise' }]);
  });

  it('covers a spoiler and keeps emphasis inside it', () => {
    assert.deepEqual(zerlegen('Vorher ||er **stirbt**|| nachher'), [
      { art: 'text', wert: 'Vorher ' },
      {
        art: 'spoiler',
        teile: [
          { art: 'text', wert: 'er ' },
          { art: 'fett', wert: 'stirbt' },
        ],
      },
      { art: 'text', wert: ' nachher' },
    ]);
  });

  it('spans line breaks inside a spoiler', () => {
    const teile = zerlegen('||erste\nzweite||');
    assert.equal(teile.length, 1);
    assert.equal(teile[0]?.art, 'spoiler');
  });

  it('leaves an unclosed marker as text', () => {
    assert.deepEqual(zerlegen('||offen'), [{ art: 'text', wert: '||offen' }]);
    assert.deepEqual(zerlegen('*offen'), [{ art: 'text', wert: '*offen' }]);
  });

  it('turns nothing else into markup — no links, no images, no html', () => {
    // Der Grund fuer die Bausteine statt HTML: hier kann nichts
    // durchrutschen, weil nie HTML entsteht.
    for (const roh of [
      '<script>alert(1)</script>',
      '[Klick](https://example.com)',
      '![Bild](https://example.com/a.png)',
      'https://example.com',
      '# Ueberschrift',
      '<b>fett</b>',
    ]) {
      assert.deepEqual(zerlegen(roh), [{ art: 'text', wert: roh }], roh);
    }
  });
});
