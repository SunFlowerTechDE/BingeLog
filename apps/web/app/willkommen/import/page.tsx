import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Deine Filme' };

/**
 * Der letzte Schritt der Einrichtung.
 *
 * Wer von einer anderen Plattform kommt, hat oft Jahre an Bewertungen
 * dabei. Ihn hier zu fragen ist der Unterschied zwischen "ich fange bei
 * null an" und "meine Filmgeschichte ist schon da" — und genau daran
 * haengt, ob er bleibt.
 *
 * **Mit einem Weg daran vorbei.** Wer nichts mitbringt, soll nicht an
 * einer Frage haengenbleiben, die ihn nichts angeht.
 */
export default async function ImportFrage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/anmelden');
  if (!viewer.username) redirect('/willkommen');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Schon Filme bewertet?</h1>
        <p className="text-muted-foreground text-sm">
          Wenn du von Letterboxd kommst, kannst du deine bisherige Filmhistorie übernehmen —
          Bewertungen, Tagebuch, Rezensionen und Watchlist.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/einstellungen#import"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-center text-sm font-medium"
        >
          Von Letterboxd importieren
        </Link>

        <Link href="/" className="text-muted-foreground text-center text-sm">
          Später
        </Link>
      </div>

      <p className="text-muted-foreground/70 text-xs">
        Du findest das jederzeit wieder unter Einstellungen, Daten und Import.
      </p>
    </main>
  );
}
