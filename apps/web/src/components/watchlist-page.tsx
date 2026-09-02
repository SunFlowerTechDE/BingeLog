'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState, useTransition } from 'react';

import { PopcornRating } from '@/components/popcorn';
import { RatingInput } from '@/components/rating-input';
import { ActionNote } from '@/components/action-note';
import { rateFilm, toggleWatchlist } from '@/lib/diary-actions';
import { genreLabel } from '@/lib/genres';
import {
  KEINE_AUSWAHL,
  ORDNUNGEN,
  PRIORITAETEN,
  schnittVon,
  sortiere,
  sozialerHinweis,
  titelVon,
  waehle,
  type Auswahl,
  type Ordnung,
  type WatchlistEintrag,
} from '@/lib/watchlist';

/**
 * Die Watchlist (Watchlist-Konzept, Priorität 1 — 19-web-nachziehen 9).
 *
 * Ein Plakatraster, darüber Suche, Sortierung, Filter und „Überrasch
 * mich". Sie soll nicht nur beantworten, was gespeichert ist, sondern
 * was man als Nächstes schauen sollte.
 *
 * Alles davon läuft im Browser: die Liste kommt einmal aus
 * `watchlist_for_me()` und wird danach ohne Netz umgeordnet.
 */
export function WatchlistPage({
  eintraege,
  gruppen,
  matches,
}: {
  eintraege: WatchlistEintrag[];
  gruppen: { id: string; name: string }[];
  matches: Record<string, number>;
}) {
  const [alle, setAlle] = useState(eintraege);
  const [auswahl, setAuswahl] = useState<Auswahl>(KEINE_AUSWAHL);
  const [ordnung, setOrdnung] = useState<Ordnung>('newestAdded');
  const [ueberraschung, setUeberraschung] = useState<WatchlistEintrag | null>(null);
  const [gesehen, setGesehen] = useState<WatchlistEintrag | null>(null);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  const hatMatches = Object.keys(matches).length > 0;

  const gezeigt = useMemo(
    () => sortiere(waehle(alle, auswahl), ordnung, matches),
    [alle, auswahl, ordnung, matches],
  );

  // Nur die Genres, die in dieser Watchlist wirklich vorkommen. Ein
  // Filter, der auf nichts zeigt, ist kein Filter.
  const genres = useMemo(() => {
    const gesehene = new Map<string, string>();
    for (const eintrag of alle) {
      eintrag.genre_ids.forEach((id, i) => {
        if (!gesehene.has(id)) gesehene.set(id, genreLabel(id, eintrag.genre_labels[i] ?? id));
      });
    }
    return [...gesehene].sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [alle]);

  const hatFilter =
    auswahl.genre !== null ||
    auswahl.maximumRuntime !== null ||
    auswahl.onlyRecommended ||
    auswahl.priority !== null ||
    auswahl.group !== null;

  function entfernen(eintrag: WatchlistEintrag) {
    setAlle((bisher) => bisher.filter((e) => e.film_id !== eintrag.film_id));
    startTransition(async () => {
      const ergebnis = await toggleWatchlist(eintrag.film_id);
      if (ergebnis.error) {
        setAlle((bisher) => [eintrag, ...bisher]);
        setProblem(ergebnis.error);
      }
    });
  }

  if (alle.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">Deine vorgemerkten Filme erscheinen hier.</p>
        <p className="text-muted-foreground text-sm">Speichere Filme direkt auf ihrer Filmseite.</p>
        <Link
          href="/entdecken"
          className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium"
        >
          Filme entdecken
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={auswahl.term}
          onChange={(event) => {
            setAuswahl({ ...auswahl, term: event.target.value });
          }}
          placeholder="In der Watchlist suchen"
          aria-label="In der Watchlist suchen"
          className="border-border bg-card focus:ring-ring min-w-[12rem] flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />

        <select
          value={ordnung}
          onChange={(event) => {
            setOrdnung(event.target.value as Ordnung);
          }}
          aria-label="Sortieren"
          className="border-border bg-card rounded-md border px-3 py-2 text-sm"
        >
          {/* Ohne Geschmacksprofil steht die Übereinstimmung nicht zur
              Wahl. Ein Menüpunkt, der nichts tut, ist schlimmer als
              keiner. */}
          {ORDNUNGEN.filter((o) => o.wert !== 'bestMatch' || hatMatches).map((o) => (
            <option key={o.wert} value={o.wert}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={gezeigt.length === 0}
          onClick={() => {
            // Aus der **gefilterten** Auswahl, nicht aus der ganzen
            // Liste: wer „Horror unter 120 Minuten" eingestellt hat,
            // will keinen Dreistünder vorgeschlagen bekommen.
            setUeberraschung(gezeigt[Math.floor(Math.random() * gezeigt.length)] ?? null);
          }}
          className="border-border hover:bg-card rounded-md border px-3 py-2 text-sm disabled:opacity-60"
        >
          Überrasch mich
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {hatFilter ? (
          <Chip
            label="Zurücksetzen"
            an={false}
            onClick={() => {
              setAuswahl({ ...KEINE_AUSWAHL, term: auswahl.term });
            }}
          />
        ) : null}

        <Chip
          label="Von Freunden"
          an={auswahl.onlyRecommended}
          onClick={() => {
            setAuswahl({ ...auswahl, onlyRecommended: !auswahl.onlyRecommended });
          }}
        />

        {PRIORITAETEN.map((p) => (
          <Chip
            key={p.wert}
            label={p.label}
            an={auswahl.priority === p.wert}
            onClick={() => {
              setAuswahl({ ...auswahl, priority: auswahl.priority === p.wert ? null : p.wert });
            }}
          />
        ))}

        {gruppen.map((gruppe) => (
          <Chip
            key={gruppe.id}
            label={gruppe.name}
            an={auswahl.group === gruppe.id}
            onClick={() => {
              setAuswahl({ ...auswahl, group: auswahl.group === gruppe.id ? null : gruppe.id });
            }}
          />
        ))}

        {[90, 120, 150].map((minuten) => (
          <Chip
            key={minuten}
            label={`unter ${String(minuten)} min`}
            an={auswahl.maximumRuntime === minuten}
            onClick={() => {
              setAuswahl({
                ...auswahl,
                maximumRuntime: auswahl.maximumRuntime === minuten ? null : minuten,
              });
            }}
          />
        ))}

        {genres.map(([id, name]) => (
          <Chip
            key={id}
            label={name}
            an={auswahl.genre === id}
            onClick={() => {
              setAuswahl({ ...auswahl, genre: auswahl.genre === id ? null : id });
            }}
          />
        ))}
      </div>

      {ueberraschung !== null ? (
        <p className="border-border bg-card/60 rounded-md border px-3 py-2 text-sm">
          Wie wäre es mit{' '}
          <Link
            href={`/film/${ueberraschung.film_id}` as Route}
            className="text-primary font-medium underline underline-offset-4"
          >
            {titelVon(ueberraschung)}
          </Link>
          ?
        </p>
      ) : null}

      {gezeigt.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nichts passt zu dieser Auswahl.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-6">
          {gezeigt.map((eintrag) => (
            <li key={eintrag.film_id} className="flex w-[120px] flex-col gap-1.5 sm:w-[140px]">
              <Karte eintrag={eintrag} match={matches[eintrag.film_id] ?? null} />

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => {
                    setGesehen(eintrag);
                  }}
                  className="text-muted-foreground hover:text-foreground text-[11px]"
                >
                  Gesehen
                </button>
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => {
                    entfernen(eintrag);
                  }}
                  className="text-muted-foreground hover:text-destructive text-[11px]"
                >
                  Entfernen
                </button>
              </div>

              {gesehen?.film_id === eintrag.film_id ? (
                <div className="border-border bg-card/60 flex flex-col gap-2 rounded-md border p-2">
                  <p className="text-muted-foreground text-[11px]">
                    Bewerten — der Film wandert danach ins Tagebuch.
                  </p>
                  <RatingInput
                    value={null}
                    size={22}
                    onSelect={async (note) => {
                      setGesehen(null);
                      setAlle((bisher) => bisher.filter((e) => e.film_id !== eintrag.film_id));

                      const ergebnis = await rateFilm(eintrag.film_id, note);
                      if (ergebnis.error) {
                        setAlle((bisher) => [eintrag, ...bisher]);
                        setProblem(ergebnis.error);
                        return;
                      }
                      // Gesehen heisst herunter von der Liste: sie sagt,
                      // was man noch **nicht** gesehen hat.
                      await toggleWatchlist(eintrag.film_id);
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ActionNote message={problem} />
    </div>
  );
}

function Karte({ eintrag, match }: { eintrag: WatchlistEintrag; match: number | null }) {
  const schnitt = schnittVon(eintrag);
  const hinweis = sozialerHinweis(eintrag);
  const plakat =
    eintrag.poster_source === 'tvdb' && eintrag.poster_url
      ? eintrag.poster_url
      : `/poster/${eintrag.film_id}`;

  return (
    <Link href={`/film/${eintrag.film_id}` as Route} className="flex flex-col gap-1.5">
      <div className="bg-card relative aspect-[2/3] overflow-hidden rounded">
        {/* Verlinkt, nie gespiegelt (docs/legal/thetvdb-lizenz.md). */}
        <img src={plakat} alt="" loading="lazy" className="h-full w-full object-cover" />
        {/* Nur die Stufen, die etwas aussagen. Ein Abzeichen „Normal"
            auf jedem zweiten Plakat wäre Rauschen. */}
        {eintrag.priority !== 'normal' ? (
          <span className="bg-primary text-primary-foreground absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium">
            {eintrag.priority === 'next' ? 'Als Nächstes' : 'Irgendwann'}
          </span>
        ) : null}
      </div>

      <span className="line-clamp-2 text-[13px] font-medium leading-tight">
        {titelVon(eintrag)}
      </span>

      <span className="text-muted-foreground text-[11px] tabular-nums">
        {eintrag.release_year ?? '—'}
        {eintrag.runtime_min === null ? '' : ` · ${String(eintrag.runtime_min)} min`}
      </span>

      {schnitt === null ? null : <PopcornRating rating={schnitt} size={11} />}

      {match === null ? null : (
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            match >= 65 ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {match} % Match
        </span>
      )}

      {/* Der soziale Hinweis, aber nur einer. Die Karte darf nicht
          überladen werden (Konzept). */}
      {hinweis === null ? null : <span className="text-primary text-[11px]">{hinweis}</span>}
    </Link>
  );
}

function Chip({ label, an, onClick }: { label: string; an: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs ${
        an
          ? 'bg-primary text-primary-foreground border-transparent font-semibold'
          : 'border-border bg-card/60 hover:bg-card'
      }`}
    >
      {label}
    </button>
  );
}
