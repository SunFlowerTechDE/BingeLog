'use client';

import { useState, useTransition } from 'react';

import { friendsForFilm, recommendFilm, type Freund } from '@/lib/recommend-actions';
import { ActionNote } from '@/components/action-note';

/**
 * „Weiterempfehlen" auf der Filmseite (Entdecken-Konzept 5).
 *
 * Die Freunde werden **beim Aufklappen** geholt, nicht mit der Seite —
 * die meisten Aufrufe fassen den Knopf nie an. Dieselbe Aufteilung wie
 * bei den Binge-Listen.
 */
export function RecommendButton({ filmId }: { filmId: string }) {
  const [offen, setOffen] = useState(false);
  const [freunde, setFreunde] = useState<Freund[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [notiz, setNotiz] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  function aufklappen() {
    setOffen(true);
    if (freunde !== null) return;
    startTransition(async () => {
      setFreunde(await friendsForFilm(filmId));
    });
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={aufklappen}
        className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm"
      >
        Weiterempfehlen
      </button>
    );
  }

  return (
    <div className="border-border bg-card/60 flex w-full max-w-sm flex-col gap-3 rounded-md border p-3">
      {freunde === null ? (
        <p className="text-muted-foreground text-sm">Lädt…</p>
      ) : freunde.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Empfehlen geht nur unter Freunden — also wenn ihr euch gegenseitig folgt.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {freunde.map((freund) => (
              <li key={freund.id}>
                <label className="hover:bg-card flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={gewaehlt.has(freund.id) || freund.already_sent}
                    disabled={freund.already_sent}
                    onChange={(event) => {
                      const naechste = new Set(gewaehlt);
                      if (event.target.checked) naechste.add(freund.id);
                      else naechste.delete(freund.id);
                      setGewaehlt(naechste);
                    }}
                  />
                  <span>{freund.username}</span>
                  {freund.already_sent ? (
                    <span className="text-muted-foreground text-xs">schon empfohlen</span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={notiz}
              maxLength={50}
              onChange={(event) => {
                setNotiz(event.target.value);
              }}
              placeholder="Ein Satz dazu, optional"
              aria-label="Notiz, optional"
              className="border-border bg-card focus:ring-ring rounded-md border px-2.5 py-1.5 text-sm outline-none focus:ring-2"
            />
            <span className="text-muted-foreground text-right text-[11px] tabular-nums">
              {50 - notiz.length}
            </span>
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        {freunde !== null && freunde.length > 0 ? (
          <button
            type="button"
            disabled={laeuft || gewaehlt.size === 0}
            onClick={() => {
              setProblem(undefined);
              setMeldung(undefined);
              startTransition(async () => {
                const ergebnis = await recommendFilm(filmId, [...gewaehlt], notiz);
                if (ergebnis.error !== undefined) {
                  setProblem(ergebnis.error);
                  return;
                }
                setMeldung(
                  ergebnis.sent === 1 ? 'Empfohlen.' : `An ${String(ergebnis.sent)} empfohlen.`,
                );
                setGewaehlt(new Set());
                setNotiz('');
                setFreunde(await friendsForFilm(filmId));
              });
            }}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            Empfehlen
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setOffen(false);
          }}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Schließen
        </button>
      </div>

      <ActionNote message={problem ?? meldung} />
    </div>
  );
}
