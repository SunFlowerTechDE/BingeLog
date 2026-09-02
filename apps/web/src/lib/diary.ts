/**
 * Das Tagebuch: Auswahl, Ordnung und Datum (Tagebuch-Konzept,
 * 19-web-nachziehen 11).
 *
 * Wie bei der Watchlist läuft alles im Browser: die Einträge kommen
 * einmal aus `diary_for_me()` und werden danach ohne Netz umgeordnet.
 * Als eigene Datei, damit sich die Regeln prüfen lassen.
 */

export interface DiaryEintrag {
  id: string;
  film_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  runtime_min: number | null;
  poster_source: string | null;
  poster_url: string | null;
  rating: number | null;
  review: string | null;
  has_spoilers: boolean;
  watched_on: string | null;
  is_rewatch: boolean;
  visibility: 'public' | 'friends' | 'private';
  created_at: string;
  genre_ids: string[];
  genre_labels: string[];
}

export function titelVon(eintrag: DiaryEintrag): string {
  return eintrag.title_de ?? eintrag.title_original;
}

/**
 * Das Datum, unter dem der Eintrag einsortiert wird.
 *
 * Ein Eintrag **ohne** Sehdatum steht unter seinem Eintragszeitpunkt.
 * Sonst stünde er als Eintrag von 1970 ganz unten — die Zeile sagt dann
 * „eingetragen am".
 *
 * **`watched_on` wird zerlegt, nicht geparst.** `new Date('2026-08-01')`
 * ist Mitternacht UTC und rutscht westlich von Greenwich auf den Vortag
 * (siehe `dates.ts`). Das Datum, an dem jemand einen Film gesehen hat,
 * hat weder Uhrzeit noch Zone.
 */
export function wirksamesDatum(eintrag: DiaryEintrag): Date {
  const teile = eintrag.watched_on === null ? null : zerlege(eintrag.watched_on);
  if (teile === null) return new Date(eintrag.created_at);
  return new Date(teile.jahr, teile.monat - 1, teile.tag);
}

function zerlege(wert: string): { jahr: number; monat: number; tag: number } | null {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
  if (!treffer) return null;
  return {
    jahr: Number(treffer[1]),
    monat: Number(treffer[2]),
    tag: Number(treffer[3]),
  };
}

export function hatSehdatum(eintrag: DiaryEintrag): boolean {
  return eintrag.watched_on !== null;
}

/**
 * Der Tag, an dem der Eintrag geschrieben wurde, in **Europe/Berlin**.
 *
 * Dieselbe Zone, in der der Server „heute gesehen" einträgt
 * (`diary-actions.ts`). Ohne sie vergleicht man ein zonenloses Datum mit
 * einem Zeitpunkt in der Zone des Lesers, und ein Eintrag um 22 Uhr
 * stünde für halb Europa als „später eingetragen" da.
 */
function erfasstAm(eintrag: DiaryEintrag): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(eintrag.created_at));
}

/**
 * Ob Sehdatum und Eintragszeitpunkt auseinanderliegen.
 *
 * Nur dann steht „eingetragen am" klein darunter. Bei einem Film, den
 * man am selben Abend einträgt, wäre die Zeile Lärm.
 */
export function spaeterEingetragen(eintrag: DiaryEintrag): boolean {
  if (eintrag.watched_on === null) return false;
  return eintrag.watched_on !== erfasstAm(eintrag);
}

/**
 * Die wievielte Sichtung ein Eintrag ist.
 *
 * **Über das ganze Tagebuch gerechnet**, nicht über die gefilterte
 * Auswahl — sonst hinge „2. Sichtung" davon ab, welcher Filter gerade
 * gesetzt ist. „3. Sichtung" sagt mehr als „Wiedergesehen", und jede
 * Sichtung bleibt ihr eigener Eintrag mit eigener Bewertung.
 */
export function sichtungsnummern(eintraege: DiaryEintrag[]): Record<string, number> {
  const jeFilm = new Map<string, DiaryEintrag[]>();
  for (const eintrag of eintraege) {
    const bisher = jeFilm.get(eintrag.film_id) ?? [];
    bisher.push(eintrag);
    jeFilm.set(eintrag.film_id, bisher);
  }

  const out: Record<string, number> = {};
  for (const gruppe of jeFilm.values()) {
    // Die ältesten zuerst: die erste Sichtung ist die erste.
    const geordnet = [...gruppe].sort((a, b) => {
      const x = wirksamesDatum(a).getTime();
      const y = wirksamesDatum(b).getTime();
      return x !== y ? x - y : a.created_at.localeCompare(b.created_at);
    });
    geordnet.forEach((eintrag, index) => {
      out[eintrag.id] = index + 1;
    });
  }
  return out;
}

