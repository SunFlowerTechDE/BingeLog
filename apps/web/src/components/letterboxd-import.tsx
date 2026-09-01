'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Die eigene Filmhistorie aus einem Letterboxd-Export uebernehmen.
 *
 * Der Nutzer laedt seinen **eigenen** Export hoch — kein Scraping, keine
 * Abfrage eines fremden Profils ueber einen Benutzernamen.
 *
 * Zwei Schritte, und darin liegt der Sinn: analysieren liest die Datei
 * und beantwortet die Vorschau, ohne etwas am Konto zu aendern. Erst
 * "Import starten" schreibt.
 *
 * Eine Client-Komponente und keine Server Action: der Import laeuft in
 * Scheiben, und jede Scheibe soll den Fortschritt sichtbar
 * weiterschieben. Eine Server Action antwortet einmal.
 */

interface Preview {
  total: number;
  films_known: number;
  films_new: number;
  ratings: number;
  diary: number;
  reviews: number;
  watchlist: number;
  needs_review: number;
}

interface Step {
  done: boolean;
  remaining: number;
  imported: number;
  failed: number;
  needs_review: number;
}

/** Wie weit der Import ist, so wie ihn der Server fuehrt. */
interface Stand {
  fertig: number;
  gesamt: number;
}

type Phase =
  | { art: 'start' }
  | { art: 'liest' }
  | { art: 'vorschau'; batch: string; zahlen: Preview }
  | { art: 'laeuft'; batch: string; stand: Stand }
  | { art: 'fertig'; stand: Step };

/** Dieselbe Grenze wie am Eimer, damit sie vor dem Hochladen greift. */
const MAX_BYTES = 26_214_400;

