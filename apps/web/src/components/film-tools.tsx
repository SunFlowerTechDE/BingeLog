'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  loadFilm,
  saveFilm,
  listFilms,
  loadThread,
  lockThread,
  type FilmDetails,
  type Filmzeile,
  type Threadlage,
} from '@/lib/film-admin-actions';
import { FSK_STUFEN, FskLabel } from '@/components/fsk';
import { ActionNote } from '@/components/action-note';
import { AdminTable, useListe, type Spalte } from '@/components/admin-table';

const FELDER = [
  { name: 'title_de', label: 'Titel (deutsch)', art: 'text' },
  { name: 'title_original', label: 'Originaltitel', art: 'text' },
  { name: 'title_en', label: 'Titel (englisch)', art: 'text' },
  { name: 'release_year', label: 'Erscheinungsjahr', art: 'number' },
  { name: 'runtime_min', label: 'Laufzeit in Minuten', art: 'number' },
  { name: 'poster_url', label: 'Poster-Adresse', art: 'text' },
] as const;

/**
 * Einen Film von Hand korrigieren (M4 4.7).
 *
 * Jedes Feld, das hier geaendert wird, sperrt sich gegen den
 * Wikidata-Import — sonst waere die Korrektur beim naechsten Lauf still
 * wieder weg. Die Sperre steht sichtbar am Feld und laesst sich einzeln
 * loesen: wer einen Titel richtigstellt, will trotzdem die neue
 * Laufzeit aus der Quelle.
 */
/**
 * Die Filmliste.
 *
 * Voreingestellt nach Eintraegen absteigend: die Filme, die viele
 * eingetragen haben, sind die, bei denen ein falscher Titel oder eine
 * fehlende Freigabe am meisten Leute trifft.
 *
 * Die Spalte "von Hand" zaehlt die gesperrten Felder. Sie steht hier,
 * weil man sonst nirgends sieht, welche Filme dem Import nicht mehr
 * folgen.
 */
