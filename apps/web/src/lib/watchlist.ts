/**
 * Die Watchlist: Auswahl und Ordnung (Watchlist-Konzept, 19-web-nachziehen 9).
 *
 * **Gefiltert und sortiert wird im Client**, nicht in der Datenbank.
 * Eine Watchlist hat Dutzende Einträge, keine Hunderttausend; sie einmal
 * zu holen und dann ohne Netz umzusortieren ist schneller als jede Runde
 * zum Server. Sollte das je nicht mehr stimmen, ist das der Punkt zum
 * Umdrehen.
 *
 * Als eigene Datei, weil sich eine Liste schlecht prüfen lässt, die
 * Ordnung dahinter aber gut — dieselbe Aufteilung wie in der App.
 */

export interface WatchlistEintrag {
  film_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  runtime_min: number | null;
  poster_source: string | null;
  poster_url: string | null;
  added_at: string;
  /** Interne Skala 1 bis 10; `numeric` kommt als Zeichenkette an. */
  average: number | string | null;
  votes: number;
  genre_ids: string[];
  genre_labels: string[];
  recommenders: number;
  first_friend: string | null;
  priority: 'next' | 'normal' | 'someday';
  group_ids: string[];
  friends_seen: number;
  friend_name: string | null;
  friend_rating: number | null;
}

export function titelVon(eintrag: WatchlistEintrag): string {
  return eintrag.title_de ?? eintrag.title_original;
}

export function schnittVon(eintrag: WatchlistEintrag): number | null {
  return eintrag.average === null ? null : Number(eintrag.average);
}

export type Ordnung =
  | 'newestAdded'
  | 'oldestAdded'
  | 'bestRated'
  | 'worstRated'
  | 'newestFilm'
  | 'oldestFilm'
  | 'shortest'
  | 'longest'
  | 'alphabetical'
  | 'byPriority'
  | 'bestMatch';

export const ORDNUNGEN: { wert: Ordnung; label: string }[] = [
  { wert: 'newestAdded', label: 'Zuletzt hinzugefügt' },
  { wert: 'oldestAdded', label: 'Zuerst hinzugefügt' },
  { wert: 'bestRated', label: 'Beste Bewertung' },
  { wert: 'worstRated', label: 'Niedrigste Bewertung' },
  { wert: 'newestFilm', label: 'Jahr, neu nach alt' },
  { wert: 'oldestFilm', label: 'Jahr, alt nach neu' },
  { wert: 'shortest', label: 'Kürzeste Laufzeit' },
  { wert: 'longest', label: 'Längste Laufzeit' },
  { wert: 'alphabetical', label: 'Alphabetisch' },
  { wert: 'byPriority', label: 'Priorität' },
  { wert: 'bestMatch', label: 'Beste Übereinstimmung' },
];

const RANG: Record<WatchlistEintrag['priority'], number> = { next: 0, normal: 1, someday: 2 };

export const PRIORITAETEN: { wert: WatchlistEintrag['priority']; label: string }[] = [
  { wert: 'next', label: 'Als Nächstes' },
  { wert: 'normal', label: 'Normal' },
  { wert: 'someday', label: 'Irgendwann' },
];

/**
 * Fehlende Angaben stehen **immer hinten**, in jeder Richtung.
 *
 * Ein Film ohne Laufzeit ist nicht der kürzeste, und einer ohne
 * Bewertung nicht der schlechteste. Ohne diese Regel wandern alle
 * unvollständigen Einträge beim Umschalten der Richtung nach vorn.
 */
export function vergleiche(a: number | null, b: number | null, aufsteigend: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return aufsteigend ? a - b : b - a;
}