export function LetterboxdImport() {
  const [phase, setPhase] = useState<Phase>({ art: 'start' });
  const [problem, setProblem] = useState<string | undefined>(undefined);

  async function analysiere(datei: File) {
    setProblem(undefined);

    if (datei.size > MAX_BYTES) {
      setProblem('Die Datei ist zu groß. Höchstens 25 MB.');
      return;
    }

    setPhase({ art: 'liest' });
    const supabase = createClient();

    const { data: session } = await supabase.auth.getUser();
    if (!session.user) {
      setProblem('Melde dich an.');
      setPhase({ art: 'start' });
      return;
    }

    // Erst der Stapel: seine Id ist der Dateiname, und der Ordner ist
    // die Benutzer-Id — genau das prueft die Policy am Eimer.
    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({ user_id: session.user.id })
      .select('id')
      .single();

    if (batchError) {
      setProblem('Der Import ließ sich nicht anlegen.');
      setPhase({ art: 'start' });
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from('imports')
      .upload(`${session.user.id}/${batch.id}.zip`, datei, { contentType: 'application/zip' });

    if (uploadError) {
      setProblem('Die Datei ließ sich nicht hochladen.');
      setPhase({ art: 'start' });
      return;
    }

    const antwort = await supabase.functions.invoke<Preview & { error?: string }>(
      'letterboxd-import',
      { body: { batchId: batch.id, mode: 'analyse' } },
    );
    const zahlen = antwort.data;

    if (antwort.error !== null || !zahlen || zahlen.error) {
      // Den Grund traegt der Stapel, wenn die Function ihn hinterlegt
      // hat. Die Datenquelle wird dabei nicht genannt.
      const { data: stand } = await supabase
        .from('import_batches')
        .select('error')
        .eq('id', batch.id)
        .maybeSingle();
      setProblem(meldung(stand?.error ?? null));
      setPhase({ art: 'start' });
      return;
    }

    setPhase({ art: 'vorschau', batch: batch.id, zahlen });
  }

  /**
   * Scheibe fuer Scheibe, bis nichts mehr offen ist.
   *
   * Der Server merkt sich den Stand; bricht die Verbindung ab, geht es
   * beim naechsten Aufruf weiter statt von vorn.
   */
  async function starte(batch: string, gesamt: number) {
    setProblem(undefined);
    setPhase({ art: 'laeuft', batch, stand: { fertig: 0, gesamt } });

    const supabase = createClient();

    // Zwei Dinge gleichzeitig: die Scheiben laufen, und daneben wird
    // gefragt, wie weit sie sind. Die Function schreibt den Stand nach
    // **jedem** Film — ohne dieses Nachfragen saehe man ihn erst, wenn
    // eine ganze Scheibe durch ist, und der Balken spraenge.
    // Als Objekt und nicht als `let`: TypeScript engt eine lokale
    // Variable auf `true` ein, weil es die Aenderung aus der anderen
    // Schleife nicht sieht.
    const lauf = { an: true };
    // Ueber eine Funktion gelesen: sonst engt TypeScript den Wert
    // innerhalb der Schleife auf `true` ein und haelt die zweite
    // Pruefung fuer ueberfluessig. Sie ist es nicht — ohne sie
    // ueberschriebe der letzte Durchlauf das fertige Ergebnis.
    const laeuftNoch = () => lauf.an;

    const beobachten = (async () => {
      while (laeuftNoch()) {
        await new Promise((r) => setTimeout(r, 700));
        if (!laeuftNoch()) return;

        const { data } = await supabase
          .from('import_batches')
          .select('processed_items, total_items')
          .eq('id', batch)
          .maybeSingle();

        if (data) {
          setPhase({
            art: 'laeuft',
            batch,
            stand: {
              fertig: data.processed_items,
              gesamt: data.total_items > 0 ? data.total_items : gesamt,
            },
          });
        }
      }
    })();

    try {
      for (;;) {
        const antwort = await supabase.functions.invoke<Step>('letterboxd-import', {
          body: { batchId: batch, mode: 'run' },
        });
        const stand = antwort.data;

        if (antwort.error !== null || !stand) {
          setProblem(
            'Der Import wurde unterbrochen. Starte ihn noch einmal — es geht weiter, wo er stehengeblieben ist.',
          );
          return;
        }

        if (stand.done) {
          setPhase({ art: 'fertig', stand });
          return;
        }
      }
    } finally {
      lauf.an = false;
      await beobachten;
    }
  }

  async function verwerfe(batch: string) {
    const supabase = createClient();
    await supabase.from('import_batches').delete().eq('id', batch);
    setPhase({ art: 'start' });
  }

  return (
    <section className="border-border bg-card/40 flex flex-col gap-4 rounded-lg border p-5">
      <h2 className="text-base font-semibold tracking-tight">Von Letterboxd importieren</h2>

      {phase.art === 'start' ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground max-w-prose text-sm">
            Lade deinen Letterboxd-Datenexport hoch und übernimm deine bisherige Filmhistorie —
            Bewertungen, Tagebuch, Rezensionen und Watchlist.
          </p>
          <p className="text-muted-foreground max-w-prose text-xs">
            Den Export bekommst du bei Letterboxd unter Einstellungen, Daten, Export. Lade die
            ZIP-Datei hoch, so wie du sie bekommen hast.
          </p>

          <label className="border-border hover:bg-card w-fit cursor-pointer rounded-md border px-3 py-2 text-sm">
            Datei auswählen
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const datei = event.target.files?.[0];
                // Zuruecksetzen, damit dieselbe Datei ein zweites Mal
                // gewaehlt werden kann.
                event.target.value = '';
                if (datei) void analysiere(datei);
              }}
            />
          </label>

          <p className="text-muted-foreground/70 text-xs">
            Die Datei wird nur gelesen und danach gelöscht. Bis du bestätigst, ändert sich an deinem
            Konto nichts.
          </p>
        </div>
      ) : null}

      {phase.art === 'liest' ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm">Deine Daten werden gelesen.</p>
          <p className="text-muted-foreground text-xs">Noch wird nichts übernommen.</p>
        </div>
      ) : null}

      {phase.art === 'vorschau' ? (
        <div className="flex flex-col gap-3">
          <dl className="border-border flex flex-col gap-1.5 rounded-md border p-4 text-sm">
            <Zeile label="Einträge insgesamt" wert={phase.zahlen.total} />
            <Zeile label="Bewertungen" wert={phase.zahlen.ratings} />
            <Zeile label="Tagebucheinträge" wert={phase.zahlen.diary} />
            <Zeile label="Rezensionen" wert={phase.zahlen.reviews} />
            <Zeile label="Watchlist" wert={phase.zahlen.watchlist} />
            <Zeile label="Filme schon im Katalog" wert={phase.zahlen.films_known} />
            <Zeile label="Filme, die neu aufgenommen werden" wert={phase.zahlen.films_new} />
            {phase.zahlen.needs_review > 0 ? (
              <Zeile
                label="Filme, die wir nicht sicher zuordnen können"
                wert={phase.zahlen.needs_review}
              />
            ) : null}
          </dl>

          {phase.zahlen.films_new > 0 ? (
            <p className="text-muted-foreground max-w-prose text-xs">
              {phase.zahlen.films_new} Filme fehlen noch im Katalog. Sie werden während des Imports
              hinzugefügt — danach stehen sie für alle bereit.
            </p>
          ) : null}

          <p className="text-muted-foreground max-w-prose text-xs">
            Was du hier schon eingetragen hast, bleibt. Ergänzt wird nur, was fehlt.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void starte(phase.batch, phase.zahlen.total)}
              className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
            >
              Import starten
            </button>
            <button
              type="button"
              onClick={() => void verwerfe(phase.batch)}
              className="text-muted-foreground text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {phase.art === 'laeuft' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm tabular-nums">
            {phase.stand.fertig} von {phase.stand.gesamt} übernommen
          </p>
          <div className="bg-card h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-[width] duration-500 ease-linear"
              style={{
                width: `${String(
                  Math.round((phase.stand.fertig / Math.max(1, phase.stand.gesamt)) * 100),
                )}%`,
              }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Das kann bei vielen Filmen ein paar Minuten dauern. Lass die Seite offen.
          </p>
        </div>
      ) : null}

      {phase.art === 'fertig' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Import abgeschlossen</p>
          <dl className="border-border flex flex-col gap-1.5 rounded-md border p-4 text-sm">
            <Zeile label="Übernommen" wert={phase.stand.imported} />
            {phase.stand.needs_review > 0 ? (
              <Zeile label="Brauchen deine Hilfe" wert={phase.stand.needs_review} />
            ) : null}
            {phase.stand.failed > 0 ? (
              <Zeile label="Nicht zugeordnet" wert={phase.stand.failed} />
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => {
              setPhase({ art: 'start' });
            }}
            className="text-primary w-fit text-sm"
          >
            Fertig
          </button>
        </div>
      ) : null}

      {problem ? <p className="text-sm text-red-400">{problem}</p> : null}
    </section>
  );
}

function Zeile({ label, wert }: { label: string; wert: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{wert}</dd>
    </div>
  );
}

/**
 * Warum es nicht ging.
 *
 * **Die Datenquelle wird nicht genannt** — der Nutzer soll nicht
 * erfahren, woher fehlende Filme kommen, sondern nur, dass sie
 * hinzugefuegt werden.
 */
function meldung(code: string | null): string {
  switch (code) {
    case 'bad_zip':
      return 'Das sieht nicht nach einem Letterboxd-Export aus. Lade das ZIP hoch, so wie du es bekommen hast.';
    case 'nothing_found':
      return 'In der Datei war nichts zu importieren.';
    case 'upload_missing':
      return 'Die Datei ließ sich nicht lesen.';
    default:
      return 'Der Import ist gerade nicht erreichbar. Versuch es später noch einmal.';
  }
}
