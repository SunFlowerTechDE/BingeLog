import Link from 'next/link';
import type { Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { FilmTile, type TileFilm } from '@/components/film-tile';
import { FeedList } from '@/components/feed-list';
import { FEED_SEITE, type FeedEintrag } from '@/lib/feed';

/**
 * Entdecken — die Startseite fuer Angemeldete (M4 4.4).
 *
 * Drei Bereiche, in dieser Reihenfolge: die Genres als Schieber, dann
 * was die Leute eingetragen haben, denen du folgst, dann das Neueste im
 * Katalog.
 *
 * Der Feed steht in der Mitte und nicht oben: die Kacheln sind ein
 * Einstieg, der Feed ist der Aufenthalt. Wer nichts Neues von seinen
 * Leuten hat, soll trotzdem etwas vorfinden.
 */
export async function Discover() {
  const supabase = await createClient();
  const viewer = await getViewer();

  const [{ data: kachelRows }, { data: neuRows }] = await Promise.all([
    supabase.rpc('genre_tiles', { max_results: 16 }),
    // Nach Erscheinungsjahr, bei Gleichstand die bekannteren zuerst.
    // `sitelink_count` ist die Zahl der Wikipedia-Sprachversionen und
    // damit das einzige Mass fuer Bekanntheit, das der Katalog kennt.
    supabase
      .from('films')
      .select('wikidata_id, title_de, title_original, release_year, poster_source, poster_url')
      .not('release_year', 'is', null)
      .order('release_year', { ascending: false })
      .order('sitelink_count', { ascending: false })
      .limit(12),
  ]);

  const kacheln = kachelRows ?? [];
  const neu = (neuRows ?? []).map((f) => ({ ...f, director: null })) as TileFilm[];

  let feed: FeedEintrag[] = [];
  if (viewer?.username) {
    const { data } = await supabase.rpc('following_feed', { max_results: FEED_SEITE });
    feed = data ?? [];
  }

  const avatarBasis = supabase.storage.from('avatars').getPublicUrl('').data.publicUrl;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-8">
      {kacheln.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">Nach Genre</h2>
          {/* Ein Schieber und kein Raster: die Genres sind ein Einstieg,
              kein Inhaltsverzeichnis. Sechzehn Kacheln untereinander
              waeren eine Wand vor dem, was darunter steht. */}
          <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
            {kacheln.map((k) => (
              <li key={k.genre_id} className="shrink-0">
                <Link
                  href={`/genre/${k.genre_id}` as Route}
                  className="border-border bg-card/60 hover:bg-card flex w-40 flex-col gap-1 rounded-lg border px-4 py-3"
                >
                  <span className="truncate text-sm font-medium">{k.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {k.films} Filme
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {viewer?.username ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">Letzte Aktivitäten</h2>
          {feed.length === 0 ? (
            <p className="text-muted-foreground max-w-prose text-sm">
              Hier steht, was die Leute eintragen, denen du folgst. Noch ist es leer — folge
              jemandem, dann füllt es sich von selbst.
            </p>
          ) : (
            <FeedList anfang={feed} avatarBasis={avatarBasis} />
          )}
        </section>
      ) : null}

      {neu.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">Neu im Katalog</h2>
          <ul className="flex flex-wrap gap-4">
            {neu.map((film) => (
              <li key={film.wikidata_id}>
                <FilmTile film={film} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
