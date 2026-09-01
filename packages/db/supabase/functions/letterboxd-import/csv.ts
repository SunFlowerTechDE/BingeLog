/**
 * Die CSV-Dateien eines Letterboxd-Exports erkennen und lesen.
 *
 * **Erkannt wird an den Spalten, nicht am Dateinamen.** Aendert
 * Letterboxd morgen `diary.csv` in `journal.csv`, laeuft der Import
 * weiter. Der Dateiname entscheidet nur dort, wo die Spalten identisch
 * sind: `watched.csv`, `watchlist.csv` und `likes/films.csv` haben
 * dieselben vier Spalten und lassen sich anders nicht auseinanderhalten.
 */

export type ItemKind = 'watched' | 'diary' | 'watchlist' | 'like';

export interface ImportRow {
  kind: ItemKind;
  title: string;
  year: number | null;
  uri: string | null;
  /** Auf der internen Skala 1..10, oder null. */
  rating: number | null;
  watchedOn: string | null;
  review: string | null;
  /** Der Platz, nur fuer Favoriten aus `profile.csv`. */
  ord?: number;
}

/**
 * Ein Feld-Parser, der Anfuehrungszeichen und Zeilenumbrueche darin
 * versteht.
 *
 * Rezensionen enthalten Umbrueche, und ein `split('\n')` zerlegt sie
 * mitten im Satz. Deshalb Zeichen fuer Zeichen statt Zeile fuer Zeile.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  // Ein BOM am Anfang gehoert nicht zur ersten Spaltenueberschrift.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];

  return rows
    .filter((r) => r.some((value) => value.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((name, index) => [name.trim(), r[index] ?? ''])));
}

/** Woran eine Datei zu erkennen ist. */
export function kindFor(fileName: string, columns: string[]): ItemKind | null {
  const has = (name: string) => columns.some((c) => c.toLowerCase() === name);
  const lower = fileName.toLowerCase();

  // Ohne Filmtitel ist es keine Filmdatei. `comments.csv`,
  // `likes/reviews.csv` und `likes/lists.csv` haben nur `Date,Content` —
  // ohne diese Zeile faenge die Regel weiter unten sie als "like" ein.
  if (!has('name')) return null;

  // Von speziell nach allgemein: eine Rezensionsdatei hat alles, was
  // eine Tagebuchdatei hat, und den Text dazu.
  if (has('review')) return 'diary';
  if (has('watched date')) return 'diary';

  // `ratings.csv` hat eine Bewertung, aber kein Sichtungsdatum: das ist
  // "gesehen und bewertet", ohne Tagebucheintrag.
  if (has('rating')) return 'watched';

  // Ab hier sind die Spalten gleich — nur der Name unterscheidet noch.
  if (lower.includes('watchlist')) return 'watchlist';
  if (lower.includes('watched')) return 'watched';

  // `likes/films.csv` sind angesehene Filme, die jemand mag — nicht
  // seine Favoriten. Die vier Favoriten stehen in `profile.csv`. Und
  // gesehen sind die gelikten ohnehin schon ueber `watched.csv`, also
  // gibt es hier nichts zu holen.
  return null;
}

/**
 * Ordner, die nicht importiert werden.
 *
 * `deleted/` und `orphaned/` enthalten Eintraege, die der Nutzer bei
 * Letterboxd **geloescht** hat. Sie mitzunehmen hiesse, sie
 * wiederauferstehen zu lassen — und zwar in einem anderen Dienst, wo er
 * sie nicht mehr findet.
 */
export function isIgnoredPath(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.startsWith('deleted/') ||
    lower.startsWith('orphaned/') ||
    lower.includes('/deleted/') ||
    lower.includes('/orphaned/')
  );
}

/**
 * Die vier Favoriten aus `profile.csv`.
 *
 * Sie stehen dort als Letterboxd-Adressen, nicht als Titel — aufgeloest
 * werden sie ueber die Adressen der uebrigen Dateien.
 */
export function favouriteUris(records: Record<string, string>[]): string[] {
  const raw = records[0]?.['Favorite Films'] ?? '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/**
 * Doppelte Zeilen zusammenfuehren.
 *
 * `watched.csv` und `ratings.csv` fuehren **dieselben Filme** — im
 * echten Export beide siebzig Zeilen. Ohne Zusammenfuehren gewinnt die
 * Datei, die zuerst im Archiv liegt, und das ist `watched.csv`: alle
 * siebzig Bewertungen waeren verloren.
 *
 * Und ein Film, der einen datierten Tagebucheintrag hat, braucht
 * daneben keinen undatierten "irgendwann gesehen" — das waere derselbe
 * Abend zweimal.
 */
export function merge(rows: ImportRow[]): ImportRow[] {
  const byKey = new Map<string, ImportRow>();

  for (const row of rows) {
    const key = [row.kind, row.title.toLowerCase(), row.year ?? '', row.watchedOn ?? ''].join('|');
    const seen = byKey.get(key);

    if (!seen) {
      byKey.set(key, { ...row });
      continue;
    }

    // Was etwas weiss, schlaegt was nichts weiss.
    byKey.set(key, {
      ...seen,
      rating: seen.rating ?? row.rating,
      review: seen.review ?? row.review,
      uri: seen.uri ?? row.uri,
    });
  }

  const merged = [...byKey.values()];

  // Filme mit datiertem Eintrag brauchen den undatierten nicht mehr.
  const dated = new Set(
    merged
      .filter((r) => r.kind === 'diary' && r.watchedOn !== null)
      .map((r) => `${r.title.toLowerCase()}|${r.year ?? ''}`),
  );

  return merged.filter(
    (r) => !(r.kind === 'watched' && dated.has(`${r.title.toLowerCase()}|${r.year ?? ''}`)),
  );
}

/**
 * Letterboxd zaehlt in Sternen von 0,5 bis 5, wir in halben Schritten
 * von 1 bis 10. **Keine Umrechnung, nur eine andere Schreibweise**:
 * 4,5 Sterne sind 4,5 Popcorn.
 */
export function ratingToScale(raw: string | undefined): number | null {
  const stars = Number.parseFloat((raw ?? '').trim());
  if (!Number.isFinite(stars) || stars <= 0) return null;
  const value = Math.round(stars * 2);
  return value >= 1 && value <= 10 ? value : null;
}

export function toRow(kind: ItemKind, record: Record<string, string>): ImportRow | null {
  const title = (record['Name'] ?? '').trim();
  if (title === '') return null;

  const year = Number.parseInt((record['Year'] ?? '').trim(), 10);
  const watched = (record['Watched Date'] ?? '').trim();
  const review = (record['Review'] ?? '').trim();

  return {
    // Ohne Sichtungsdatum ist es kein Tagebucheintrag, sondern nur
    // "gesehen". Ein Datum zu erfinden waere eine Behauptung ueber
    // jemandes Leben.
    kind: kind === 'diary' && watched === '' ? 'watched' : kind,
    title,
    year: Number.isFinite(year) ? year : null,
    uri: (record['Letterboxd URI'] ?? '').trim() || null,
    rating: ratingToScale(record['Rating']),
    watchedOn: watched === '' ? null : watched,
    review: review === '' ? null : review,
  };
}
