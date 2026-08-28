import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Entdecken' };

/**
 * Der Platz fuer die Entdecken-Seite (M4).
 *
 * Der Eintrag steht schon in der Kopfleiste, die Seite kommt spaeter.
 * Lieber eine Seite, die sagt was fehlt, als ein Menuepunkt, der ins
 * Leere fuehrt oder sich nicht klicken laesst — beides sieht aus wie ein
 * Fehler, und dieses hier ist keiner.
 */
export default function EntdeckenPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Entdecken</h1>
      <p className="text-muted-foreground leading-relaxed">
        Hier kommen Filme hin, die du noch nicht kennst — sortiert danach, was Leute mögen, denen du
        folgst, und was zu dem passt, was du schon eingetragen hast.
      </p>
      <p className="text-muted-foreground leading-relaxed">
        Gebaut ist das noch nicht. Bis dahin führt der Weg über die Suche.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold"
        >
          Zur Suche
        </Link>
        <Link
          href="/tagebuch"
          className="border-border hover:bg-card rounded-md border px-4 py-2 text-sm"
        >
          Ins Tagebuch
        </Link>
      </div>
    </main>
  );
}
