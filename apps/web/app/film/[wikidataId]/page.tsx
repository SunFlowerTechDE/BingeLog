import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { LogPanel, type OwnEntry } from '@/components/log-panel';
import { Stars, formatRating } from '@/components/stars';
import { FACET_KINDS, FACET_LABELS_DE } from '@binge-log/db';

/**
 * M3 3.3 — the film detail page.
 *
 * Deliberately without a synopsis. Wikidata carries no prose, and pulling
 * the Wikipedia text over the sitelink would be CC BY-SA and would drag
 * ShareAlike across the whole page. That is a decision to take on
 * purpose, not to slide into (M3 3.3).
 */

interface FilmDetail {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  title_en: string | null;
  release_year: number | null;
  runtime_min: number | null;
  poster_source: string | null;
  poster_url: string | null;
}

async function loadFilm(wikidataId: string): Promise<FilmDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('films')
    .select(
      'wikidata_id, title_de, title_original, title_en, release_year, runtime_min, poster_source, poster_url',
    )
    .eq('wikidata_id', wikidataId)
    .maybeSingle();

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ wikidataId: string }>;
}): Promise<Metadata> {
  const { wikidataId } = await params;
  const film = await loadFilm(wikidataId);
  if (!film) return { title: 'Film nicht gefunden' };

  const title = film.title_de ?? film.title_original;
  return { title: film.release_year ? `${title} (${String(film.release_year)})` : title };
}