export type DiaryOrdnung =
  | 'newestWatched'
  | 'oldestWatched'
  | 'bestRated'
  | 'worstRated'
  | 'alphabetical'
  | 'newestFilm'
  | 'newestLogged';

export const DIARY_ORDNUNGEN: { wert: DiaryOrdnung; label: string }[] = [
  { wert: 'newestWatched', label: 'Zuletzt gesehen' },
  { wert: 'oldestWatched', label: 'Zuerst gesehen' },
  { wert: 'bestRated', label: 'Höchste Bewertung' },
  { wert: 'worstRated', label: 'Niedrigste Bewertung' },
  { wert: 'alphabetical', label: 'Alphabetisch' },
  { wert: 'newestFilm', label: 'Erscheinungsjahr' },
  { wert: 'newestLogged', label: 'Zuletzt eingetragen' },
];

/**
 * Nach Monat gruppiert wird nur bei den beiden Datumssortierungen.
 *
 * Nach Bewertung gruppiert ergäben Monatsüberschriften, die keinen
 * Zusammenhang mehr haben.
 */
export function gruppiertNachMonat(ordnung: DiaryOrdnung): boolean {
  return ordnung === 'newestWatched' || ordnung === 'oldestWatched';
}

function vergleiche(a: number | null, b: number | null, aufsteigend: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return aufsteigend ? a - b : b - a;
}

export function sortiereEintraege(
  eintraege: DiaryEintrag[],
  ordnung: DiaryOrdnung,
): DiaryEintrag[] {
  return [...eintraege].sort((a, b) => {
    switch (ordnung) {
      case 'newestWatched':
        return wirksamesDatum(b).getTime() - wirksamesDatum(a).getTime();
      case 'oldestWatched':
        return wirksamesDatum(a).getTime() - wirksamesDatum(b).getTime();
      case 'bestRated':
        return vergleiche(a.rating, b.rating, false);
      case 'worstRated':
        return vergleiche(a.rating, b.rating, true);
      case 'alphabetical':
        return titelVon(a).localeCompare(titelVon(b), 'de', { sensitivity: 'base' });
      case 'newestFilm':
        return vergleiche(a.release_year, b.release_year, false);
      case 'newestLogged':
        return b.created_at.localeCompare(a.created_at);
    }
  });
}

export type Bewertungsstand = 'any' | 'rated' | 'unrated';

export interface DiaryAuswahl {
  term: string;
  genre: string | null;
  visibility: DiaryEintrag['visibility'] | null;
  onlyWithReview: boolean;
  onlyRewatches: boolean;
  ratedState: Bewertungsstand;
  year: number | null;
}

export const KEINE_DIARY_AUSWAHL: DiaryAuswahl = {
  term: '',
  genre: null,
  visibility: null,
  onlyWithReview: false,
  onlyRewatches: false,
  ratedState: 'any',
  year: null,
};

export function waehleEintraege(eintraege: DiaryEintrag[], auswahl: DiaryAuswahl): DiaryEintrag[] {
  const nadel = auswahl.term.trim().toLowerCase();

  return eintraege.filter((eintrag) => {
    if (
      nadel !== '' &&
      !titelVon(eintrag).toLowerCase().includes(nadel) &&
      !eintrag.title_original.toLowerCase().includes(nadel) &&
      // Auch in der eigenen Rezension suchen: „was habe ich damals über
      // den Schluss geschrieben" ist eine echte Frage an ein Tagebuch.
      !(eintrag.review ?? '').toLowerCase().includes(nadel)
    ) {
      return false;
    }
    if (auswahl.genre !== null && !eintrag.genre_ids.includes(auswahl.genre)) return false;
    if (auswahl.visibility !== null && eintrag.visibility !== auswahl.visibility) return false;
    if (auswahl.onlyWithReview && (eintrag.review ?? '') === '') return false;
    if (auswahl.onlyRewatches && !eintrag.is_rewatch) return false;
    if (auswahl.ratedState === 'rated' && eintrag.rating === null) return false;
    if (auswahl.ratedState === 'unrated' && eintrag.rating !== null) return false;
    if (auswahl.year !== null && wirksamesDatum(eintrag).getFullYear() !== auswahl.year) {
      return false;
    }
    return true;
  });
}

/** Die Jahre, die im Tagebuch wirklich vorkommen, neueste zuerst. */
export function jahre(eintraege: DiaryEintrag[]): number[] {
  const gesehen = new Set<number>();
  for (const eintrag of eintraege) gesehen.add(wirksamesDatum(eintrag).getFullYear());
  return [...gesehen].sort((a, b) => b - a);
}

export function monatsTitel(datum: Date): string {
  return datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export function monatsSchluessel(datum: Date): string {
  return `${String(datum.getFullYear())}-${String(datum.getMonth())}`;
}
