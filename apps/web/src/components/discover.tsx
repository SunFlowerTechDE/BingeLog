import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { FilmTile, type TileFilm } from '@/components/film-tile';
import { FeedList } from '@/components/feed-list';
import { FEED_SEITE, type FeedEintrag } from '@/lib/feed';
import { GenreTile, type GenreKachel } from '@/components/genre-tile';
import { WeeklyTop, type TopFilm } from '@/components/weekly-top';

/**
 * Entdecken — die Startseite fuer Angemeldete (M4 4.4, Entdecken-Konzept).
 *
 * Die Reihenfolge steht im Konzept (18, Fall „kaum Nutzerdaten") und ist
 * dieselbe wie auf dem iPhone: Nach Genre, Top 10, Von Freunden
 * empfohlen, Fuer dich, Neu veroeffentlicht, Bald verfuegbar, Letzte
 * Aktivitaeten.
 *
 * **Leere Bereiche werden ausgeblendet**, nicht mit erklaerendem Text
 * gefuellt. Der Hinweis „folge jemandem" stand sonst dauerhaft auf der
 * Startseite und war nach dem ersten Lesen nur noch im Weg.
 */
/** Ein Film, den jemand aus dem Freundeskreis empfohlen hat. */
interface Empfehlung {
  film_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_source: string | null;
  poster_url: string | null;
  friends: number;
  first_friend: string | null;
  note: string | null;
}

/** Ein Bereich mit Plakaten, oder nichts. */
function FilmSection({ titel, filme }: { titel: string; filme: TileFilm[] }) {
  if (filme.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold tracking-tight">{titel}</h2>
      <ul className="flex flex-wrap gap-4">
        {filme.map((film) => (
          <li key={film.wikidata_id}>
            <FilmTile film={film} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Von Freunden empfohlen (Entdecken-Konzept 5).
 *
 * Empfohlen wird nur unter Freunden, und **das steht in der Policy auf
 * `recommendations`**, nicht in dieser Ansicht. Eine Oberflaeche, die
 * nur Freunde anbietet, ist eine Auswahl und keine Sperre.
 */
function RecommendedSection({ empfehlungen }: { empfehlungen: Empfehlung[] }) {
  if (empfehlungen.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold tracking-tight">Von Freunden empfohlen</h2>
      <ul className="flex flex-wrap gap-4">
        {empfehlungen.map((e) => (
          <li key={e.film_id} className="flex w-[120px] flex-col gap-1 sm:w-[140px]">
            <FilmTile
              film={{
                wikidata_id: e.film_id,
                title_de: e.title_de,
                title_original: e.title_original,
                release_year: e.release_year,
                poster_source: e.poster_source,
                poster_url: e.poster_url,
                director: null,
              }}
            />
            <span className="text-primary text-[11px] leading-tight">
              {e.friends === 1 && e.first_friend !== null
                ? `Von ${e.first_friend}`
                : `Von ${String(e.friends)} Freunden`}
            </span>
            {/* Die Notiz ist auf 50 Zeichen begrenzt und passt damit
                unter die Kachel, ohne sie zu sprengen. */}
            {e.note === null ? null : (
              <span className="text-muted-foreground text-[11px] italic leading-tight">
                „{e.note}"
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function Discover() {
  const supabase = await createClient();
  const viewer = await getViewer();

  // Das laufende Jahr trennt „Neu veroeffentlicht" von „Bald
  // verfuegbar". Der Katalog fuehrt nur `release_year` — ein deutsches
  // Erscheinungsdatum gibt es noch nicht, und ohne das bleiben „Neu in
  // Deutschland" und der Countdown offen (Konzept, bewusst).
  const jahr = new Date().getFullYear();

  const [{ data: kachelRows }, { data: topRows }, { data: neuRows }, { data: baldRows }] =
    await Promise.all([
      supabase.rpc('genre_tiles', { max_results: 16 }),
      supabase.rpc('weekly_top_films', { max_results: 10 }),
      // Nach Erscheinungsjahr, bei Gleichstand die bekannteren zuerst.
      // `sitelink_count` ist die Zahl der Wikipedia-Sprachversionen und
      // damit das einzige Mass fuer Bekanntheit, das der Katalog kennt.
      supabase
        .from('films')
        .select('wikidata_id, title_de, title_original, release_year, poster_source, poster_url')
        .not('release_year', 'is', null)
        .lte('release_year', jahr)
        .order('release_year', { ascending: false })
        .order('sitelink_count', { ascending: false })
        .limit(12),
      supabase
        .from('films')
        .select('wikidata_id, title_de, title_original, release_year, poster_source, poster_url')
        .gt('release_year', jahr)
        .order('release_year', { ascending: true })
        .order('sitelink_count', { ascending: false })
        .limit(12),
    ]);

  const kacheln = kachelRows ?? [];
  const top = (topRows ?? []) as TopFilm[];
  const neu = (neuRows ?? []).map((f) => ({ ...f, director: null })) as TileFilm[];
  const bald = (baldRows ?? []).map((f) => ({ ...f, director: null })) as TileFilm[];

  let feed: FeedEintrag[] = [];
  let fuerDich: TileFilm[] = [];
  let empfohlen: Empfehlung[] = [];

  if (viewer?.username) {
    // Alle drei nur fuer Angemeldete: `films_for_me` und
    // `recommendations_for_me` ist das Ausfuehren fuer PUBLIC entzogen.
    const [{ data: feedRows }, { data: mirRows }, { data: empfRows }] = await Promise.all([
      supabase.rpc('following_feed', { max_results: FEED_SEITE }),
      supabase.rpc('films_for_me', { max_results: 12 }),
      supabase.rpc('recommendations_for_me', { max_results: 12 }),
    ]);
    feed = feedRows ?? [];
    fuerDich = (mirRows ?? []).map((f) => ({ ...f, director: null }));
    empfohlen = empfRows ?? [];
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
          <ul className="-mx-5 flex items-stretch gap-3 overflow-x-auto px-5 pb-2">
            {(kacheln as GenreKachel[]).map((k) => (
              <li key={k.genre_id} className="shrink-0">
                <GenreTile kachel={k} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* An zweiter Stelle, zwischen den Genres und dem Feed — dieselbe
          Ordnung wie auf dem iPhone. */}
      <WeeklyTop filme={top} />

      <RecommendedSection empfehlungen={empfohlen} />

      <FilmSection titel="Für dich" filme={fuerDich} />

      <FilmSection titel="Neu veröffentlicht" filme={neu} />

      {/* Filme, deren Jahr noch aussteht. Sie standen bisher unter „Neu
          im Katalog" ganz oben, obwohl es sie noch gar nicht gibt. */}
      <FilmSection titel="Bald verfügbar" filme={bald} />

      {feed.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">Letzte Aktivitäten</h2>
          <FeedList anfang={feed} avatarBasis={avatarBasis} />
        </section>
      ) : null}
    </main>
  );
}
