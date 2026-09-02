/**
 * Bild und kurzer Name je Genre — dieselbe Zuordnung wie in der App
 * (`GenreArtwork` und `GenreLabel` in `GenreTile.swift`).
 *
 * **Zugeordnet wird über die Wikidata-ID, nie über die Beschriftung.**
 * Die Beschriftung ist `label_de` aus dem Katalog und kann sich ändern,
 * ohne dass es hier jemand merkt — die ID nicht. Dasselbe Prinzip wie
 * beim Abgleich mit TheTVDB (ADR-003): abgeglichen wird über
 * Bezeichner, nie über Titel.
 *
 * Wie nötig das ist, hat sich beim Einpflegen in die App gezeigt: eine
 * der sechzehn Dateien war als `Dramady` benannt, das Genre heißt
 * `Dramedy`. Über die Beschriftung hätte diese Kachel kein Bild gehabt.
 * Im Web tragen die Dateien deshalb gleich die ID als Namen — dann gibt
 * es die Fehlerquelle nicht mehr.
 */

/** Die sechzehn Genres mit Bild, mit ihrem Namen als Kommentar. */
const MIT_BILD = new Set([
  'Q130232', // Filmdrama
  'Q157443', // Filmkomödie
  'Q157394', // Fantasyfilm
  'Q2484376', // Thriller
  'Q319221', // Abenteuerfilm
  'Q188473', // Actionfilm
  'Q959790', // Kriminalfilm
  'Q471839', // Science-Fiction-Film
  'Q842256', // Musikfilm
  'Q102429885', // Coming-of-Age-Film
  'Q200092', // Horrorfilm
  'Q1200678', // Mysteryfilm
  'Q859369', // Dramedy
  'Q93204', // Dokumentarfilm
  'Q1054574', // Liebesfilm
  'Q652256', // Monumentalfilm
]);

/**
 * Der Pfad zum freigestellten Symbol, oder `null`.
 *
 * Der Katalog kennt vierzig Genres und wächst; sechzehn Bilder sind der
 * Anfang, kein Vollständigkeitsanspruch. Die übrigen bekommen eine
 * Kachel ohne Bild, so wie auf dem iPhone.
 */
export function genreArtwork(genreId: string): string | null {
  return MIT_BILD.has(genreId) ? `/genres/${genreId}.png` : null;
}

/**
 * Kurze Namen für die Kacheln.
 *
 * Der Katalog führt die Wikidata-Beschriftung, und die schreibt das
 * „film" aus: Horrorfilm, Kriminalfilm, Filmkomödie. Auf einer Kachel
 * ist das Wort überflüssig — es steht auf allen sechzehn und
 * unterscheidet keine von der anderen.
 *
 * Eine Regel „hinten `film` abschneiden" reicht dafür nicht: aus
 * Kriminalfilm würde „Kriminal". Also von Hand, und wieder über die ID.
 *
 * **Nur die Anzeige.** Gespeichert und gesucht wird weiter mit der
 * Beschriftung aus dem Katalog.
 */
const KURZ: Record<string, string> = {
  Q130232: 'Drama', // Filmdrama
  Q157443: 'Komödie', // Filmkomödie
  Q157394: 'Fantasy', // Fantasyfilm
  Q2484376: 'Thriller', // war schon kurz
  Q319221: 'Abenteuer', // Abenteuerfilm
  Q188473: 'Action', // Actionfilm
  Q959790: 'Krimi', // Kriminalfilm — nicht "Kriminal"
  Q471839: 'Science-Fiction', // Science-Fiction-Film
  Q842256: 'Musik', // Musikfilm
  Q102429885: 'Coming of Age', // Coming-of-Age-Film
  Q200092: 'Horror', // Horrorfilm
  Q1200678: 'Mystery', // Mysteryfilm
  Q859369: 'Dramedy', // war schon kurz
  Q93204: 'Doku', // Dokumentarfilm

  // Die beiden hier sind keine Kürzung, sondern ein anderes Wort.
  // "Liebe" und "Monumental" stehen allein nicht als Genre da, und ein
  // Kachelname, den man zweimal liest, ist kein guter.
  Q1054574: 'Romantik', // Liebesfilm
  Q652256: 'Epos', // Monumentalfilm
};

/** Was auf der Kachel steht. Ohne Eintrag die Beschriftung selbst. */
export function genreLabel(genreId: string, fallback: string): string {
  return KURZ[genreId] ?? fallback;
}

/** Für den Test: die Genres mit Bild und die kurzen Namen. */
export const GENRE_ARTWORK_IDS = [...MIT_BILD];
export const GENRE_SHORT_LABELS = KURZ;
