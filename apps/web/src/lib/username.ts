/**
 * Die Regeln fuer Benutzernamen.
 *
 * Der Benutzername ist die Adresse eines Profils: er steht in der URL,
 * in jeder Erwaehnung und unter allem, was jemand geschrieben hat. Er
 * ist damit naeher an einer Kennung als an einem Anzeigenamen — wer ihn
 * aendert, laesst fremde Links ins Leere laufen.
 *
 * **Nur Kleinbuchstaben**, seit M3 (Migration 20260826130000). Der Grund
 * steht dort: gemischte Schreibung braeuchte einen eigenen Index fuer
 * die Eindeutigkeit, sonst koennten `BingeLog` und `bingelog` beide
 * existieren — zwei Profile, die in jeder Erwaehnung gleich aussehen.
 */
export const NAME_MUSTER = /^[a-z0-9_]{3,20}$/;

/**
 * Aus einer Eingabe einen zulaessigen Namen machen.
 *
 * Kleinschreiben statt abweisen: wer „BingeLog" tippt, meint
 * „bingelog", und eine Fehlermeldung dafuer ist eine Huerde ohne
 * Zweck. Zeichen, die es nicht gibt, fallen weg — auch das sofort und
 * sichtbar, statt spaeter als rote Zeile.
 */
export function bereinigen(eingabe: string): string {
  return eingabe
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export type Namenslage =
  | { lage: 'leer' }
  | { lage: 'zu_kurz' }
  | { lage: 'frei' }
  | { lage: 'vergeben' }
  | { lage: 'reserviert'; grund: string };

export function namenstext(l: Namenslage): string {
  switch (l.lage) {
    case 'leer':
      return '';
    case 'zu_kurz':
      return 'Mindestens drei Zeichen.';
    case 'frei':
      return 'Frei.';
    case 'vergeben':
      return 'Schon vergeben.';
    case 'reserviert':
      return 'Dieser Name ist reserviert.';
  }
}
