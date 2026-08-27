import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { LogPanel, type OwnEntry } from '@/components/log-panel';
import { WatchlistButton } from '@/components/watchlist-button';
import { formatAge, formatWatchedOn } from '@/lib/dates';
import { PopcornRating, formatRating } from '@/components/popcorn';
import { CastList } from '@/components/cast-list';
import { FacetPanel, type FacetAverage } from '@/components/facet-panel';

/**
 * M3 3.3 — the film detail page.
 *
 * Deliberately without a synopsis. Wikidata carries no prose, and pulling
 * the Wikipedia text over the sitelink would be CC BY-SA and would drag
 * ShareAlike across the whole page. That is a decision to take on
 * purpose, not to slide into (M3 3.3). Trailer and FSK badge are absent
 * for the same reason: no source that is free, complete and clean at
 * once. The layout leaves no hole where they would go — a block that is
 * empty on every film is not a placeholder, it is a defect.
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
  searchParams,
}: {
  params: Promise<{ wikidataId: string }>;
  searchParams: Promise<{ seite?: string }>;
}) {
  const { wikidataId } = await params;
  const { seite } = await searchParams;
  const page = Math.max(1, Number(seite) || 1);

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
  const cast = byRole('cast');

  const { data: genreRows } = await supabase
    .from('film_genres')
    .select('genres(label_de, label_en)')
    .eq('film_id', wikidataId);

  // Deutsch, wo Wikidata es fuehrt; sonst lieber das englische Wort als
  // eine Luecke, denn ein Genre ohne Namen ist kein Genre.
  const genres = (genreRows ?? [])
    .map((row) => row.genres.label_de ?? row.genres.label_en)
    .filter((name): name is string => Boolean(name));

  const viewer = await getViewer();

  // The viewer's latest entry for this film, and the facets attached to
  // it. RLS decides what comes back; neither query filters by owner
  // beyond what the policies already enforce.
  let ownEntry: OwnEntry | null = null;
  let ownFacets: Partial<Record<string, number>> = {};
  let onWatchlist = false;

  if (viewer) {
    const { data: entry } = await supabase
      .from('diary_entries')
      .select('id, rating, watched_on, review, is_rewatch, visibility')
      .eq('user_id', viewer.id)
      .eq('film_id', wikidataId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    ownEntry = entry;

    const { data: facets } = await supabase.rpc('my_facet_ratings', { film: wikidataId });
    ownFacets = Object.fromEntries((facets ?? []).map((row) => [row.facet, row.score]));

    const { data: watched } = await supabase
      .from('watchlist')
      .select('film_id')
      .eq('user_id', viewer.id)
      .eq('film_id', wikidataId)
      .maybeSingle();
    onWatchlist = watched !== null;
  }

  const { data: summaryRows } = await supabase.rpc('film_rating_summary', {
    film: wikidataId,
  });
  const verdict = summaryRows?.[0];

  const { data: facetRows } = await supabase
    .from('film_facet_averages')
    .select('facet, avg_score, vote_count')
    .eq('film_id', wikidataId);

  const facetAverages = (facetRows ?? []) as FacetAverage[];
  // Die Zweispaltigkeit haengt daran, dass es auch zwei Dinge gibt.
  // Sonst steht die Rezensionskarte in der schmaleren Spalte und rechts
  // daneben nichts.
  const hasFacets =
    facetAverages.length > 0 || Object.values(ownFacets).some((score) => score !== undefined);

  const title = film.title_de ?? film.title_original;
  const showsOriginal = film.title_de !== null && film.title_de !== film.title_original;
  const hasArtwork = film.poster_source === 'tvdb' && film.poster_url;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 lg:flex-row lg:gap-8">
      {/* Linke Schiene: das Plakat und was unveraenderlich zum Film gehoert. */}
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[260px]">
        <div className="bg-card aspect-[2/3] overflow-hidden rounded-lg">
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
          <p className="text-muted-foreground text-[11px]">
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

        <dl className="border-border bg-card/40 flex flex-col gap-3 rounded-lg border p-4 text-sm">
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
          {genres.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <dt className="text-muted-foreground text-xs">Genre</dt>
              <dd className="flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <span
                    key={genre}
                    className="border-border rounded-full border px-2.5 py-0.5 text-xs"
                  >
                    {genre}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>

        {viewer ? <WatchlistButton filmId={wikidataId} initiallyOn={onWatchlist} /> : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/* Kopf: Titel links, die beiden Zahlen rechts. */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {showsOriginal ? (
              <p className="text-muted-foreground text-base">{film.title_original}</p>
            ) : null}
            <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {film.release_year ? <span>{film.release_year}</span> : null}
              {film.runtime_min ? <span>{film.runtime_min} Minuten</span> : null}
              {directors.length > 0 ? <span>{directors.join(', ')}</span> : null}
            </p>
          </div>

          <div className="flex shrink-0 gap-8">
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Ø Bewertung</span>
              {verdict?.votes ? (
                <>
                  <div className="flex items-center gap-2">
                    <PopcornRating rating={verdict.average} size={20} />
                    <span className="text-lg font-semibold tabular-nums">
                      {formatRating(verdict.average)}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {verdict.votes === 1 ? '1 Bewertung' : `${String(verdict.votes)} Bewertungen`}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">noch keine</span>
              )}
            </div>

            {viewer && ownEntry?.rating ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Deine Bewertung</span>
                <div className="flex items-center gap-2">
                  <PopcornRating rating={ownEntry.rating} size={20} />
                  <span className="text-lg font-semibold tabular-nums">
                    {formatRating(ownEntry.rating)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {cast.length > 0 ? <CastList names={cast} /> : null}

        {viewer ? (
          <LogPanel filmId={wikidataId} entry={ownEntry} ownFacets={ownFacets} />
        ) : (
          <section className="border-border bg-card/40 rounded-lg border p-5">
            <p className="text-muted-foreground text-sm">
              <Link href="/anmelden" className="text-foreground underline underline-offset-4">
                Melde dich an
              </Link>
              , um den Film einzutragen und zu bewerten.
            </p>
          </section>
        )}

        {/* Facetten und fremde Rezensionen nebeneinander: das eine ist
            eine Zahlenreihe, das andere Fliesstext. Untereinander gibt
            das eine sehr lange, sehr schmale Spalte. */}
        {hasFacets ? (
          <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
            <FacetPanel averages={facetAverages} own={ownFacets} />
            <Reviews wikidataId={wikidataId} page={page} />
          </div>
        ) : (
          <Reviews wikidataId={wikidataId} page={page} />
        )}
      </div>
    </main>
  );
}

const REVIEWS_PER_PAGE = 10;

/**
 * What other people wrote about the film.
 *
 * Private entries never appear, and that is not this component's doing:
 * the policy on diary_entries decides, and a filter here would be a
 * second opinion that can drift from the first (M0 0.4).
 */
async function Reviews({ wikidataId, page }: { wikidataId: string; page: number }) {
  const supabase = await createClient();

  // One more than a page, to find out whether there is a next one without
  // a second count query.
  const from = (page - 1) * REVIEWS_PER_PAGE;
  const { data } = await supabase
    .from('diary_entries')
    .select('id, rating, review, watched_on, is_rewatch, created_at, profiles(username)')
    .eq('film_id', wikidataId)
    .not('review', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, from + REVIEWS_PER_PAGE);

  const rows = (data ?? []) as unknown as {
    id: string;
    rating: number | null;
    review: string;
    watched_on: string | null;
    is_rewatch: boolean;
    created_at: string;
    profiles: { username: string } | null;
  }[];

  if (rows.length === 0 && page === 1) return null;

  const hasMore = rows.length > REVIEWS_PER_PAGE;
  const reviews = rows.slice(0, REVIEWS_PER_PAGE);

  return (
    <section className="border-border bg-card/40 flex flex-col gap-4 rounded-lg border p-5">
      <h2 className="text-base font-semibold tracking-tight">Neueste Bewertungen</h2>

      <ol className="flex flex-col gap-4">
        {reviews.map((entry) => {
          const watched = formatWatchedOn(entry.watched_on);
          return (
            <li key={entry.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-medium">{entry.profiles?.username ?? 'jemand'}</span>
                {entry.rating === null ? null : <PopcornRating rating={entry.rating} size={16} />}
                {entry.is_rewatch ? (
                  <span className="text-muted-foreground">Wiedersehen</span>
                ) : null}
                {/* Gesehen am und geschrieben vor: das eine ist der
                    Abend, das andere die Frische der Meinung. */}
                <span className="text-muted-foreground ml-auto">{formatAge(entry.created_at)}</span>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{entry.review}</p>
              {watched ? (
                <span className="text-muted-foreground text-xs">gesehen am {watched}</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {page > 1 || hasMore ? (
        <div className="flex gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/film/${wikidataId}?seite=${String(page - 1)}` as Route}
              className="text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Zurück
            </Link>
          ) : null}
          {hasMore ? (
            <Link
              href={`/film/${wikidataId}?seite=${String(page + 1)}` as Route}
              className="text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Weitere
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
