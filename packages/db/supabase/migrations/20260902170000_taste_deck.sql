-- Der Geschmackscheck: Filme durchblättern, drei Knöpfe (Entwurf 02.09.2026).
--
-- Das Match Making braucht Beobachtungen, und ein neues Konto hat keine.
-- Ein Stapel Plakate loest das: auch wer einen Film nicht kennt, kann an
-- Titel und Bild sagen, ob er ihn reizt.
--
-- **Das ist keine Bewertung.** Eine Stimme aus dem Stapel erzeugt keinen
-- Tagebucheintrag, steht in keinem Profil und geht in keinen
-- Filmdurchschnitt ein — sie liegt in dieser eigenen Tabelle und traegt
-- nur das Match Making. `film_rating_summary` sieht sie nie.
--
-- **Anziehung ist nicht Urteil.** Ein Daumen auf ein Plakat sagt etwas
-- anderes als eine Note nach dem Sehen, und beides gleich zu gewichten
-- hiesse, zwanzig Plakate ueber zwanzig gesehene Filme zu stellen.
-- Deshalb zaehlt eine Tagebuchnote 1,0 und eine Stimme aus dem Stapel
-- 0,4.

create type public.taste_verdict as enum (
  'like',
  'dislike',
  'unsure'                    -- "Weiss nicht": gezaehlt, aber ohne Richtung
);

create table public.taste_votes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  film_id    text not null references public.films (wikidata_id) on delete cascade,
  verdict    public.taste_verdict not null,
  created_at timestamptz not null default now(),

  primary key (user_id, film_id)
);

create index taste_votes_film_idx on public.taste_votes (film_id);

alter table public.taste_votes enable row level security;

-- Streng privat, und zwar auch gegenueber Freunden. Was jemanden
-- anspringt, ist keine Aussage, die er veroeffentlicht hat — anders als
-- ein Tagebucheintrag, den er bewusst sichtbar macht.
create policy taste_votes_own_read on public.taste_votes
  for select to authenticated using (user_id = (select auth.uid()));

create policy taste_votes_own_insert on public.taste_votes
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy taste_votes_own_update on public.taste_votes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy taste_votes_own_delete on public.taste_votes
  for delete to authenticated using (user_id = (select auth.uid()));

comment on table public.taste_votes is
  'Geschmackscheck. Eine Stimme je Film und Person, ueberschreibbar. '
  'Keine Bewertung: erzeugt keinen Tagebucheintrag und geht in keinen '
  'Filmdurchschnitt ein. Streng privat.';

-- --------------------------------------------------------------- Der Stapel

