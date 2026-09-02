/**
 * Zuletzt gesucht — dieselben Regeln wie in der App (`SearchHistory`).
 *
 * **Lokal im Browser**, nicht im Konto. Was jemand gesucht hat, ist eine
 * Spur, die niemanden sonst angeht — und für einen Verlauf, der zwischen
 * Geräten wandert, hat noch niemand einen Grund genannt.
 */
const SCHLUESSEL = 'search.history';
const GRENZE = 8;

/**
 * Merkt sich einen Begriff.
 *
 * Als eigene Funktion, weil sich `localStorage` schlecht prüfen lässt,
 * die Regel dahinter aber gut.
 */
export function verlaufMit(term: string, bisher: string[]): string[] {
  const sauber = term.trim();
  // Unter zwei Zeichen wird gar nicht erst gesucht, also gibt es auch
  // nichts zu merken.
  if (sauber.length < 2) return bisher;

  // Ein wiederholter Begriff rückt nach vorn, statt zweimal dazustehen.
  // Groß- und Kleinschreibung zählt dabei nicht.
  const rest = bisher.filter((eintrag) => eintrag.toLowerCase() !== sauber.toLowerCase());
  return [sauber, ...rest].slice(0, GRENZE);
}

export function verlaufLesen(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const roh: unknown = JSON.parse(window.localStorage.getItem(SCHLUESSEL) ?? '[]');
    return Array.isArray(roh) ? roh.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    // Ein kaputter Eintrag ist kein Grund, die Suche stehenzulassen.
    return [];
  }
}

export function verlaufMerken(term: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SCHLUESSEL, JSON.stringify(verlaufMit(term, verlaufLesen())));
  } catch {
    // Privates Fenster, volle Ablage — beides kein Fehler, den jemand
    // sehen müsste.
  }
}

export function verlaufLeeren(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SCHLUESSEL);
  } catch {
    /* siehe oben */
  }
}
