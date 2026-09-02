import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';

import { genreArtwork, genreLabel } from '@/lib/genres';

export interface GenreKachel {
  genre_id: string;
  label: string;
  films: number;
}

/**
 * Eine Genre-Kachel, wie auf dem iPhone (19-web-nachziehen 1–3).
 *
 * Bild oben, kurzer Name darunter, Anzahl klein. Zwei Dinge, die auf
 * dem iPhone erst nachträglich aufgefallen sind und hier deshalb von
 * Anfang an gelten:
 *
 * - **Alle Kacheln gleich hoch.** Eine Beschriftung, die auf zwei
 *   Zeilen umbricht, machte ihre Kachel höher als die Nachbarn, und der
 *   Schieber wurde zur Zickzacklinie. Der Name belegt deshalb beide
 *   Zeilen, ob er sie braucht oder nicht (`min-h`, zwei Zeilen).
 * - **Die Bilder brauchen den dunklen Grund unter sich**, keinen
 *   eigenen Rahmen. Sie sind freigestellt.
 */
export function GenreTile({ kachel }: { kachel: GenreKachel }) {
  const bild = genreArtwork(kachel.genre_id);
  const name = genreLabel(kachel.genre_id, kachel.label);

  return (
    <Link
      href={`/genre/${kachel.genre_id}` as Route}
      className="border-border bg-card/60 hover:border-primary/60 hover:bg-card flex w-36 flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-colors"
    >
      {/* Ein fester Platz, ob mit Bild oder ohne — sonst stehen die
          Kacheln ohne Symbol niedriger als ihre Nachbarn. */}
      <span className="flex h-16 w-16 items-center justify-center">
        {bild ? (
          <Image src={bild} alt="" width={64} height={64} className="h-16 w-16 object-contain" />
        ) : (
          <span className="bg-muted/30 h-10 w-10 rounded-full" aria-hidden />
        )}
      </span>

      <span className="flex min-h-[2.5rem] items-center text-center text-sm font-medium leading-tight">
        {name}
      </span>

      <span className="text-muted-foreground text-xs tabular-nums">{kachel.films} Filme</span>
    </Link>
  );
}
