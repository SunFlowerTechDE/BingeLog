'use client';

import { useState, useTransition } from 'react';

import {
  findFilm,
  loadFilm,
  saveFilm,
  type FilmTreffer,
  type FilmDetails,
} from '@/lib/film-admin-actions';
import { FSK_STUFEN, FskLabel } from '@/components/fsk';
import { ActionNote } from '@/components/action-note';

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
export function FilmTools() {
  const [term, setTerm] = useState('');
  const [treffer, setTreffer] = useState<FilmTreffer[]>([]);
  const [film, setFilm] = useState<FilmDetails | null>(null);
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [fsk, setFsk] = useState<string>('');
  const [fskNote, setFskNote] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [entsperren, setEntsperren] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  const suchen = (v: string) => {
    setTerm(v);
    if (v.trim().length < 2) {
      setTreffer([]);
      return;
    }
    void findFilm(v).then(setTreffer);
  };

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
    return (
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Film suchen</span>
          <input
            type="search"
            value={term}
            onChange={(e) => {
              suchen(e.target.value);
            }}
            placeholder="Titel eingeben"
            autoComplete="off"
            className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
          />
        </label>

        <ul className="flex flex-col gap-1">
          {treffer.map((t) => (
            <li key={t.wikidata_id}>
              <button
                type="button"
                onClick={() => {
                  oeffnen(t.wikidata_id);
                }}
                className="hover:bg-card flex w-full items-center gap-3 rounded-md p-2 text-left"
              >
                <FskLabel wert={t.fsk} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {t.title_de ?? t.title_original}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {t.release_year ?? '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
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
            setTerm('');
            setTreffer([]);
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
