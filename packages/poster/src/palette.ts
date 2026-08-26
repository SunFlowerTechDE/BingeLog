/**
 * The colour system for the procedural card.
 *
 * A fixed set of pairs picked by hash, never generated HSL values. Random
 * hue and lightness produce combinations that are muddy, illegible or
 * simply ugly, and a poster grid shows every one of them side by side
 * (M2 2.1).
 *
 * Every pair is dark-grounded: the app's base theme is dark and posters
 * read better on it (02-product.md). Contrast is what carries a 120 px
 * tile, so each pair is checked against WCAG AA for large text.
 */

export interface PosterPalette {
  /** Deep ground the card is built on. */
  background: string;
  /** The title. Carries the card, so it takes the strongest contrast. */
  title: string;
  /** Year, director, rules. Deliberately quieter than the title. */
  secondary: string;
  /** The generative pattern. Sits close to the background by design. */
  accent: string;
}

/**
 * Ten pairs. Enough that a grid does not visibly repeat, few enough that
 * every one of them has been looked at.
 */
export const PALETTES: readonly PosterPalette[] = [
  // Ink
  { background: '#12161d', title: '#f2f0ea', secondary: '#8d97a8', accent: '#1d2431' },
  // Oxblood
  { background: '#22100f', title: '#f6e9e2', secondary: '#b08578', accent: '#331a18' },
  // Forest
  { background: '#0f1a15', title: '#e9f2ea', secondary: '#7fa38d', accent: '#182a22' },
  // Cobalt
  { background: '#101526', title: '#e8ecfa', secondary: '#8590b8', accent: '#1a2340' },
  // Ochre
  { background: '#1d1708', title: '#f7f0dd', secondary: '#b1a072', accent: '#2c2310' },
  // Plum
  { background: '#1b1020', title: '#f1e8f4', secondary: '#a087ac', accent: '#291935' },
  // Slate
  { background: '#15191b', title: '#eef1f2', secondary: '#8b9799', accent: '#212829' },
  // Rust
  { background: '#211308', title: '#f7ebe0', secondary: '#b48d6c', accent: '#332012' },
  // Teal
  { background: '#0c1a1d', title: '#e5f2f4', secondary: '#7ba3a9', accent: '#152a2f' },
  // Umber
  { background: '#1a1512', title: '#f2ece6', secondary: '#9c8b7d', accent: '#28211c' },
] as const;
