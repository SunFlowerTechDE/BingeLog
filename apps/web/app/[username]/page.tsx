import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { FollowButton } from '@/components/follow-button';
import { PopcornRating, formatRating } from '@/components/popcorn';
import { formatWatchedOn } from '@/lib/dates';
import { Avatar, StatCard } from '@/components/profile-parts';

/**
 * M4 4.2 — die oeffentliche Profilseite unter /@username.
 *
 * Ein Ordner mit @ waere fuer Next eine parallele Route, deshalb faengt
 * ein dynamisches Segment den Pfad und prueft das Zeichen selbst.
 * Statische Routen gewinnen gegen dynamische, /tagebuch bleibt also
 * /tagebuch — aber alles ohne @ endet hier bewusst im 404 statt in einer
 * Profilsuche.
 *
 * Was zu sehen ist, entscheidet die Datenbank. Diese Seite filtert
 * nirgends nach Sichtbarkeit: die Policy auf diary_entries tut es, und
 * ein zweites Urteil hier koennte vom ersten abweichen (M0 0.4).
 */

const ENTRIES_SHOWN = 20;

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** "Mai 2024" — auf den Tag genau interessiert bei einem Beitritt niemanden. */
function monatJahr(wert: string): string {
  const d = new Date(wert);
  return `${MONATE[d.getMonth()] ?? ''} ${String(d.getFullYear())}`;
}

