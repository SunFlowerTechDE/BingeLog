/**
 * Die Symbole der Oberflaeche.
 *
 * Als Pfade im Quelltext und nicht als Bibliothek: es sind ein Dutzend
 * Zeichen, und ein Paket dafuer waere mehr Gewicht als Nutzen. Sie erben
 * die Schriftfarbe und tragen `aria-hidden` — daneben steht fast immer
 * ein Wort, und wo keins steht, traegt der Knopf ein `aria-label`. Ein
 * zweites Mal vorgelesen zu werden hilft niemandem.
 */
const PFADE = {
  film: 'M4 4h16v16H4z M4 9h16 M4 15h16 M8 4v16 M16 4v16',
  popcorn:
    'M6 8h12l-1.2 12H7.2z M6 8a2 2 0 0 1 2-3 2.5 2.5 0 0 1 4-1 2.5 2.5 0 0 1 4 1 2 2 0 0 1 2 3',
  merken: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  stern: 'M12 3l2.7 5.5 6 .9-4.35 4.2 1.03 6L12 16.8 6.62 19.6l1.03-6L3.3 9.4l6-.9z',
  herz: 'M19.5 13.6c1.3-1.3 2.5-2.9 2.5-4.9A4.7 4.7 0 0 0 17.3 4c-1.6 0-2.8.6-4.1 2h-.4C11.5 4.6 10.3 4 8.7 4A4.7 4.7 0 0 0 4 8.7c0 2 1.2 3.6 2.5 4.9l5.5 5.6z',
  feder: 'M4 20l6-6 M20 4c0 7-4 11-9 12l-3 .5.5-3C9.5 8.5 13.5 4 20 4z',
  /** Entdecken: die Kompassnadel. */
  kompass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15.5 8.5l-2 5-5 2 2-5z',
  /** Tagebuch: das aufgeschlagene Buch. */
  buch: 'M4 5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2z M20 5a2 2 0 0 0-2-2h-4v18h4a2 2 0 0 0 2-2z',
  lupe: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  pfeilRunter: 'M6 9l6 6 6-6',
  schliessen: 'M6 6l12 12 M18 6L6 18',
  /** Melden: das Fahnchen. */
  melden: 'M5 21V4h9l.6 2H20l-2 4 2 4h-6.4L13 12H5',
  /** Moderation: der Schild. */
  schild: 'M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z',
} as const;

export type Symbolart = keyof typeof PFADE;

export function Symbol({ art, size = 18 }: { art: Symbolart; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PFADE[art]} />
    </svg>
  );
}
