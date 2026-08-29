'use client';

import { useState, useTransition } from 'react';

/**
 * Eine sortierbare, geblaetterte Tabelle fuers Dashboard (M4 4.7).
 *
 * Zwanzig Zeilen je Seite. Kopfzeilen schalten die Sortierung um: erster
 * Klick sortiert, zweiter dreht die Richtung. Die Sortierung passiert in
 * der Datenbank und nicht hier — sonst waere sie nur innerhalb der
 * gerade sichtbaren zwanzig, was schlimmer ist als keine, weil es
 * aussieht wie eine.
 */
export interface Spalte<T> {
  /** Der Name, den die Datenbank kennt. Null heisst: nicht sortierbar. */
  key: string | null;
  label: string;
  /** Zahlen rechtsbuendig, Text links. */
  zahl?: boolean;
  zelle: (zeile: T) => React.ReactNode;
}

export function AdminTable<T>({
  spalten,
  zeilen,
  gesamt,
  seite,
  sortieren,
  absteigend,
  laedt,
  onSortieren,
  onSeite,
  schluessel,
}: {
  spalten: Spalte<T>[];
  zeilen: T[];
  gesamt: number;
  seite: number;
  sortieren: string;
  absteigend: boolean;
  laedt: boolean;
  onSortieren: (key: string) => void;
  onSeite: (seite: number) => void;
  schluessel: (zeile: T) => string;
}) {
  const seiten = Math.max(1, Math.ceil(gesamt / 20));

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border bg-card/60 border-b">
              {spalten.map((s) => (
                <th
                  key={s.label}
                  scope="col"
                  className={`px-3 py-2.5 font-medium ${s.zahl ? 'text-right' : 'text-left'}`}
                >
                  {s.key === null ? (
                    <span className="text-muted-foreground text-xs">{s.label}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSortieren(s.key ?? '');
                      }}
                      className={`text-xs ${
                        sortieren === s.key ? 'text-foreground' : 'text-muted-foreground'
                      } hover:text-foreground`}
                    >
                      {s.label}
                      {sortieren === s.key ? (absteigend ? ' ↓' : ' ↑') : ''}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={laedt ? 'opacity-50' : ''}>
            {zeilen.length === 0 ? (
              <tr>
                <td
                  colSpan={spalten.length}
                  className="text-muted-foreground px-3 py-6 text-center text-sm"
                >
                  Nichts gefunden.
                </td>
              </tr>
            ) : (
              zeilen.map((z) => (
                <tr key={schluessel(z)} className="border-border/60 hover:bg-card/40 border-b">
                  {spalten.map((s) => (
                    <td
                      key={s.label}
                      className={`px-3 py-2.5 ${s.zahl ? 'text-right tabular-nums' : ''}`}
                    >
                      {s.zelle(z)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground text-xs tabular-nums">
          {gesamt} Einträge · Seite {seite} von {seiten}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={seite <= 1 || laedt}
            onClick={() => {
              onSeite(seite - 1);
            }}
            className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm disabled:opacity-30"
          >
            Zurück
          </button>
          <button
            type="button"
            disabled={seite >= seiten || laedt}
            onClick={() => {
              onSeite(seite + 1);
            }}
            className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm disabled:opacity-30"
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}

/** Der Zustand, den beide Listen teilen. */
export function useListe<T>(
  laden: (such: string, sortieren: string, absteigend: boolean, seite: number) => Promise<T[]>,
  startSortierung: string,
) {
  const [zeilen, setZeilen] = useState<T[]>([]);
  const [such, setSuch] = useState('');
  const [sortieren, setSortieren] = useState(startSortierung);
  const [absteigend, setAbsteigend] = useState(true);
  const [seite, setSeite] = useState(1);
  const [laedt, starte] = useTransition();

  const holen = (s: string, sort: string, ab: boolean, p: number) => {
    setSuch(s);
    setSortieren(sort);
    setAbsteigend(ab);
    setSeite(p);
    starte(async () => {
      setZeilen(await laden(s, sort, ab, p));
    });
  };

  return {
    zeilen,
    such,
    sortieren,
    absteigend,
    seite,
    laedt,
    holen,
    // Erster Klick sortiert absteigend, zweiter dreht um. Absteigend
    // zuerst, weil man bei "meiste Eintraege" oben anfangen will.
    umschalten: (key: string) => {
      holen(such, key, key === sortieren ? !absteigend : true, 1);
    },
    suchen: (s: string) => {
      holen(s, sortieren, absteigend, 1);
    },
    blaettern: (p: number) => {
      holen(such, sortieren, absteigend, p);
    },
  };
}
