import { Symbol, type Symbolart } from '@/components/icons';

export interface Zahlen {
  members: number;
  members_7d: number;
  dormant: number;
  films: number;
  films_7d: number;
  entries: number;
  entries_7d: number;
  active_7d: number;
  reviews: number;
  lists: number;
  open_threads: number;
  open_reports: number;
}

/**
 * Eine Kachel.
 *
 * Der Zusatz unter der Zahl ist entweder ein Zuwachs oder eine
 * Einordnung — nie eine Wiederholung der Ueberschrift. "1.204 Mitglieder
 * / Mitglieder insgesamt" sagt zweimal dasselbe und einmal zu wenig.
 */
function Kachel({
  label,
  wert,
  zusatz,
  art,
  betont,
}: {
  label: string;
  wert: number;
  zusatz: string;
  art: Symbolart;
  betont?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border p-4 ${
        betont ? 'border-primary/40 bg-primary/5' : 'border-border bg-card/40'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
          betont ? 'border-primary/40 text-primary' : 'border-border bg-card text-muted-foreground'
        }`}
      >
        <Symbol art={art} size={18} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{wert.toLocaleString('de-DE')}</span>
        <span className="text-muted-foreground text-xs">{zusatz}</span>
      </div>
    </div>
  );
}

function zuwachs(n: number, wort: string): string {
  if (n === 0) return `keine ${wort} in sieben Tagen`;
  return `+${String(n)} in sieben Tagen`;
}

/**
 * Die Zahlen auf einen Blick (M4 4.7).
 *
 * Drei Gruppen, absteigend nach Dringlichkeit: was zu tun ist, wie die
 * Sache laeuft, was da ist.
 *
 * **Summen schmeicheln, Zuwaechse sagen etwas.** Unter jeder Gesamtzahl
 * steht deshalb, was in sieben Tagen dazukam. Eine Mitgliederzahl, die
 * steigt, waehrend die Eintraege stehen, sieht auf einer Kachel gut aus
 * und ist ein Alarm.
 */
export function AdminNumbers({ z }: { z: Zahlen }) {
  const quote = z.members === 0 ? 0 : Math.round((z.active_7d / z.members) * 100);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Was ansteht
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kachel
            art="melden"
            label="Offene Meldungen"
            wert={z.open_reports}
            zusatz={z.open_reports === 0 ? 'nichts zu tun' : 'warten auf eine Entscheidung'}
            betont={z.open_reports > 0}
          />
          <Kachel
            art="buch"
            label="Offene Diskussionen"
            wert={z.open_threads}
            zusatz="Filme mit freigeschalteter Diskussion"
          />
          <Kachel
            art="herz"
            label="Konten ohne Eintrag"
            wert={z.dormant}
            zusatz="angemeldet, aber nie eingetragen"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Wie es läuft
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Die wichtigste Zahl der Seite. Anmeldungen sind Neugier,
              Eintraege sind Nutzung (ADR-009). */}
          <Kachel
            art="stern"
            label="Aktiv in sieben Tagen"
            wert={z.active_7d}
            zusatz={`${String(quote)} % der Mitglieder haben etwas eingetragen`}
            betont
          />
          <Kachel
            art="popcorn"
            label="Einträge"
            wert={z.entries}
            zusatz={zuwachs(z.entries_7d, 'Einträge')}
          />
          <Kachel
            art="kompass"
            label="Mitglieder"
            wert={z.members}
            zusatz={zuwachs(z.members_7d, 'Anmeldungen')}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Was da ist
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kachel
            art="film"
            label="Filme im Katalog"
            wert={z.films}
            zusatz={
              // Vor dem 28.08.2026 wissen wir das Ankunftsdatum nicht,
              // und geraten wird hier nicht (20260828370000).
              z.films_7d === 0 ? 'keine neuen in sieben Tagen' : `+${String(z.films_7d)} neu`
            }
          />
          <Kachel
            art="feder"
            label="Rezensionen"
            wert={z.reviews}
            zusatz="Einträge mit geschriebenem Text"
          />
          <Kachel art="merken" label="Binge-Listen" wert={z.lists} zusatz="angelegte Sammlungen" />
        </div>
      </section>
    </div>
  );
}
