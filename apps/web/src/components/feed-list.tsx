'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState, useTransition } from 'react';

import { moreFeed } from '@/lib/feed-actions';
import { FEED_SEITE, type FeedEintrag } from '@/lib/feed';
import { PopcornRating, formatRating } from '@/components/popcorn';
import { Avatar } from '@/components/profile-parts';
import { formatWatchedOn } from '@/lib/dates';

/**
 * Was die Leute eingetragen haben, denen du folgst.
 *
 * Chronologisch und vollstaendig, ohne Gewichtung — das ist ein
 * Produktversprechen und kein Implementierungsdetail (M4 4.4).
 *
 * Nachgeladen wird per Cursor auf dem letzten Eintrag, nicht per
 * Seitenzahl. Wer waehrend des Lesens einen neuen Eintrag bekommt, soll
 * nicht denselben Film zweimal sehen.
 */
export function FeedList({
  anfang,
  avatarBasis,
}: {
  anfang: FeedEintrag[];
  /** Die oeffentliche Adresse des Bucket, damit der Server die Pfade
      nicht je Eintrag aufloesen muss. */
  avatarBasis: string;
}) {
  const [eintraege, setEintraege] = useState(anfang);
  const [fertig, setFertig] = useState(anfang.length < FEED_SEITE);
  const [laeuft, startTransition] = useTransition();

  const nachladen = () => {
    const letzter = eintraege[eintraege.length - 1];
    if (!letzter) return;

    startTransition(async () => {
      const weitere = await moreFeed(letzter.created_at, letzter.id);
      setEintraege([...eintraege, ...weitere]);
      if (weitere.length < FEED_SEITE) setFertig(true);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-5">
        {eintraege.map((e) => {
          const titel = e.title_de ?? e.title_original;
          const gesehen = formatWatchedOn(e.watched_on);
          const plakat =
            e.poster_source === 'tvdb' && e.poster_url ? e.poster_url : `/poster/${e.film_id}`;

          return (
            <li key={e.id} className="flex gap-4">
              <Link
                href={`/film/${e.film_id}` as Route}
                className="bg-card w-16 shrink-0 overflow-hidden rounded"
              >
                <img src={plakat} alt="" className="aspect-[2/3] w-full object-cover" />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <Link
                    href={`/@${e.username}` as Route}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {e.avatar_path ? (
                      <img
                        src={`${avatarBasis}${e.avatar_path}`}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <Avatar name={e.username} size={24} />
                    )}
                    <span className="font-medium">{e.username}</span>
                  </Link>
                  <span className="text-muted-foreground">
                    {e.is_rewatch ? 'hat wiedergesehen' : 'hat gesehen'}
                  </span>
                </div>

                <Link href={`/film/${e.film_id}` as Route} className="font-medium hover:underline">
                  {titel}
                  {e.release_year ? (
                    <span className="text-muted-foreground font-normal"> {e.release_year}</span>
                  ) : null}
                </Link>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {e.rating === null ? null : (
                    <>
                      <PopcornRating rating={e.rating} size={14} />
                      <span className="tabular-nums">{formatRating(e.rating)}</span>
                    </>
                  )}
                  {gesehen ? <span className="text-muted-foreground">{gesehen}</span> : null}
                </div>

                {e.review ? (
                  <p className="text-muted-foreground line-clamp-4 text-sm leading-relaxed">
                    {e.review}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {fertig ? null : (
        <button
          type="button"
          disabled={laeuft}
          onClick={nachladen}
          className="border-border hover:bg-card self-start rounded-md border px-4 py-2 text-sm disabled:opacity-60"
        >
          {laeuft ? 'Lädt' : 'Mehr'}
        </button>
      )}
    </div>
  );
}
