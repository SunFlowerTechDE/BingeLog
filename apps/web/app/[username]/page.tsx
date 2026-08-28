import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { FollowButton } from '@/components/follow-button';
import { PopcornRating, formatRating } from '@/components/popcorn';
import { formatWatchedOn } from '@/lib/dates';
import { Avatar, StatCard, Panel, Chip, Saeulen, Balken } from '@/components/profile-parts';
import { Symbol } from '@/components/icons';
import { ShareButton } from '@/components/share-button';
import { ReportButton } from '@/components/report-button';

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
    .select(
      'id, username, display_name, bio, created_at, watchlist_public, avatar_path, banner_path',
    )
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
    // Drei, nicht fuenf. Wikidata haengt einem Film gern ein halbes
    // Dutzend Genres an — Titanic fuehrt dort Monumentalfilm,
    // Historienfilm, Katastrophenfilm, Melodram und Liebesfilm.
    //
    // Auf fuenf gestellt kam bei sieben Filmen prompt wieder
    // "Monumentalfilm" heraus, weil dort alles bei zwei Filmen
    // gleichauf liegt. Die Untergrenze in der Funktion allein reicht
    // dagegen nicht; die kurze Liste gehoert dazu.
    supabase.rpc('profile_genres', { profile: profile.id, max_results: 3 }),
  ]);

  // Die vier Auswertungen aus 4.2. Alle vier sind `security invoker`:
  // was ein Fremder zaehlt, ist das, was er auch sehen darf. Ein
  // privater Eintrag zaehlt nicht mit — auch nicht als Strich in einem
  // Balken.
  //
  // Kein Cache. Bei 3000 Eintraegen brauchen alle sechs Auswertungen
  // zusammen unter 25 ms, die Leitung nach Frankfurt allein rund 14.
  // Die Messung steht in 20260828300000.
  const [{ data: jahrRows }, { data: notenRows }, { data: regieRows }, { data: dekadenRows }] =
    await Promise.all([
      supabase.rpc('profile_years', { profile: profile.id }),
      supabase.rpc('profile_rating_spread', { profile: profile.id }),
      supabase.rpc('profile_directors', { profile: profile.id, max_results: 5 }),
      supabase.rpc('profile_decades', { profile: profile.id }),
    ]);

  const jahre = jahrRows ?? [];
  const noten = notenRows ?? [];
  const regie = regieRows ?? [];
  const dekaden = dekadenRows ?? [];
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

  const { data: favRows } = await supabase
    .from('favourites')
    .select(
      'position, films(wikidata_id, title_de, title_original, release_year, poster_source, poster_url)',
    )
    .eq('user_id', profile.id)
    .order('position');

  const favoriten = (favRows ?? []) as unknown as {
    position: number;
    films: {
      wikidata_id: string;
      title_de: string | null;
      title_original: string;
      release_year: number | null;
      poster_source: string | null;
      poster_url: string | null;
    };
  }[];

  // Welche Listen hier stehen, entscheidet die Policy: oeffentliche
  // fuer alle, private nur fuer den Besitzer.
  const { data: listenRows, count: listenCount } = await supabase
    .from('lists')
    .select('id, title, is_public, list_items(count)', { count: 'exact' })
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })
    .limit(4);

  const listen = (listenRows ?? []) as unknown as {
    id: string;
    title: string;
    is_public: boolean;
    list_items: { count: number }[];
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

  const banner = profile.banner_path
    ? supabase.storage.from('banners').getPublicUrl(profile.banner_path).data.publicUrl
    : null;

  const avatar = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null;

  // Zwei Auszuege aus denselben Eintraegen. Getrennt, weil ein Film
  // bewertet sein kann ohne ein Wort dazu, und ein Wort ohne Note.
  const bewertet = eintraege.filter((e) => e.rating !== null).slice(0, 4);
  const rezensionen = eintraege.filter((e) => e.review).slice(0, 3);

  return (
    <>
      {/* Das Kopfbild laeuft ueber die volle Breite und an zwei Seiten
          ins Dunkle aus: nach unten in den Seitengrund, nach links unter
          den Text. Ein Bild mit hellem Motiv genau dort, wo der Name
          steht, macht den Namen unlesbar — und welches Bild jemand
          hochlaedt, weiss die Seite nicht.

          Beide Verlaeufe enden auf --color-background und nicht auf
          Schwarz. Ein spaeteres helles Thema wuerde sonst einen
          schwarzen Balken bekommen, den niemand mehr zuordnen kann.

          Kein next/image: das Bild liegt schon in der richtigen Groesse
          im Speicher. */}
      {banner ? (
        <div aria-hidden="true" className="relative h-[260px] w-full overflow-hidden sm:h-[420px]">
          <img src={banner} alt="" className="h-full w-full object-cover" />
          <div className="from-background via-background/70 from-12% absolute inset-0 bg-gradient-to-t via-45% to-transparent" />
          <div className="from-background from-8% via-background/60 via-38% to-72% absolute inset-0 bg-gradient-to-r to-transparent" />
        </div>
      ) : null}

      <main
        className={`relative mx-auto flex max-w-7xl flex-col gap-5 px-5 pb-12 ${
          // Das Profil rutscht in den dunklen Teil des Bildes hinein,
          // statt darunter anzufangen. Genau so weit, dass der Name auf
          // dem gedeckten Grund steht und nicht auf dem Motiv.
          banner ? '-mt-[168px] sm:-mt-[290px]' : 'pt-8'
        }`}
      >
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          {avatar ? (
            // Kein next/image: das Bild liegt bereits in der richtigen
            // Groesse im Speicher, ein Proxy davor waere Arbeit ohne
            // Wirkung.
            <img
              src={avatar}
              alt=""
              width={176}
              height={176}
              className="ring-border bg-card h-28 w-28 shrink-0 rounded-full object-cover ring-4 sm:h-44 sm:w-44"
            />
          ) : (
            <div className="ring-border shrink-0 rounded-full ring-4">
              <Avatar name={profile.username} size={176} />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:pt-6">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-4xl font-semibold tracking-tight">{profile.username}</h1>
              {profile.display_name ? (
                <p className="text-muted-foreground">{profile.display_name}</p>
              ) : null}
            </div>

            {profile.bio ? (
              <p className="max-w-prose text-sm leading-relaxed">{profile.bio}</p>
            ) : null}

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <span className="flex items-center gap-1.5">
                <Symbol art="stern" size={14} />
                Mitglied seit {monatJahr(profile.created_at)}
              </span>
              <span className="flex items-center gap-3">
                <span>
                  Folgt <span className="text-foreground tabular-nums">{folgt ?? 0}</span>
                </span>
                <span>
                  Folgen <span className="text-foreground tabular-nums">{folgen ?? 0}</span>
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {eigenes ? (
                <Link
                  href="/einstellungen"
                  className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold"
                >
                  Profil bearbeiten
                </Link>
              ) : null}
              {viewer && !eigenes ? (
                <FollowButton
                  username={profile.username}
                  initiallyFollowing={folgtIhm}
                  followsBack={folgtZurueck}
                />
              ) : null}
              <ShareButton
                pfad={`/@${profile.username}`}
                titel={`@${profile.username} auf BingeLog`}
              />
              {eigenes ? null : (
                <ReportButton
                  targetKind="profile"
                  targetId={profile.username}
                  angemeldet={viewer !== null}
                  was="Profil"
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                />
              )}
            </div>

            {eigenes ? (
              <p className="text-muted-foreground text-sm">
                So sehen andere dein Profil. Was hier fehlt, hast du auf „Nur für mich" gestellt.
              </p>
            ) : null}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            art="film"
            label="Gesehene Filme"
            value={String(stats?.films ?? 0)}
            note="Filme insgesamt"
          />
          <StatCard
            art="popcorn"
            label="Bewertungen"
            value={String(stats?.ratings ?? 0)}
            note="Popcorn vergeben"
          />
          {/* Fuer Fremde nur, wenn die Liste offen steht. Sonst stuende
              dort eine Null, die "verborgen" heisst und nicht "leer" —
              eine Zahl, die etwas anderes bedeutet als sie sagt. */}
          {eigenes || profile.watchlist_public ? (
            <StatCard
              art="merken"
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
              art="stern"
              label="Ø Bewertung"
              value=""
              rating={stats.average}
              note={`aus ${String(stats.ratings)} Bewertungen`}
            />
          ) : (
            <StatCard art="stern" label="Ø Bewertung" value="—" note="noch nichts bewertet" />
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel titel="Lieblingsgenres" art="herz">
            {genres.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {eigenes
                  ? 'Trag ein paar Filme ein, dann steht hier was.'
                  : 'Noch zu wenig eingetragen.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <Chip key={g.label}>{g.label}</Chip>
                ))}
              </div>
            )}
          </Panel>

          <Panel titel="Zuletzt bewertet" art="stern" mehr={eigenes ? '/tagebuch' : undefined}>
            {bewertet.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {eigenes ? 'Noch nichts bewertet.' : 'Hier ist nichts zu sehen.'}
              </p>
            ) : (
              <ol className="grid grid-cols-4 gap-3">
                {bewertet.map((e) => (
                  <li key={e.id} className="flex min-w-0 flex-col gap-1.5">
                    <Link
                      href={`/film/${e.films.wikidata_id}` as Route}
                      className="bg-card block overflow-hidden rounded"
                    >
                      <img
                        src={
                          e.films.poster_source === 'tvdb' && e.films.poster_url
                            ? e.films.poster_url
                            : `/poster/${e.films.wikidata_id}`
                        }
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </Link>
                    <Link
                      href={`/film/${e.films.wikidata_id}` as Route}
                      className="truncate text-xs font-medium hover:underline"
                    >
                      {e.films.title_de ?? e.films.title_original}
                    </Link>
                    {e.rating === null ? null : (
                      <span className="flex items-center gap-1.5">
                        <PopcornRating rating={e.rating} size={11} />
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatRating(e.rating)}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel titel="Letzte Rezensionen" art="feder" mehr={eigenes ? '/tagebuch' : undefined}>
            {rezensionen.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {eigenes
                  ? 'Noch nichts geschrieben.'
                  : 'Hier ist nichts zu sehen. Entweder wurde noch nichts geschrieben, oder es ist nicht für dich bestimmt.'}
              </p>
            ) : (
              <ol className="flex flex-col gap-4">
                {rezensionen.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <Link
                      href={`/film/${e.films.wikidata_id}` as Route}
                      className="bg-card w-10 shrink-0 overflow-hidden rounded"
                    >
                      <img
                        src={
                          e.films.poster_source === 'tvdb' && e.films.poster_url
                            ? e.films.poster_url
                            : `/poster/${e.films.wikidata_id}`
                        }
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <Link
                          href={`/film/${e.films.wikidata_id}` as Route}
                          className="text-sm font-medium hover:underline"
                        >
                          {e.films.title_de ?? e.films.title_original}
                        </Link>
                        {e.rating === null ? null : (
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {formatRating(e.rating)}
                          </span>
                        )}
                        {formatWatchedOn(e.watched_on) ? (
                          <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                            {formatWatchedOn(e.watched_on)}
                          </span>
                        ) : null}
                      </div>
                      {/* Gekuerzt, nicht abgeschnitten: der ganze Text
                          steht auf der Filmseite. */}
                      <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                        {e.review}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* Die vier Plaetze stehen nur, wenn jemand sie besetzt hat. Vier
            leere Rahmen auf einem fremden Profil sind eine Aufgabe, die
            den Besucher nichts angeht. Auf dem eigenen Profil ist es
            eine — deshalb dort der Hinweis. */}
        {favoriten.length > 0 || eigenes ? (
          <Panel
            titel="Favoriten"
            art="herz"
            mehr={eigenes ? '/einstellungen' : undefined}
            mehrText={eigenes ? 'Bearbeiten' : undefined}
          >
            {favoriten.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Vier Filme, die für dich stehen. Such sie dir in den Einstellungen aus.
              </p>
            ) : (
              <ol className="grid grid-cols-4 gap-4 sm:max-w-lg">
                {favoriten.map((f) => (
                  <li key={f.position} className="flex min-w-0 flex-col gap-1.5">
                    <Link
                      href={`/film/${f.films.wikidata_id}` as Route}
                      className="bg-card block overflow-hidden rounded"
                    >
                      <img
                        src={
                          f.films.poster_source === 'tvdb' && f.films.poster_url
                            ? f.films.poster_url
                            : `/poster/${f.films.wikidata_id}`
                        }
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </Link>
                    <Link
                      href={`/film/${f.films.wikidata_id}` as Route}
                      className="truncate text-xs font-medium hover:underline"
                    >
                      {f.films.title_de ?? f.films.title_original}
                    </Link>
                    {f.films.release_year ? (
                      <span className="text-muted-foreground text-xs">{f.films.release_year}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        ) : null}

        {listen.length > 0 || eigenes ? (
          <Panel
            titel="Binge-Listen"
            art="buch"
            mehr={`/@${profile.username}/listen`}
            mehrText={listenCount && listenCount > listen.length ? 'Alle anzeigen' : undefined}
          >
            {listen.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Noch keine Liste. Filme, die zusammengehören, kannst du zu einer Sammlung machen.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {listen.map((liste) => (
                  <li key={liste.id}>
                    <Link
                      href={`/listen/${liste.id}` as Route}
                      className="border-border bg-card/60 hover:bg-card flex h-full flex-col gap-1 rounded-lg border p-3"
                    >
                      <span className="text-sm font-medium">{liste.title}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {liste.list_items[0]?.count ?? 0} Filme
                        {eigenes && !liste.is_public ? ' · nur für dich' : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        {/* Die Zahlen erscheinen erst, wenn sie etwas sagen. Ein
            Balkendiagramm mit einem Balken ist kein Diagramm, und eine
            Verteilung aus drei Bewertungen ist keine Verteilung. */}
        {jahre.length > 1 || noten.some((n) => n.films > 0) || dekaden.length > 1 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {noten.some((n) => n.films > 0) ? (
              <Panel titel="Wie du bewertest" art="popcorn">
                <Saeulen
                  daten={noten.map((n) => ({ label: formatRating(n.rating), wert: n.films }))}
                  einheit="Filme"
                />
              </Panel>
            ) : null}

            {jahre.length > 1 ? (
              <Panel titel="Filme pro Jahr" art="film">
                <Saeulen
                  daten={jahre.map((j) => ({ label: String(j.year), wert: j.films }))}
                  einheit="Filme"
                />
              </Panel>
            ) : null}

            {dekaden.length > 1 ? (
              <Panel titel="Aus welchen Jahrzehnten" art="stern">
                <Balken
                  daten={dekaden.map((d) => ({ label: `${String(d.decade)}er`, wert: d.films }))}
                />
              </Panel>
            ) : null}

            {/* Ab zwei Filmen je Person — einer macht keinen
                Lieblingsregisseur. Die Untergrenze steckt in der
                Funktion, hier faellt nur die leere Tafel weg. */}
            {regie.length > 0 ? (
              <Panel titel="Häufigste Regie" art="feder">
                <Balken daten={regie.map((r) => ({ label: r.name, wert: r.films }))} />
              </Panel>
            ) : null}
          </div>
        ) : null}

        {eigenes || profile.watchlist_public ? (
          <Panel titel="Watchlist" art="merken" mehr={eigenes ? '/watchlist' : undefined}>
            {watchlist.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {eigenes ? 'Noch nichts vorgemerkt.' : 'Nichts zu sehen.'}
              </p>
            ) : (
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {watchlist.map((e) => (
                  <li key={e.films.wikidata_id} className="flex items-center gap-3">
                    <Link
                      href={`/film/${e.films.wikidata_id}` as Route}
                      className="bg-card w-9 shrink-0 overflow-hidden rounded"
                    >
                      <img
                        src={`/poster/${e.films.wikidata_id}`}
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/film/${e.films.wikidata_id}` as Route}
                        className="truncate text-sm hover:underline"
                      >
                        {e.films.title_de ?? e.films.title_original}
                      </Link>
                      {e.films.release_year ? (
                        <span className="text-muted-foreground text-xs">
                          {e.films.release_year}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
      </main>
    </>
  );
}