export default async function FilmPage({
  params,
}: {
  params: Promise<{ wikidataId: string }>;
}) {
  const { wikidataId } = await params;

  if (!/^Q\d+$/.test(wikidataId)) notFound();

  const film = await loadFilm(wikidataId);
  if (!film) notFound();

  const supabase = await createClient();
  const { data: credits } = await supabase
    .from('film_credits')
    .select('role, ord, people(name)')
    .eq('film_id', wikidataId)
    .order('ord', { ascending: true });

  const byRole = (role: string) =>
    (credits ?? [])
      .filter((credit) => credit.role === role)
      .map((credit) => credit.people.name)
      .filter((name): name is string => Boolean(name));

  const directors = byRole('director');
  const cast = byRole('cast').slice(0, 12);

  const viewer = await getViewer();

  // The viewer's latest entry for this film, and the facets attached to
  // it. RLS decides what comes back; neither query filters by owner
  // beyond what the policies already enforce.
  let ownEntry: OwnEntry | null = null;
  let ownFacets: Partial<Record<string, number>> = {};

  if (viewer) {
    const { data: entry } = await supabase
      .from('diary_entries')
      .select('id, rating, watched_on, review, is_rewatch, is_private')
      .eq('user_id', viewer.id)
      .eq('film_id', wikidataId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    ownEntry = entry;

    const { data: facets } = await supabase.rpc('my_facet_ratings', { film: wikidataId });
    ownFacets = Object.fromEntries((facets ?? []).map((row) => [row.facet, row.score]));
  }

  const title = film.title_de ?? film.title_original;
  const showsOriginal = film.title_de !== null && film.title_de !== film.title_original;
  const hasArtwork = film.poster_source === 'tvdb' && film.poster_url;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 sm:flex-row sm:gap-10">
      <div className="w-[180px] shrink-0 sm:w-[220px]">
        <div className="bg-card aspect-[2/3] overflow-hidden rounded">
          {/* A plain img on purpose: next/image would proxy and cache the
              artwork, and linking rather than mirroring is what the licence
              check settled (docs/legal/thetvdb-lizenz.md). */}
          <img
            src={hasArtwork ? (film.poster_url ?? '') : `/poster/${film.wikidata_id}`}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        {hasArtwork ? (
          // Attribution is a licence obligation, not a courtesy, and it
          // has to be a direct link visible to the end user.
          <p className="text-muted-foreground mt-2 text-[11px]">
            Plakat von{' '}
            <a
              href="https://thetvdb.com"
              className="underline underline-offset-2"
              rel="noreferrer"
              target="_blank"
            >
              TheTVDB
            </a>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {showsOriginal ? (
            <p className="text-muted-foreground text-base">{film.title_original}</p>
          ) : null}
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {film.release_year ? (
            <div>
              <dt className="text-muted-foreground text-xs">Jahr</dt>
              <dd>{film.release_year}</dd>
            </div>
          ) : null}
          {film.runtime_min ? (
            <div>
              <dt className="text-muted-foreground text-xs">Laufzeit</dt>
              <dd>{film.runtime_min} Minuten</dd>
            </div>
          ) : null}
          {directors.length > 0 ? (
            <div>
              <dt className="text-muted-foreground text-xs">Regie</dt>
              <dd>{directors.join(', ')}</dd>
            </div>
          ) : null}
        </dl>

        {cast.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <h2 className="text-muted-foreground text-xs">Besetzung</h2>
            <p className="text-sm leading-relaxed">{cast.join(' · ')}</p>
          </div>
        ) : null}

        <CommunityVerdict wikidataId={wikidataId} />

        {viewer ? (
          <LogPanel filmId={wikidataId} entry={ownEntry} ownFacets={ownFacets} />
        ) : (
          <section className="border-border border-t pt-5">
            <p className="text-muted-foreground text-sm">
              <Link href="/anmelden" className="text-foreground underline underline-offset-4">
                Melde dich an
              </Link>
              , um den Film einzutragen und zu bewerten.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * The community verdict: the star average with its count, and the facet
 * averages beneath it.
 *
 * Facets appear only from five ratings on. "Schauspiel 2,0 (1 Stimme)"
 * is misleading and invites brigading (M3, Fallstricke), which is why the
 * threshold lives in the materialized view rather than in this component.
 */
async function CommunityVerdict({ wikidataId }: { wikidataId: string }) {
  const supabase = await createClient();

  const { data: summary } = await supabase.rpc('film_rating_summary', { film: wikidataId });
  const verdict = summary?.[0];

  const { data: facetRows } = await supabase
    .from('film_facet_averages')
    .select('facet, avg_score, vote_count')
    .eq('film_id', wikidataId);

  const facets = new Map(
    (facetRows ?? []).map((row) => [row.facet, row]),
  );

  if (!verdict?.votes) {
    return (
      <section className="border-border border-t pt-5">
        <p className="text-muted-foreground text-sm">Noch nicht bewertet.</p>
      </section>
    );
  }

  // numeric comes back as a JSON number, so no conversion is needed.
  const average = verdict.average;

  return (
    <section className="border-border flex flex-col gap-4 border-t pt-5">
      <div className="flex items-center gap-3">
        <Stars rating={average} size={18} />
        <span className="text-sm font-medium tabular-nums">{formatRating(average)}</span>
        <span className="text-muted-foreground text-sm">
          {verdict.votes === 1 ? '1 Bewertung' : `${String(verdict.votes)} Bewertungen`}
        </span>
      </div>

      {facets.size > 0 ? (
        <dl className="flex max-w-md flex-col gap-1.5">
          {FACET_KINDS.filter((facet) => facets.has(facet)).map((facet) => {
            const row = facets.get(facet);
            const score = row?.avg_score ?? 0;
            return (
              <div key={facet} className="flex items-center gap-3 text-sm">
                <dt className="text-muted-foreground w-44 shrink-0 text-xs">
                  {FACET_LABELS_DE[facet]}
                </dt>
                <dd className="flex flex-1 items-center gap-2">
                  <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${String((score / 10) * 100)}%` }}
                    />
                  </span>
                  <span className="w-8 text-right text-xs tabular-nums">
                    {formatRating(score)}
                  </span>
                  <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">
                    {String(row?.vote_count ?? 0)}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </section>
  );
}
