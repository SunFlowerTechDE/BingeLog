'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState, useTransition } from 'react';

import { PopcornRating, formatRating } from '@/components/popcorn';
import { SpoilerText } from '@/components/spoiler-text';
import { ActionNote } from '@/components/action-note';
import { deleteEntry } from '@/lib/diary-actions';
import { genreLabel } from '@/lib/genres';
import {
  DIARY_ORDNUNGEN,
  KEINE_DIARY_AUSWAHL,
  gruppiertNachMonat,
  jahre,
  monatsSchluessel,
  monatsTitel,
  sichtungsnummern,
  sortiereEintraege,
  spaeterEingetragen,
  hatSehdatum,
  titelVon,
  waehleEintraege,
  wirksamesDatum,
  type DiaryAuswahl,
  type DiaryEintrag,
  type DiaryOrdnung,
} from '@/lib/diary';

const SICHTBARKEITEN: { wert: DiaryEintrag['visibility']; label: string }[] = [
  { wert: 'public', label: 'Öffentlich' },
  { wert: 'friends', label: 'Nur für Freunde' },
  { wert: 'private', label: 'Nur für mich' },
];

/**
 * Das Tagebuch (Tagebuch-Konzept, Priorität 1 — 19-web-nachziehen 11).
 *
 * Vorher eine chronologische Liste ohne Suche, Filter oder Sortierung,
 * an der sich nichts ändern liess. Jetzt nach Monat gruppiert, mit
 * Jahresauswahl, sieben Sortierungen, Schnellfiltern, Spoilerschutz und
 * „3. Sichtung" statt „Wiedergesehen".
 *
 * Gefiltert und sortiert wird im Browser, wie bei der Watchlist.
 */