function Filmliste({ onWaehlen }: { onWaehlen: (id: string) => void }) {
  const l = useListe<Filmzeile>(listFilms, 'entries');
  // Erstes Laden im Effekt und nicht beim Rendern — siehe
  // account-tools.tsx.
  useEffect(() => {
    l.holen('', 'entries', true, 1);
  }, []); // bewusst einmalig: `holen` waere bei jedem Rendern neu

  const spalten: Spalte<Filmzeile>[] = [
    {
      key: 'title',
      label: 'Film',
      zelle: (z) => (
        <button
          type="button"
          onClick={() => {
            onWaehlen(z.wikidata_id);
          }}
          className="flex items-center gap-3 text-left"
        >
          <img
            src={
              z.poster_source === 'tvdb' && z.poster_url ? z.poster_url : `/poster/${z.wikidata_id}`
            }
            alt=""
            loading="lazy"
            className="bg-card h-12 w-8 shrink-0 rounded object-cover"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{z.title}</span>
            <span className="text-muted-foreground text-xs">{z.wikidata_id}</span>
          </span>
        </button>
      ),
    },
    { key: 'release_year', label: 'Jahr', zahl: true, zelle: (z) => z.release_year ?? '—' },
    { key: 'fsk', label: 'FSK', zelle: (z) => <FskLabel wert={z.fsk} size="sm" /> },
    { key: 'entries', label: 'Einträge', zahl: true, zelle: (z) => z.entries },
    {
      key: 'avg_rating',
      label: 'Ø',
      zahl: true,
      // Intern 1–10, angezeigt 0,5–5,0. Umgerechnet wird erst hier.
      zelle: (z) => (z.avg_rating === null ? '—' : (z.avg_rating / 2).toFixed(1).replace('.', ',')),
    },
    {
      key: null,
      label: 'von Hand',
      zahl: true,
      zelle: (z) =>
        z.manual === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="border-primary text-primary rounded-full border px-2 py-0.5 text-xs">
            {z.manual}
          </span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Film suchen</span>
        <input
          type="search"
          defaultValue=""
          onChange={(e) => {
            l.suchen(e.target.value);
          }}
          placeholder="Titel eingeben"
          autoComplete="off"
          className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
        />
      </label>

      <AdminTable
        spalten={spalten}
        zeilen={l.zeilen}
        gesamt={l.zeilen[0]?.gesamt ?? 0}
        seite={l.seite}
        sortieren={l.sortieren}
        absteigend={l.absteigend}
        laedt={l.laedt}
        onSortieren={l.umschalten}
        onSeite={l.blaettern}
        schluessel={(z) => z.wikidata_id}
      />
    </div>
  );
}

export function FilmTools() {
  const [film, setFilm] = useState<FilmDetails | null>(null);
  const [thread, setThread] = useState<Threadlage | null>(null);
  const [sperrgrund, setSperrgrund] = useState('');
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [fsk, setFsk] = useState<string>('');
  const [fskNote, setFskNote] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [entsperren, setEntsperren] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  const oeffnen = (id: string) => {
    void loadFilm(id).then((f) => {
      if (!f) return;
      setFilm(f);
      setWerte({
        title_de: f.title_de ?? '',
        title_original: f.title_original,
        title_en: f.title_en ?? '',
        release_year: f.release_year === null ? '' : String(f.release_year),
        runtime_min: f.runtime_min === null ? '' : String(f.runtime_min),
        poster_url: f.poster_url ?? '',
      });
      setFsk(f.fsk === null ? '' : String(f.fsk));
      setFskNote(f.fsk_note ?? '');
      setSynopsis(f.synopsis_de ?? '');
      setEntsperren([]);
      setProblem(undefined);
      setMeldung(undefined);
    });
    void loadThread(id).then((t) => {
      setThread(t);
      setSperrgrund(t?.locked_reason ?? '');
    });
  };

  const speichern = () => {
    if (!film) return;
    setProblem(undefined);
    setMeldung(undefined);

    // Nur schicken, was sich geaendert hat. Ein Feld unveraendert
    // mitzusenden wuerde es sperren, ohne dass jemand es angefasst hat.
    const changes: Record<string, string | number | null> = {};
    const alt: Record<string, string> = {
      title_de: film.title_de ?? '',
      title_original: film.title_original,
      title_en: film.title_en ?? '',
      release_year: film.release_year === null ? '' : String(film.release_year),
      runtime_min: film.runtime_min === null ? '' : String(film.runtime_min),
      poster_url: film.poster_url ?? '',
    };

    for (const f of FELDER) {
      if ((werte[f.name] ?? '') !== alt[f.name]) changes[f.name] = werte[f.name] ?? '';
    }
    if (synopsis !== (film.synopsis_de ?? '')) changes.synopsis_de = synopsis;
    if (fsk !== (film.fsk === null ? '' : String(film.fsk))) {
      changes.fsk = fsk === '' ? null : Number(fsk);
    }
    if (fskNote !== (film.fsk_note ?? '')) changes.fsk_note = fskNote;

    if (Object.keys(changes).length === 0 && entsperren.length === 0) {
      setProblem('Nichts geändert.');
      return;
    }

    startTransition(async () => {
      const r = await saveFilm(film.wikidata_id, changes, entsperren);
      if (r.error) setProblem(r.error);
      else {
        setMeldung(r.message);
        oeffnen(film.wikidata_id);
      }
    });
  };

  if (!film) {
    return <Filmliste onWaehlen={oeffnen} />;
  }

  const gesperrt = (name: string) =>
    film.manual_fields.includes(name) && !entsperren.includes(name);

  return (
    <div className="border-border bg-card/40 flex flex-col gap-5 rounded-lg border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <FskLabel wert={film.fsk} />
        <span className="font-medium">{film.title_de ?? film.title_original}</span>
        <code className="text-muted-foreground text-xs">{film.wikidata_id}</code>
        <button
          type="button"
          onClick={() => {
            setFilm(null);
          }}
          className="text-muted-foreground hover:text-foreground ml-auto text-sm underline underline-offset-4"
        >
          Anderer Film
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FELDER.map((f) => (
          <label key={f.name} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              {f.label}
              {/* Die Sperre steht am Feld und nicht in einer Fussnote:
                  sie ist die Antwort auf "warum steht hier noch mein
                  Text und nicht der aus Wikidata". */}
              {gesperrt(f.name) ? (
                <button
                  type="button"
                  onClick={() => {
                    setEntsperren([...entsperren, f.name]);
                  }}
                  title="Beim nächsten Import wieder aus Wikidata übernehmen"
                  className="border-primary text-primary rounded-full border px-2 py-0.5 text-[10px] font-normal"
                >
                  von Hand · lösen
                </button>
              ) : null}
              {entsperren.includes(f.name) ? (
                <span className="text-muted-foreground text-[10px] font-normal">
                  folgt wieder Wikidata
                </span>
              ) : null}
            </span>
            <input
              type={f.art}
              value={werte[f.name] ?? ''}
              onChange={(e) => {
                setWerte({ ...werte, [f.name]: e.target.value });
              }}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Beschreibung</span>
        <textarea
          value={synopsis}
          onChange={(e) => {
            setSynopsis(e.target.value);
          }}
          rows={4}
          className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
        />
      </label>

      <div className="border-border flex flex-col gap-3 border-t pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Altersfreigabe</span>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={fsk}
              onChange={(e) => {
                setFsk(e.target.value);
              }}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            >
              <option value="">Unbekannt</option>
              {FSK_STUFEN.map((s) => (
                <option key={s.wert} value={String(s.wert)}>
                  {s.label} — {s.text}
                </option>
              ))}
            </select>
            <FskLabel wert={fsk === '' ? null : Number(fsk)} />
          </div>
          <span className="text-muted-foreground text-xs">
            „Unbekannt" heißt nicht „ohne Beschränkung". Lieber leer lassen als raten.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Vermerk zur Freigabe</span>
          <input
            type="text"
            value={fskNote}
            onChange={(e) => {
              setFskNote(e.target.value);
            }}
            maxLength={200}
            placeholder="z. B. woher die Angabe stammt"
            className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
          />
        </label>
      </div>

      {/* Die Diskussion. Sie steht unter den Filmdaten und nicht
          dazwischen: das eine ist eine Angabe ueber den Film, das andere
          ein Eingriff in das, was Leute dort tun. */}
      {thread?.is_active ? (
        <div className="border-border flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Diskussion</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {thread.message_count} Beiträge · {thread.viewer_count} haben den Film eingetragen
            </span>
            {thread.is_locked ? (
              <span className="border-destructive text-destructive rounded-full border px-2 py-0.5 text-xs">
                geschlossen
              </span>
            ) : null}
          </div>

          {thread.is_locked ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted-foreground text-sm">Grund: {thread.locked_reason ?? '—'}</p>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => {
                  startTransition(async () => {
                    const r = await lockThread(film.wikidata_id, false, '');
                    if (r.error) setProblem(r.error);
                    else {
                      setMeldung(r.message);
                      oeffnen(film.wikidata_id);
                    }
                  });
                }}
                className="border-border hover:bg-card ml-auto rounded-md border px-3 py-1.5 text-sm"
              >
                Wieder öffnen
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={sperrgrund}
                onChange={(e) => {
                  setSperrgrund(e.target.value);
                }}
                maxLength={500}
                placeholder="Warum wird geschlossen? Steht danach auf der Filmseite."
                className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
              />
              <button
                type="button"
                disabled={laeuft || sperrgrund.trim().length < 3}
                onClick={() => {
                  startTransition(async () => {
                    const r = await lockThread(film.wikidata_id, true, sperrgrund);
                    if (r.error) setProblem(r.error);
                    else {
                      setMeldung(r.message);
                      oeffnen(film.wikidata_id);
                    }
                  });
                }}
                className="border-border hover:bg-card text-muted-foreground hover:text-destructive self-start rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Diskussion schließen
              </button>
            </>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={laeuft}
          onClick={speichern}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {laeuft ? 'Speichert' : 'Speichern'}
        </button>
        <span className="text-muted-foreground text-xs">
          Geänderte Felder folgen danach nicht mehr Wikidata.
        </span>
        {film.edited_at ? (
          <span className="text-muted-foreground ml-auto text-xs">
            zuletzt von Hand: {new Date(film.edited_at).toLocaleString('de-DE')}
          </span>
        ) : null}
      </div>

      <ActionNote message={problem} />
      <ActionNote message={meldung} tone="info" />
    </div>
  );
}