function nameAus(segment: string): string | null {
  const decoded = decodeURIComponent(segment);
  if (!decoded.startsWith('@')) return null;
  const name = decoded.slice(1).toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(name) ? name : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const name = nameAus(username);
  return { title: name ? `@${name}` : 'Profil nicht gefunden' };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = nameAus(username);
  if (!name) notFound();

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, created_at, watchlist_public, avatar_path')
    .eq('username', name)
    .maybeSingle();

  if (!profile) notFound();

  const viewer = await getViewer();
  const eigenes = viewer?.id === profile.id;

  // Wer folgt wem. Zwei Zeilen statt einer Freundschaftsabfrage, weil
  // die Seite beide Richtungen einzeln anzeigt: "du folgst" und "folgt
  // dir zurueck" sind verschiedene Aussagen.
  let folgtIhm = false;
  let folgtZurueck = false;
  if (viewer && !eigenes) {
    const { data: kanten } = await supabase
      .from('follows')
      .select('follower_id, followee_id')
      .or(
        `and(follower_id.eq.${viewer.id},followee_id.eq.${profile.id}),` +
          `and(follower_id.eq.${profile.id},followee_id.eq.${viewer.id})`,
      );
    folgtIhm = (kanten ?? []).some((k) => k.follower_id === viewer.id);
    folgtZurueck = (kanten ?? []).some((k) => k.follower_id === profile.id);
  }

  const [{ count: folgt }, { count: folgen }] = await Promise.all([
    supabase
      .from('follows')
      .select('followee_id', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('followee_id', profile.id),
  ]);

  const [{ data: statRows }, { data: genreRows }] = await Promise.all([
    supabase.rpc('profile_stats', { profile: profile.id }),
    // Drei, nicht fuenf: Wikidata haengt einem Film gern ein halbes
    // Dutzend Genres an — Titanic fuehrt dort Monumentalfilm,
    // Historienfilm, Katastrophenfilm, Melodram und Liebesfilm. Eine
    // lange Liste liest sich wie eine Datenabschrift, drei wie eine
    // Aussage.
    supabase.rpc('profile_genres', { profile: profile.id, max_results: 3 }),
  ]);
  const stats = statRows?.[0];
  const genres = genreRows ?? [];

  // Die Watchlist entscheidet die Policy: privat sieht nur der Besitzer,
  // offen sehen alle ausser den einzeln ausgeblendeten Titeln. Die Seite
  // fragt und zeigt, was zurueckkommt.
  const { data: watchRows, count: watchCount } = await supabase
    .from('watchlist')
    .select('film_id, films(wikidata_id, title_de, title_original, release_year)', {
      count: 'exact',
    })
    .eq('user_id', profile.id)
    .order('added_at', { ascending: false })
    .limit(6);

  const watchlist = (watchRows ?? []) as unknown as {
    films: {
      wikidata_id: string;
      title_de: string | null;
      title_original: string;
      release_year: number | null;
    };
  }[];

  const { data: rows } = await supabase
    .from('diary_entries')
    .select(
      'id, rating, review, watched_on, is_rewatch, created_at, ' +
        'films(wikidata_id, title_de, title_original, release_year, poster_source, poster_url)',
    )
    .eq('user_id', profile.id)
    .order('watched_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(ENTRIES_SHOWN);

  const eintraege = (rows ?? []) as unknown as {
    id: string;
    rating: number | null;
    review: string | null;
    watched_on: string | null;
    is_rewatch: boolean;
    films: {
      wikidata_id: string;
      title_de: string | null;
      title_original: string;
      release_year: number | null;
      poster_source: string | null;
      poster_url: string | null;
    };
  }[];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          {/* Vorlaeufig: Initialen. Echte Bilder brauchen Speicher,
              Upload und eine Groessenbeschraenkung — ein eigener
              Schritt. */}
          {profile.avatar_path ? (
            // Kein next/image: das Bild liegt bereits in der richtigen
            // Groesse im Speicher, ein Proxy davor waere Arbeit ohne
            // Wirkung.
            <img
              src={
                supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
              }
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar name={profile.username} size={96} />
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-3xl font-semibold tracking-tight">{profile.username}</h1>
              {profile.display_name ? (
                <p className="text-muted-foreground">{profile.display_name}</p>
              ) : null}
            </div>

            {profile.bio ? (
              <p className="max-w-prose text-sm leading-relaxed">{profile.bio}</p>
            ) : null}

            <p className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span>Mitglied seit {monatJahr(profile.created_at)}</span>
              {genres.length > 0 ? (
                <span>Lieblingsgenres: {genres.map((g) => g.label).join(', ')}</span>
              ) : null}
            </p>

            <dl className="text-muted-foreground flex gap-6 pt-1 text-sm">
              <div className="flex gap-1.5">
                <dt>Folgt</dt>
                <dd className="text-foreground tabular-nums">{folgt ?? 0}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Folgen</dt>
                <dd className="text-foreground tabular-nums">{folgen ?? 0}</dd>
              </div>
            </dl>

            {viewer && !eigenes ? (
              <div className="pt-1">
                <FollowButton
                  username={profile.username}
                  initiallyFollowing={folgtIhm}
                  followsBack={folgtZurueck}
                />
              </div>
            ) : null}

            {eigenes ? (
              <div className="pt-1">
                <Link
                  href="/einstellungen"
                  className="border-border hover:bg-card inline-block rounded-md border px-3 py-1.5 text-sm"
                >
                  Profil bearbeiten
                </Link>
              </div>
            ) : null}

            {eigenes ? (
              <p className="text-muted-foreground pt-1 text-sm">
                So sehen andere dein Profil. Was hier fehlt, hast du auf „Nur für mich" gestellt.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gesehene Filme"
            value={String(stats?.films ?? 0)}
            note="Filme insgesamt"
          />
          <StatCard
            label="Bewertungen"
            value={String(stats?.ratings ?? 0)}
            note="Popcorn vergeben"
          />
          {/* Fuer Fremde nur, wenn die Liste offen steht. Sonst stuende
              dort eine Null, die "verborgen" heisst und nicht "leer" —
              eine Zahl, die etwas anderes bedeutet als sie sagt. */}
          {eigenes || profile.watchlist_public ? (
            <StatCard
              label="Watchlist"
              value={String(watchCount ?? 0)}
              note={
                eigenes
                  ? profile.watchlist_public
                    ? 'Filme auf der Liste, öffentlich'
                    : 'Filme auf der Liste, nur für dich'
                  : 'Filme auf der Liste'
              }
            />
          ) : null}
          {stats?.average ? (
            <StatCard
              label="Ø Bewertung"
              value=""
              rating={stats.average}
              note={`aus ${String(stats.ratings)} Bewertungen`}
            />
          ) : (
            <StatCard label="Ø Bewertung" value="—" note="noch nichts bewertet" />
          )}
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">Zuletzt gesehen</h2>

        {eintraege.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {eigenes
              ? 'Noch nichts eingetragen.'
              : 'Hier ist nichts zu sehen. Entweder wurde noch nichts eingetragen, oder es ist nicht für dich bestimmt.'}
          </p>
        ) : (
          <ol className="flex flex-col gap-5">
            {eintraege.map((eintrag) => {
              const titel = eintrag.films.title_de ?? eintrag.films.title_original;
              const gesehen = formatWatchedOn(eintrag.watched_on);
              const plakat =
                eintrag.films.poster_source === 'tvdb' && eintrag.films.poster_url
                  ? eintrag.films.poster_url
                  : `/poster/${eintrag.films.wikidata_id}`;

              return (
                <li key={eintrag.id} className="flex gap-4">
                  <Link
                    href={`/film/${eintrag.films.wikidata_id}` as Route}
                    className="bg-card w-[64px] shrink-0 overflow-hidden rounded"
                  >
                    <img src={plakat} alt="" className="aspect-[2/3] h-full w-full object-cover" />
                  </Link>

                  <div className="flex min-w-0 flex-col gap-1">
                    <Link
                      href={`/film/${eintrag.films.wikidata_id}` as Route}
                      className="font-medium hover:underline"
                    >
                      {titel}
                      {eintrag.films.release_year ? (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          {eintrag.films.release_year}
                        </span>
                      ) : null}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {eintrag.rating === null ? null : (
                        <>
                          <PopcornRating rating={eintrag.rating} size={16} />
                          <span className="tabular-nums">{formatRating(eintrag.rating)}</span>
                        </>
                      )}
                      {gesehen ? <span className="text-muted-foreground">{gesehen}</span> : null}
                      {eintrag.is_rewatch ? (
                        <span className="text-muted-foreground">Wiedersehen</span>
                      ) : null}
                    </div>

                    {eintrag.review ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed">
                        {eintrag.review}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {watchlist.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold tracking-tight">
            Watchlist
            {/* Auf dem eigenen Profil steht dabei, was Fremde sehen — sonst
                merkt man erst an fremden Reaktionen, dass die Liste offen
                ist. */}
            {eigenes ? (
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                {watchCount === watchlist.length
                  ? 'nur für dich sichtbar, solange du sie nicht freigibst'
                  : ''}
              </span>
            ) : null}
          </h2>

          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {watchlist.map((eintrag) => (
              <li key={eintrag.films.wikidata_id}>
                <Link
                  href={`/film/${eintrag.films.wikidata_id}` as Route}
                  className="text-sm hover:underline"
                >
                  {eintrag.films.title_de ?? eintrag.films.title_original}
                  {eintrag.films.release_year ? (
                    <span className="text-muted-foreground"> {eintrag.films.release_year}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {(watchCount ?? 0) > watchlist.length ? (
            <p className="text-muted-foreground text-sm">
              und {String((watchCount ?? 0) - watchlist.length)} weitere
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
