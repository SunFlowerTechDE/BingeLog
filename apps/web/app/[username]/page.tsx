import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { FollowButton } from '@/components/follow-button';
import { PopcornRating, formatRating } from '@/components/popcorn';
import { formatWatchedOn } from '@/lib/dates';

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
    .select('id, username, display_name, bio, created_at')
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
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {profile.display_name ?? `@${profile.username}`}
          </h1>
          {profile.display_name ? (
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
          ) : null}
        </div>

        {profile.bio ? <p className="max-w-prose text-sm leading-relaxed">{profile.bio}</p> : null}

        <dl className="text-muted-foreground flex gap-6 text-sm">
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
          <FollowButton
            username={profile.username}
            initiallyFollowing={folgtIhm}
            followsBack={folgtZurueck}
          />
        ) : null}

        {eigenes ? (
          <p className="text-muted-foreground text-sm">
            So sehen andere dein Profil. Was hier fehlt, hast du auf „Nur für mich" gestellt.
          </p>
        ) : null}
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
    </main>
  );
}
