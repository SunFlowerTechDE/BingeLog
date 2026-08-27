-- M3 3.3 — the community rating a film page shows.
--
-- A function rather than a view, and definer rather than invoker, so the
-- number is the same for everyone. A security-invoker view would count
-- the caller's own private entries for them and not for anyone else,
-- which makes a "community average" that differs per reader.
--
-- Private entries are excluded, matching how facet averages already
-- work (M0 0.4b). Someone who logs a film privately takes part in their
-- own diary, not in the public verdict.

create or replace function public.film_rating_summary(film text)
returns table (
  average numeric,
  votes   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(d.rating)::numeric, 2) as average,
         count(*)::integer                as votes
  from public.diary_entries d
  where d.film_id = film
    and d.rating is not null
    and d.is_private = false;
$$;

comment on function public.film_rating_summary(text) is
  'M3 3.3. Ratings are stored 1..10 for half stars; the UI divides by two '
  '(M3, Fallstricke: half stars from the start, migrating 5 to 10 steps '
  'later would falsify every existing rating).';

grant execute on function public.film_rating_summary(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The viewer's own facet ratings for a film.
--
-- The film page shows them beside the community value (M3 3.4b). Doing it
-- in one call keeps the page from issuing seven round trips, and RLS on
-- entry_facet_ratings still decides what comes back: the function is
-- invoker, not definer, on purpose.
-- ---------------------------------------------------------------------------

create or replace function public.my_facet_ratings(film text)
returns table (
  facet public.facet_kind,
  score smallint
)
language sql
stable
as $$
  select f.facet, f.score
  from public.entry_facet_ratings f
  join public.diary_entries d on d.id = f.entry_id
  where d.film_id = film
    and d.user_id = (select auth.uid())
  order by d.created_at desc, f.facet;
$$;

grant execute on function public.my_facet_ratings(text) to authenticated;
