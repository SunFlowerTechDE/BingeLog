-- Die Verteilung stand auf der falschen Skala.
--
-- `diary_entries.rating` ist `smallint` von 1 bis 10 — halbe Popcorn,
-- intern gezaehlt (20260826090100). Die erste Fassung erzeugte die
-- Stufen als `generate_series(0.5, 5.0, 0.5)`, also die Skala, wie sie
-- der Nutzer sieht.
--
-- Auf dem Schirm sah das so aus: zehn Saeulen, von denen nur jede zweite
-- einen Wert trug, und darunter die Beschriftung "0,3 0,5 0,8 1,0" —
-- weil die Anzeige noch einmal halbiert, was schon halbiert war.
--
-- Der Verbindungspunkt zwischen Datenbank und Anzeige ist die interne
-- Zahl. Wer sie unterwegs umrechnet, rechnet sie zweimal um.

-- `create or replace` kann den Rueckgabetyp nicht aendern: numeric wird
-- integer, und Postgres lehnt das ab. Also erst weg, dann neu.
drop function if exists public.profile_rating_spread(uuid);

create function public.profile_rating_spread(profile uuid)
returns table (
  rating integer,
  films  integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    stufe.rating::integer,
    coalesce(count(d.id), 0)::integer as films
  from generate_series(1, 10) as stufe(rating)
  left join public.diary_entries d
    on d.user_id = profile
   and d.rating  = stufe.rating
  group by stufe.rating
  order by stufe.rating;
$$;

comment on function public.profile_rating_spread(uuid) is
  'M4 4.2. Alle zehn Stufen der internen Skala 1..10, auch die leeren — '
  'die Luecken sind die Aussage. Umgerechnet wird erst in der Anzeige.';

grant execute on function public.profile_rating_spread(uuid) to anon, authenticated;
