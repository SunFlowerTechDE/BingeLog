-- Watchlist-Konzept, "Freunde haben ihn gesehen".
--
-- Ein kleiner sozialer Hinweis auf der Karte: wer aus dem Freundeskreis
-- den Film schon gesehen hat und was er ihm gegeben hat. Das ist der
-- Unterschied zwischen "liegt auf meiner Liste" und "den empfiehlt dir
-- jemand, den du kennst".
--
-- **Die Sichtbarkeit steht nicht hier.** Die Funktion bleibt
-- `security invoker`, also gilt die Policy auf `diary_entries`: nur was
-- ich ohnehin lesen darf, zaehlt mit. Ein privater Eintrag eines
-- Freundes taucht auch nicht als Zahl auf — eine Zahl, die es ohne den
-- Eintrag nicht gaebe, ist derselbe Verrat wie der Eintrag.

drop function if exists public.watchlist_for_me();

create function public.watchlist_for_me()
returns table (
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  runtime_min    integer,
  poster_source  text,
  poster_url     text,
  added_at       timestamptz,
  average        numeric,
  votes          integer,
  genre_ids      text[],
  genre_labels   text[],
  recommenders   integer,
  first_friend   text,
  priority       public.watchlist_priority,
  group_ids      uuid[],
  friends_seen   integer,
  friend_name    text,
  friend_rating  smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Der Freundeskreis einmal, nicht je Zeile. `are_friends` ist
  -- `security definer` und pro Tagebuchzeile aufgerufen zu teuer.
  with freunde as (
    select hin.followee_id as id
    from public.follows hin
    join public.follows zurueck
      on zurueck.follower_id = hin.followee_id
     and zurueck.followee_id = hin.follower_id
    where hin.follower_id = (select auth.uid())
  )
  select
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.runtime_min,
    f.poster_source,
    f.poster_url,
    w.added_at,
    s.average,
    coalesce(s.votes, 0),
    coalesce(g.ids, array[]::text[]),
    coalesce(g.labels, array[]::text[]),
    coalesce(r.anzahl, 0),
    r.wer,
    w.priority,
    coalesce(
      (
        select array_agg(gf.group_id)
        from public.watchlist_group_films gf
        where gf.user_id = w.user_id and gf.film_id = w.film_id
      ),
      array[]::uuid[]
    ),
    coalesce(fs.anzahl, 0),
    fb.wer,
    fb.note
  from public.watchlist w
  join public.films f on f.wikidata_id = w.film_id
  cross join lateral public.film_rating_summary(f.wikidata_id) s
  left join lateral (
    select
      array_agg(ge.wikidata_id order by ge.wikidata_id) as ids,
      array_agg(coalesce(ge.label_de, ge.label_en) order by ge.wikidata_id) as labels
    from public.film_categories fc
    join public.genres ge on ge.wikidata_id = fc.category_id
    where fc.film_id = f.wikidata_id
      and coalesce(ge.label_de, ge.label_en) is not null
  ) g on true
  left join lateral (
    select
      count(*)::integer as anzahl,
      (
        select p.username
        from public.recommendations r2
        join public.profiles p on p.id = r2.from_user
        where r2.to_user = w.user_id
          and r2.film_id = f.wikidata_id
          and r2.dismissed_at is null
        order by r2.created_at desc
        limit 1
      ) as wer
    from public.recommendations r1
    where r1.to_user = w.user_id
      and r1.film_id = f.wikidata_id
      and r1.dismissed_at is null
  ) r on true
  -- Personen, nicht Eintraege: wer den Film dreimal gesehen hat, ist
  -- ein Freund und nicht drei.
  left join lateral (
    select count(distinct d.user_id)::integer as anzahl
    from public.diary_entries d
    join freunde fr on fr.id = d.user_id
    where d.film_id = f.wikidata_id
  ) fs on true
  -- Und einer davon namentlich, der mit der besten Note. Wer einen Film
  -- vorgemerkt hat, will wissen, ob er sich lohnt.
  left join lateral (
    select p.username as wer, d.rating as note
    from public.diary_entries d
    join freunde fr on fr.id = d.user_id
    join public.profiles p on p.id = d.user_id
    where d.film_id = f.wikidata_id
      and d.rating is not null
    order by d.rating desc, d.watched_on desc nulls last
    limit 1
  ) fb on true
  where w.user_id = (select auth.uid())
  order by w.added_at desc;
$$;

comment on function public.watchlist_for_me() is
  'Watchlist-Konzept, Prioritaet 1 und Block "Danach". Die ganze eigene '
  'Watchlist mit allem, was die Seite zum Sortieren, Filtern und '
  'Kennzeichnen braucht: Prioritaet, Gruppen, Empfehlungen von Freunden '
  'und wer aus dem Freundeskreis den Film schon gesehen hat. Genres als '
  'Kategorien (Suchkonzept 26). Sortiert und gefiltert wird im Client. '
  'security invoker, damit die Policy auf diary_entries entscheidet, '
  'welche Sichtungen mitzaehlen.';

revoke execute on function public.watchlist_for_me() from public;
grant execute on function public.watchlist_for_me() to authenticated;
