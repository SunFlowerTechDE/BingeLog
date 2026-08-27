import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { PopcornRating, formatRating } from '@/components/popcorn';
import { formatWatchedOn } from '@/lib/dates';

export const metadata: Metadata = { title: 'Tagebuch' };

interface Entry {
  id: string;
  film_id: string;
  rating: number | null;
  watched_on: string | null;
  review: string | null;
  is_rewatch: boolean;
  visibility: 'public' | 'friends' | 'private';
  created_at: string;
  films: {
    title_de: string | null;
    title_original: string;
    release_year: number | null;
    poster_source: string | null;
    poster_url: string | null;
  } | null;
}

export default async function DiaryPage() {
  // Unauthenticated callers never arrive: the proxy sends them to
  // /anmelden with the target in tow.
  const viewer = await getViewer();
  if (!viewer) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from('diary_entries')
    .select(
      'id, film_id, rating, watched_on, review, is_rewatch, visibility, created_at, films(title_de, title_original, release_year, poster_source, poster_url)',
    )
    .eq('user_id', viewer.id)
    .order('watched_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const entries = (data ?? []) as unknown as Entry[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dein Tagebuch</h1>
        <p className="text-muted-foreground text-sm">
          {entries.length === 0
            ? 'Noch nichts eingetragen.'
            : entries.length === 1
              ? '1 Eintrag'
              : `${String(entries.length)} Einträge`}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Such einen Film und tipp auf einen Stern.{' '}
          <Link href="/" className="text-foreground underline underline-offset-4">
            Zur Suche
          </Link>
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {entries.map((entry) => {
            const film = entry.films;
            const title = film?.title_de ?? film?.title_original ?? entry.film_id;
            const artwork =
              film?.poster_source === 'tvdb' && film.poster_url
                ? film.poster_url
                : `/poster/${entry.film_id}`;
            const watched = formatWatchedOn(entry.watched_on);

            return (
              <li key={entry.id} className="border-border flex gap-4 border-b pb-4 last:border-0">
                <Link href={`/film/${entry.film_id}` as Route} className="shrink-0">
                  <div className="bg-card aspect-[2/3] w-[60px] overflow-hidden rounded">
                    {/* Linked, never mirrored (docs/legal/thetvdb-lizenz.md). */}
                    <img src={artwork} alt="" className="h-full w-full object-cover" />
                  </div>
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link
                      href={`/film/${entry.film_id}` as Route}
                      className="font-medium hover:underline"
                    >
                      {title}
                    </Link>
                    {film?.release_year ? (
                      <span className="text-muted-foreground text-sm">{film.release_year}</span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {entry.rating === null ? (
                      <span className="text-muted-foreground">ohne Bewertung</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <PopcornRating rating={entry.rating} size={18} />
                        <span className="text-muted-foreground tabular-nums">
                          {formatRating(entry.rating)}
                        </span>
                      </span>
                    )}
                    {watched ? <span className="text-muted-foreground">{watched}</span> : null}
                    {entry.is_rewatch ? (
                      <span className="text-muted-foreground">Wiedersehen</span>
                    ) : null}
                    {entry.visibility === 'private' ? (
                      <span className="text-muted-foreground">nur für dich</span>
                    ) : null}
                    {entry.visibility === 'friends' ? (
                      <span className="text-muted-foreground">nur für Freunde</span>
                    ) : null}
                  </div>

                  {entry.review ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed">{entry.review}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