-- Welche Filme als Naechstes gezeigt werden.
--
-- **Nicht die beliebtesten.** Der Stapel soll Wissen einsammeln, nicht
-- gefallen: gezeigt wird, was ueber die duennste Kategorie etwas verraet.
-- Zwanzig zufaellige Filme aus dem Katalog waeren zu 45 Prozent Dramen
-- (gemessen am 02.09.2026: 109 von 155) und wuessten danach ueber Horror
-- nichts.
--
-- Filme ohne Kategorie bleiben draussen — sie lehren nichts. Ebenso
-- alles, worueber schon eine Aussage vorliegt: eine Stimme, oder ein
-- Tagebucheintrag, der ohnehin mehr wiegt.
create or replace function public.taste_deck(wanted integer default 20)
returns table (
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  poster_source  text,
  poster_url     text,
  category_label text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with beobachtet as (
    -- Was ich ueber jede Kategorie schon weiss, aus beiden Quellen.
    select fc.category_id, count(*)::numeric as gewicht
    from public.film_categories fc
    where exists (
        select 1 from public.taste_votes v
        where v.user_id = (select auth.uid()) and v.film_id = fc.film_id
      )
      or exists (
        select 1 from public.diary_entries d
        where d.user_id = (select auth.uid()) and d.film_id = fc.film_id
          and d.rating is not null
      )
    group by fc.category_id
  ),
  offen as (
    select
      f.wikidata_id,
      f.title_de,
      f.title_original,
      f.release_year,
      f.poster_source,
      f.poster_url,
      -- Die duennste Kategorie dieses Films entscheidet, wie viel er
      -- beitraegt.
      min(coalesce(b.gewicht, 0)) as duennste,
      count(*) as kategorien,
      min(coalesce(g.label_de, g.label_en)) as beschriftung
    from public.films f
    join public.film_categories fc on fc.film_id = f.wikidata_id
    join public.genres g on g.wikidata_id = fc.category_id
    left join beobachtet b on b.category_id = fc.category_id
    where not exists (
        select 1 from public.taste_votes v
        where v.user_id = (select auth.uid()) and v.film_id = f.wikidata_id
      )
      and not exists (
        select 1 from public.diary_entries d
        where d.user_id = (select auth.uid()) and d.film_id = f.wikidata_id
      )
    group by f.wikidata_id, f.title_de, f.title_original, f.release_year,
             f.poster_source, f.poster_url
  )
  select
    wikidata_id, title_de, title_original, release_year,
    poster_source, poster_url, beschriftung
  from offen
  -- Erst die duennste Kategorie, dann der Film, der ueber mehrere
  -- zugleich etwas sagt. Die ID zuletzt, damit die Reihenfolge
  -- reproduzierbar ist statt zufaellig.
  order by duennste asc, kategorien desc, wikidata_id
  limit greatest(1, least(coalesce(wanted, 20), 100));
$$;

comment on function public.taste_deck(integer) is
  'Die naechsten Karten des Geschmackschecks, nach Wissensluecke '
  'sortiert: zuerst Filme aus der Kategorie, ueber die am wenigsten '
  'bekannt ist. Ohne Kategorie kein Film, und nichts, worueber schon '
  'eine Stimme oder ein Tagebucheintrag vorliegt.';

revoke execute on function public.taste_deck(integer) from public;
grant execute on function public.taste_deck(integer) to authenticated;

-- ------------------------------------------------------------ Belastbarkeit

-- Wie weit das Profil traegt.
--
-- Drei Groessen, weil eine Zahl allein luegen kann:
--
--   Abdeckung  wie viele der 16 Kategorien fuenf Beobachtungen haben.
--              Fuenf ist die Grenze, ab der eine Kategorie mehr ist als
--              Rauschen; zehn macht sie stabil.
--   Menge      wie viel insgesamt vorliegt, gedeckelt bei 80.
--   Streuung   ob ueberhaupt unterschieden wird. Wer alles mag, hat bei
--              tausend Stimmen kein Profil. 4p(1-p) ist bei halb/halb 1
--              und an beiden Enden 0.
--
-- Die Abdeckung wiegt am schwersten: hundert Dramen sagen nichts
-- darueber, ob jemand Horror mag.
create or replace function public.taste_readiness()
returns table (
  votes              integer,
  rated              integer,
  observations       numeric,
  categories_covered integer,
  readiness          integer,
  label              text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with stimmen as (
    select count(*)::integer as anzahl,
           count(*) filter (where verdict = 'like')::numeric as mag,
           count(*) filter (where verdict = 'dislike')::numeric as mag_nicht
    from public.taste_votes
    where user_id = (select auth.uid())
  ),
  noten as (
    select count(*)::integer as anzahl
    from public.diary_entries
    where user_id = (select auth.uid()) and rating is not null
  ),
  -- Eine echte Note zaehlt voll, eine Stimme aus dem Stapel 0,4.
  je_kategorie as (
    select
      fc.category_id,
      sum(
        case
          when exists (
            select 1 from public.diary_entries d
            where d.user_id = (select auth.uid()) and d.film_id = fc.film_id
              and d.rating is not null
          ) then 1.0
          else 0.4
        end
      ) as gewicht
    from public.film_categories fc
    where exists (
        select 1 from public.taste_votes v
        where v.user_id = (select auth.uid()) and v.film_id = fc.film_id
      )
      or exists (
        select 1 from public.diary_entries d
        where d.user_id = (select auth.uid()) and d.film_id = fc.film_id
          and d.rating is not null
      )
    group by fc.category_id
  ),
  teile as (
    select
      (select anzahl from stimmen) as stimmen,
      (select anzahl from noten) as noten,
      coalesce((select sum(gewicht) from je_kategorie), 0) as summe,
      coalesce((select count(*) from je_kategorie where gewicht >= 5), 0) as gedeckt,
      case
        when (select mag + mag_nicht from stimmen) = 0 then 0.5
        else (select mag / (mag + mag_nicht) from stimmen)
      end as anteil
  ),
  werte as (
    select
      stimmen, noten, summe, gedeckt,
      least(1.0, gedeckt / 16.0) as abdeckung,
      least(1.0, summe / 80.0) as menge,
      -- Ohne entschiedene Stimmen keine Aussage ueber die Streuung.
      -- Dann steht sie neutral, statt das Ergebnis zu druecken.
      case when stimmen = 0 then 0.5 else 4 * anteil * (1 - anteil) end as streuung
    from teile
  ),
  ergebnis as (
    select
      stimmen, noten, summe, gedeckt,
      round(100 * (0.5 * abdeckung + 0.3 * menge + 0.2 * streuung))::integer as punkte
    from werte
  )
  select
    stimmen::integer,
    noten::integer,
    round(summe, 1),
    gedeckt::integer,
    punkte,
    case
      when punkte < 25 then 'Noch zu wenig'
      when punkte < 50 then 'Grobe Richtung'
      when punkte < 75 then 'Belastbar'
      else 'Fundiert'
    end
  from ergebnis;
$$;

comment on function public.taste_readiness() is
  'Wie weit das Geschmacksprofil traegt: Abdeckung der 16 Kategorien '
  '(gewichtet 0,5), Menge (0,3) und Streuung der Stimmen (0,2). Eine '
  'Tagebuchnote zaehlt 1,0, eine Stimme aus dem Stapel 0,4 — Anziehung '
  'ist nicht Urteil.';

revoke execute on function public.taste_readiness() from public;
grant execute on function public.taste_readiness() to authenticated;
