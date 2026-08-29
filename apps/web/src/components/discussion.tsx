'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState, useTransition } from 'react';

import { postMessage, editMessage, removeMessage } from '@/lib/discussion-actions';
import { DiscussionText } from '@/components/discussion-text';
import { ActionNote } from '@/components/action-note';
import { Avatar } from '@/components/profile-parts';
import { ReportButton } from '@/components/report-button';
import { BlockButton } from '@/components/block-button';

export interface Beitrag {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  username: string;
  avatar_url: string | null;
  eigener: boolean;
}

function wann(wert: string): string {
  const d = new Date(wert);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Der Editor. Einer fuer neue Beitraege und fuer Antworten.
 *
 * Der Hinweis auf die Auszeichnung steht darunter und nicht in einer
 * Werkzeugleiste: vier Zeichenfolgen erklaeren sich in einer Zeile, und
 * eine Leiste mit vier Knoepfen sieht nach mehr Moeglichkeiten aus, als
 * es gibt.
 */
function Editor({
  anfang = '',
  knopf,
  onSenden,
  onAbbrechen,
  laeuft,
}: {
  anfang?: string;
  knopf: string;
  onSenden: (text: string) => void;
  onAbbrechen?: () => void;
  laeuft: boolean;
}) {
  const [text, setText] = useState(anfang);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSenden(text);
        setText('');
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        rows={3}
        maxLength={2000}
        placeholder="Was denkst du?"
        className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={laeuft || text.trim() === ''}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {laeuft ? 'Sendet' : knopf}
        </button>
        {onAbbrechen ? (
          <button
            type="button"
            onClick={onAbbrechen}
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
          >
            Abbrechen
          </button>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs">
          **fett**, *kursiv*, ||Spoiler||
        </span>
      </div>
    </form>
  );
}

/**
 * Die Diskussion zu einem Film (M4 4.5).
 *
 * Was hier ankommt, hat die Datenbank schon entschieden: ohne eigene
 * Bewertung liefert die Policy null Zeilen (ADR-010). Diese Komponente
 * blendet nichts aus — sie bekommt nichts, was sie ausblenden muesste.
 */
export function Discussion({
  filmId,
  anfang,
  gesperrt,
  ich,
}: {
  filmId: string;
  anfang: Beitrag[];
  gesperrt: boolean;
  /** Wer schreibt. Fuer den sofort erscheinenden eigenen Beitrag — ohne
      das stand dort "du", bis die Seite neu geladen wurde. */
  ich: { username: string; avatarUrl: string | null };
}) {
  const [beitraege, setBeitraege] = useState(anfang);
  const [antwortAuf, setAntwortAuf] = useState<string | null>(null);
  const [aendert, setAendert] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  // Aelteste zuerst, Antworten direkt unter ihrem Beitrag. Eine Ebene,
  // nicht mehr: tiefere Verschachtelung macht aus einem Gespraech einen
  // Baum, den niemand mehr von oben liest.
  const wurzeln = beitraege.filter((b) => b.parent_id === null);
  const antworten = (id: string) => beitraege.filter((b) => b.parent_id === id);

  const senden = (text: string, parentId: string | null) => {
    setProblem(undefined);
    startTransition(async () => {
      const r = await postMessage(filmId, text, parentId);
      if (r.error) {
        setProblem(r.error);
        return;
      }
      setAntwortAuf(null);
      // Der eigene Beitrag erscheint sofort. Der Server hat ihn
      // angenommen, also ist er da.
      setBeitraege([
        ...beitraege,
        {
          id: r.id ?? '',
          parent_id: parentId,
          body: text.trim(),
          created_at: new Date().toISOString(),
          edited_at: null,
          username: ich.username,
          avatar_url: ich.avatarUrl,
          eigener: true,
        },
      ]);
    });
  };

  const speichern = (id: string, text: string) => {
    setProblem(undefined);
    startTransition(async () => {
      const r = await editMessage(filmId, id, text);
      if (r.error) {
        setProblem(r.error);
        return;
      }
      setAendert(null);
      setBeitraege(
        beitraege.map((b) =>
          b.id === id ? { ...b, body: text.trim(), edited_at: new Date().toISOString() } : b,
        ),
      );
    });
  };

  const zuruecknehmen = (id: string) => {
    setProblem(undefined);
    startTransition(async () => {
      const r = await removeMessage(filmId, id);
      if (r.error) {
        setProblem(r.error);
        return;
      }
      // Mit den Antworten darauf: sie haengen an etwas, das nicht mehr
      // dasteht.
      setBeitraege(beitraege.filter((b) => b.id !== id && b.parent_id !== id));
    });
  };

  const Kopf = ({ b }: { b: Beitrag }) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Link href={`/@${b.username}` as Route} className="flex items-center gap-2 hover:underline">
        {b.avatar_url ? (
          <img src={b.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
        ) : (
          <Avatar name={b.username} size={20} />
        )}
        <span className="font-medium">{b.username}</span>
      </Link>
      <span className="text-muted-foreground">{wann(b.created_at)}</span>
      {b.edited_at ? <span className="text-muted-foreground">bearbeitet</span> : null}
    </div>
  );

  const Werkzeuge = ({ b }: { b: Beitrag }) => (
    <div className="flex flex-wrap gap-3 pt-0.5">
      {gesperrt || b.parent_id !== null ? null : (
        <button
          type="button"
          onClick={() => {
            setAntwortAuf(antwortAuf === b.id ? null : b.id);
          }}
          className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
        >
          Antworten
        </button>
      )}
      {/* Melden steht an jedem fremden Beitrag, immer. Am eigenen
          nicht: sich selbst zu melden ist kein Fall. */}
      {b.eigener ? null : (
        <>
          <ReportButton targetKind="message" targetId={b.id} angemeldet was="Beitrag" />
          {/* Blockieren direkt am Beitrag: hier faellt auf, dass jemand
              stoert, nicht auf seinem Profil. Die Seite laedt danach
              neu, weil die Policy die Beitraege filtert. */}
          <BlockButton username={b.username} blockiert={false} />
        </>
      )}
      {b.eigener && !gesperrt ? (
        <>
          <button
            type="button"
            onClick={() => {
              setAendert(aendert === b.id ? null : b.id);
            }}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
          >
            Bearbeiten
          </button>
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              zuruecknehmen(b.id);
            }}
            className="text-muted-foreground hover:text-destructive text-xs underline underline-offset-4"
          >
            Zurücknehmen
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {beitraege.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Noch keine Diskussion zu diesem Film. Sei die erste Person.
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {wurzeln.map((b) => (
            <li key={b.id} className="flex flex-col gap-2">
              <Kopf b={b} />
              {aendert === b.id ? (
                <Editor
                  anfang={b.body}
                  knopf="Speichern"
                  laeuft={laeuft}
                  onSenden={(t) => {
                    speichern(b.id, t);
                  }}
                  onAbbrechen={() => {
                    setAendert(null);
                  }}
                />
              ) : (
                <DiscussionText body={b.body} />
              )}
              <Werkzeuge b={b} />

              {antworten(b.id).length > 0 ? (
                <ol className="border-border mt-2 flex flex-col gap-4 border-l pl-4">
                  {antworten(b.id).map((a) => (
                    <li key={a.id} className="flex flex-col gap-2">
                      <Kopf b={a} />
                      {aendert === a.id ? (
                        <Editor
                          anfang={a.body}
                          knopf="Speichern"
                          laeuft={laeuft}
                          onSenden={(t) => {
                            speichern(a.id, t);
                          }}
                          onAbbrechen={() => {
                            setAendert(null);
                          }}
                        />
                      ) : (
                        <DiscussionText body={a.body} />
                      )}
                      <Werkzeuge b={a} />
                    </li>
                  ))}
                </ol>
              ) : null}

              {antwortAuf === b.id ? (
                <div className="border-border mt-2 border-l pl-4">
                  <Editor
                    knopf="Antworten"
                    laeuft={laeuft}
                    onSenden={(t) => {
                      senden(t, b.id);
                    }}
                    onAbbrechen={() => {
                      setAntwortAuf(null);
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {/* Bei einer Sperre steht der Hinweis samt Grund ueber der
          Diskussion (film/[wikidataId]/page.tsx). Ihn hier zu
          wiederholen sagte dasselbe zweimal und das zweite Mal ohne
          Grund. */}
      {gesperrt ? null : (
        <Editor
          knopf="Beitrag schreiben"
          laeuft={laeuft}
          onSenden={(t) => {
            senden(t, null);
          }}
        />
      )}

      <ActionNote message={problem} />
    </div>
  );
}