export function DiaryPage({ eintraege }: { eintraege: DiaryEintrag[] }) {
  const [alle, setAlle] = useState(eintraege);
  const [auswahl, setAuswahl] = useState<DiaryAuswahl>(KEINE_DIARY_AUSWAHL);
  const [ordnung, setOrdnung] = useState<DiaryOrdnung>('newestWatched');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [, startTransition] = useTransition();

  // Über das **ganze** Tagebuch gerechnet, nicht über die gefilterte
  // Auswahl — sonst hinge „2. Sichtung" davon ab, welcher Filter gerade
  // gesetzt ist.
  const nummern = useMemo(() => sichtungsnummern(alle), [alle]);
  const verfuegbareJahre = useMemo(() => jahre(alle), [alle]);

  const genres = useMemo(() => {
    const gesehen = new Map<string, string>();
    for (const eintrag of alle) {
      eintrag.genre_ids.forEach((id, i) => {
        if (!gesehen.has(id)) gesehen.set(id, genreLabel(id, eintrag.genre_labels[i] ?? id));
      });
    }
    return [...gesehen].sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [alle]);

  const gezeigt = useMemo(
    () => sortiereEintraege(waehleEintraege(alle, auswahl), ordnung),
    [alle, auswahl, ordnung],
  );

  // Nur bei den beiden Datumssortierungen: nach Bewertung gruppiert
  // ergäben Monatsüberschriften, die keinen Zusammenhang mehr haben.
  const monate = useMemo(() => {
    if (!gruppiertNachMonat(ordnung)) return [{ id: 'alle', titel: '', eintraege: gezeigt }];

    const out: { id: string; titel: string; eintraege: DiaryEintrag[] }[] = [];
    for (const eintrag of gezeigt) {
      const datum = wirksamesDatum(eintrag);
      const key = monatsSchluessel(datum);
      const letzter = out[out.length - 1];
      if (letzter?.id === key) letzter.eintraege.push(eintrag);
      else out.push({ id: key, titel: monatsTitel(datum), eintraege: [eintrag] });
    }
    return out;
  }, [gezeigt, ordnung]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={auswahl.term}
          onChange={(event) => {
            setAuswahl({ ...auswahl, term: event.target.value });
          }}
          placeholder="Titel oder Rezension"
          aria-label="Im Tagebuch suchen"
          className="border-border bg-card focus:ring-ring min-w-[12rem] flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        />

        <select
          value={ordnung}
          onChange={(event) => {
            setOrdnung(event.target.value as DiaryOrdnung);
          }}
          aria-label="Sortieren"
          className="border-border bg-card rounded-md border px-3 py-2 text-sm"
        >
          {DIARY_ORDNUNGEN.map((o) => (
            <option key={o.wert} value={o.wert}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Die Jahresauswahl, sobald es mehr als eines gibt. */}
      {verfuegbareJahre.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Chip
            label="Alle"
            an={auswahl.year === null}
            onClick={() => {
              setAuswahl({ ...auswahl, year: null });
            }}
          />
          {verfuegbareJahre.map((jahr) => (
            <Chip
              key={jahr}
              label={String(jahr)}
              an={auswahl.year === jahr}
              onClick={() => {
                setAuswahl({ ...auswahl, year: auswahl.year === jahr ? null : jahr });
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Chip
          label="Mit Rezension"
          an={auswahl.onlyWithReview}
          onClick={() => {
            setAuswahl({ ...auswahl, onlyWithReview: !auswahl.onlyWithReview });
          }}
        />
        <Chip
          label="Wiedergesehen"
          an={auswahl.onlyRewatches}
          onClick={() => {
            setAuswahl({ ...auswahl, onlyRewatches: !auswahl.onlyRewatches });
          }}
        />
        <Chip
          label="Mit Bewertung"
          an={auswahl.ratedState === 'rated'}
          onClick={() => {
            setAuswahl({
              ...auswahl,
              ratedState: auswahl.ratedState === 'rated' ? 'any' : 'rated',
            });
          }}
        />
        <Chip
          label="Ohne Bewertung"
          an={auswahl.ratedState === 'unrated'}
          onClick={() => {
            setAuswahl({
              ...auswahl,
              ratedState: auswahl.ratedState === 'unrated' ? 'any' : 'unrated',
            });
          }}
        />
        {SICHTBARKEITEN.map((s) => (
          <Chip
            key={s.wert}
            label={s.label}
            an={auswahl.visibility === s.wert}
            onClick={() => {
              setAuswahl({
                ...auswahl,
                visibility: auswahl.visibility === s.wert ? null : s.wert,
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

      {gezeigt.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nichts passt zu dieser Auswahl.</p>
      ) : (
        <div className="flex flex-col gap-7">
          {monate.map((monat) => (
            <section key={monat.id} className="flex flex-col gap-3">
              {monat.titel === '' ? null : (
                <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  {monat.titel}
                </h2>
              )}

              <ul className="flex flex-col gap-4">
                {monat.eintraege.map((eintrag) => (
                  <li key={eintrag.id}>
                    <Zeile
                      eintrag={eintrag}
                      sichtung={nummern[eintrag.id] ?? 1}
                      onDelete={() => {
                        setAlle((bisher) => bisher.filter((e) => e.id !== eintrag.id));
                        startTransition(async () => {
                          const ergebnis = await deleteEntry(eintrag.id, eintrag.film_id);
                          if (ergebnis.error) {
                            setAlle((bisher) => [eintrag, ...bisher]);
                            setProblem(ergebnis.error);
                          }
                        });
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ActionNote message={problem} />
    </div>
  );
}

function Zeile({
  eintrag,
  sichtung,
  onDelete,
}: {
  eintrag: DiaryEintrag;
  sichtung: number;
  onDelete: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const plakat =
    eintrag.poster_source === 'tvdb' && eintrag.poster_url
      ? eintrag.poster_url
      : `/poster/${eintrag.film_id}`;

  const datum = wirksamesDatum(eintrag).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex gap-3">
      <Link href={`/film/${eintrag.film_id}` as Route} className="shrink-0">
        <span className="bg-card block h-[84px] w-14 overflow-hidden rounded">
          {/* Verlinkt, nie gespiegelt (docs/legal/thetvdb-lizenz.md). */}
          <img src={plakat} alt="" loading="lazy" className="h-full w-full object-cover" />
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/film/${eintrag.film_id}` as Route} className="min-w-0">
            <span className="text-sm font-medium">{titelVon(eintrag)}</span>
            {eintrag.release_year === null ? null : (
              <span className="text-muted-foreground text-sm"> ({eintrag.release_year})</span>
            )}
          </Link>

          <button
            type="button"
            aria-label="Mehr"
            onClick={() => {
              setOffen(!offen);
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 px-1 text-sm"
          >
            ···
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {eintrag.rating === null ? (
            <span className="text-muted-foreground text-xs">Ohne Bewertung</span>
          ) : (
            <span className="flex items-center gap-1.5">
              <PopcornRating rating={eintrag.rating} size={12} />
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {formatRating(eintrag.rating)}
              </span>
            </span>
          )}

          {/* „3. Sichtung" sagt mehr als „Wiedergesehen". */}
          {sichtung > 1 ? (
            <span className="text-primary text-[11px]">{sichtung}. Sichtung</span>
          ) : null}
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-2 text-[11px]">
          {/* Gesehen am ist wichtiger als eingetragen am. Ohne Sehdatum
              steht der Eintrag unter seinem Eintragszeitpunkt, und die
              Zeile sagt das dazu — sonst stünde er als Eintrag von 1970
              ganz unten. */}
          <span>{hatSehdatum(eintrag) ? datum : `eingetragen am ${datum}`}</span>
          {spaeterEingetragen(eintrag) ? (
            <span>
              · eingetragen am{' '}
              {new Date(eintrag.created_at).toLocaleDateString('de-DE', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          ) : null}
          {eintrag.visibility === 'public' ? null : (
            <span>· {eintrag.visibility === 'friends' ? 'Nur für Freunde' : 'Nur für mich'}</span>
          )}
        </div>

        {eintrag.review === null || eintrag.review === '' ? null : eintrag.has_spoilers ? (
          <SpoilerText text={eintrag.review} className="text-sm" />
        ) : (
          <p className="line-clamp-3 text-sm">{eintrag.review}</p>
        )}

        {offen ? (
          <div className="flex flex-wrap gap-3 pt-1">
            {/* Geändert wird auf der Filmseite: dort steht das Formular
                mit Facetten, Datum und Sichtbarkeit schon, und zwei
                Fassungen desselben Formulars laufen auseinander. */}
            <Link
              href={`/film/${eintrag.film_id}` as Route}
              className="text-foreground text-xs underline underline-offset-4"
            >
              {eintrag.rating === null
                ? 'Jetzt bewerten'
                : eintrag.review === null || eintrag.review === ''
                  ? 'Rezension hinzufügen'
                  : 'Bearbeiten'}
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive text-xs"
            >
              Löschen
            </button>
          </div>
        ) : null}
      </div>
    </div>
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