export function sortiere(
  eintraege: WatchlistEintrag[],
  ordnung: Ordnung,
  matches: Record<string, number>,
): WatchlistEintrag[] {
  const kopie = [...eintraege];

  kopie.sort((a, b) => {
    switch (ordnung) {
      case 'newestAdded':
        return a.added_at < b.added_at ? 1 : a.added_at > b.added_at ? -1 : 0;
      case 'oldestAdded':
        return a.added_at > b.added_at ? 1 : a.added_at < b.added_at ? -1 : 0;
      case 'bestRated':
        return vergleiche(schnittVon(a), schnittVon(b), false);
      case 'worstRated':
        return vergleiche(schnittVon(a), schnittVon(b), true);
      case 'newestFilm':
        return vergleiche(a.release_year, b.release_year, false);
      case 'oldestFilm':
        return vergleiche(a.release_year, b.release_year, true);
      case 'shortest':
        return vergleiche(a.runtime_min, b.runtime_min, true);
      case 'longest':
        return vergleiche(a.runtime_min, b.runtime_min, false);
      case 'alphabetical':
        return titelVon(a).localeCompare(titelVon(b), 'de', { sensitivity: 'base' });
      case 'byPriority':
        // Innerhalb einer Stufe bleibt das Zuletzt-Hinzugefügte oben.
        // Sonst wäre die Reihenfolge innerhalb von „Normal" beliebig,
        // und beliebig sieht kaputt aus.
        return RANG[a.priority] !== RANG[b.priority]
          ? RANG[a.priority] - RANG[b.priority]
          : a.added_at < b.added_at
            ? 1
            : -1;
      case 'bestMatch':
        return vergleiche(matches[a.film_id] ?? null, matches[b.film_id] ?? null, false);
    }
  });

  return kopie;
}

export interface Auswahl {
  term: string;
  genre: string | null;
  maximumRuntime: number | null;
  onlyRecommended: boolean;
  priority: WatchlistEintrag['priority'] | null;
  group: string | null;
}

export const KEINE_AUSWAHL: Auswahl = {
  term: '',
  genre: null,
  maximumRuntime: null,
  onlyRecommended: false,
  priority: null,
  group: null,
};

/**
 * Was nach Suche und Filtern übrig bleibt.
 *
 * Ein Film **ohne** Laufzeitangabe fällt bei gesetztem Laufzeitfilter
 * heraus. Unbekannt ist nicht kurz — dieselbe Regel wie beim Jahr in
 * der Suche.
 */
export function waehle(eintraege: WatchlistEintrag[], auswahl: Auswahl): WatchlistEintrag[] {
  const nadel = auswahl.term.trim().toLowerCase();

  return eintraege.filter((eintrag) => {
    if (
      nadel !== '' &&
      !titelVon(eintrag).toLowerCase().includes(nadel) &&
      !eintrag.title_original.toLowerCase().includes(nadel)
    ) {
      return false;
    }
    if (auswahl.genre !== null && !eintrag.genre_ids.includes(auswahl.genre)) return false;
    if (auswahl.maximumRuntime !== null) {
      if (eintrag.runtime_min === null || eintrag.runtime_min > auswahl.maximumRuntime)
        return false;
    }
    if (auswahl.onlyRecommended && eintrag.recommenders === 0) return false;
    if (auswahl.priority !== null && eintrag.priority !== auswahl.priority) return false;
    if (auswahl.group !== null && !eintrag.group_ids.includes(auswahl.group)) return false;
    return true;
  });
}

/**
 * Der eine soziale Hinweis, den eine Karte trägt.
 *
 * **Nur einer.** Eine Empfehlung ist der stärkere: sie ist an mich
 * gerichtet, das Gesehenhaben ist es nicht.
 */
export function sozialerHinweis(eintrag: WatchlistEintrag): string | null {
  if (eintrag.recommenders > 0) {
    return eintrag.recommenders === 1 && eintrag.first_friend !== null
      ? `Empfohlen von ${eintrag.first_friend}`
      : `Von ${String(eintrag.recommenders)} Freunden empfohlen`;
  }
  if (eintrag.friends_seen === 0) return null;
  if (eintrag.friends_seen === 1 && eintrag.friend_name !== null) {
    return eintrag.friend_rating === null
      ? `${eintrag.friend_name} hat ihn gesehen`
      : `${eintrag.friend_name} gab ${(eintrag.friend_rating / 2).toFixed(1).replace('.', ',')} Popcorn`;
  }
  return `${String(eintrag.friends_seen)} Freunde gesehen`;
}
