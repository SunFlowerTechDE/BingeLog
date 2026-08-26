import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';

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

        <p className="text-muted-foreground text-sm">Bewerten und eintragen kommt als Nächstes.</p>
      </div>
    </main>
  );
}
