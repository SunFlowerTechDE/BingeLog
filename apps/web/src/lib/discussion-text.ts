/**
 * Der schmale Auszeichnungssatz der Diskussion (M4 4.5).
 *
 * **Fett**, *kursiv*, Zeilenumbrueche, und `||verdeckt||` fuer Spoiler.
 * Sonst nichts. Vor allem: **keine Bilder und keine Links**. Das ist
 * kein Vergessen, sondern der wirksamste Spamschutz, den eine erste
 * Fassung haben kann — wer nicht verlinken kann, hat wenig Grund zu
 * schreiben, wenn er nur verlinken wollte.
 *
 * Warum Spoiler auch hier: unter Leuten, die den Film gesehen haben,
 * gibt es immer noch Spoiler fuer **andere** Filme — Fortsetzungen,
 * Vergleiche, das Ende eines Romans.
 *
 * Ausgegeben wird kein HTML, sondern eine Liste von Bausteinen. So kann
 * kein Text der Welt zu Markup werden: der Browser bekommt Text und die
 * Komponente entscheidet, was ein Element wird.
 */
export type Baustein =
  | { art: 'text'; wert: string }
  | { art: 'fett'; wert: string }
  | { art: 'kursiv'; wert: string }
  | { art: 'spoiler'; teile: Baustein[] };

/** Fett und kursiv innerhalb eines Stuecks. */
function betonung(text: string): Baustein[] {
  const raus: Baustein[] = [];
  // Zwei Sterne vor einem: sonst schluckt der einzelne den doppelten.
  const muster = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let zuletzt = 0;
  let treffer: RegExpExecArray | null;

  while ((treffer = muster.exec(text)) !== null) {
    if (treffer.index > zuletzt) {
      raus.push({ art: 'text', wert: text.slice(zuletzt, treffer.index) });
    }
    if (treffer[1] !== undefined) raus.push({ art: 'fett', wert: treffer[1] });
    else if (treffer[2] !== undefined) raus.push({ art: 'kursiv', wert: treffer[2] });
    zuletzt = treffer.index + treffer[0].length;
  }

  if (zuletzt < text.length) raus.push({ art: 'text', wert: text.slice(zuletzt) });
  return raus;
}

export function zerlegen(text: string): Baustein[] {
  const raus: Baustein[] = [];
  const muster = /\|\|([\s\S]+?)\|\|/g;
  let zuletzt = 0;
  let treffer: RegExpExecArray | null;

  while ((treffer = muster.exec(text)) !== null) {
    if (treffer.index > zuletzt) {
      raus.push(...betonung(text.slice(zuletzt, treffer.index)));
    }
    // Verschachtelte Spoiler gibt es nicht: ein verdeckter Block im
    // verdeckten Block deckt nichts weiter zu.
    raus.push({ art: 'spoiler', teile: betonung(treffer[1] ?? '') });
    zuletzt = treffer.index + treffer[0].length;
  }

  if (zuletzt < text.length) raus.push(...betonung(text.slice(zuletzt)));
  return raus;
}
