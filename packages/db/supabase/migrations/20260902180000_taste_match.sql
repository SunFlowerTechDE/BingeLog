-- Der persoenliche Match-Wert (Watchlist-Konzept, Block "Danach").
--
-- Aus den Beobachtungen des Geschmackschecks und den echten Noten wird
-- je Kategorie eine Vorliebe, und daraus je Film ein Prozentwert.
--
-- Drei Entscheidungen, die den Wert ehrlich halten:
--
-- 1. **Gemessen wird gegen den eigenen Schnitt**, nicht gegen die Skala.
--    Wer nie unter 3,5 vergibt, hat trotzdem Vorlieben — sie stehen in
--    der Abweichung, nicht in der Hoehe.
-- 2. **Schrumpfung gegen null.** Eine Kategorie mit einer Beobachtung
--    darf nicht so laut sprechen wie eine mit zwanzig. Der Nenner
--    traegt deshalb ein festes `SHRINK`; ohne das wuerde ein einzelnes
--    "gefaellt mir" zu 100 Prozent Uebereinstimmung.
-- 3. **Unter der Schwelle gar nichts.** Reicht das Profil nicht
--    (`taste_readiness` unter 50), kommt kein Wert zurueck. Eine Zahl,
--    die auf drei Karten beruht, ist schlimmer als keine — sie sieht
--    aus wie Wissen.

-- Wie stark eine Kategorie gemocht wird, von -1 bis +1.
create or replace function public.taste_profile()
returns table (
  category_id  text,
  label        text,
  score        numeric,
  observations numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mein_schnitt as (
    -- Der eigene Nullpunkt. Ohne Noten gibt es keinen; dann traegt nur
    -- der Stapel bei.
    select avg(rating)::numeric as mitte
    from public.diary_entries
    where user_id = (select auth.uid()) and rating is not null
  ),
  beitraege as (
    -- Aus dem Tagebuch: die Abweichung vom eigenen Schnitt, auf -1 bis
    -- +1 gestaucht. Volles Gewicht, denn hier hat jemand den Film
    -- wirklich gesehen.
    select
      d.film_id,
      1.0::numeric as gewicht,
      greatest(-1.0, least(1.0, (d.rating - m.mitte) / 4.5)) as richtung
    from public.diary_entries d
    cross join mein_schnitt m
    where d.user_id = (select auth.uid())
      and d.rating is not null
      and m.mitte is not null

    union all

    -- Aus dem Stapel: Anziehung, nicht Urteil. 0,4 Gewicht, und "weiss
    -- nicht" zaehlt fuer die Menge, aber ohne Richtung.
    select
      v.film_id,
      0.4::numeric,
      case v.verdict
        when 'like' then 0.8
        when 'dislike' then -0.8
        else 0.0
      end
    from public.taste_votes v
    where v.user_id = (select auth.uid())
  )
  select
    fc.category_id,
    coalesce(g.label_de, g.label_en),
    -- Gewichteter Mittelwert mit Schrumpfung: +5 im Nenner heisst, dass
    -- eine Kategorie erst ab etwa fuenf Beobachtungen laut wird.
    round(sum(b.gewicht * b.richtung) / (sum(b.gewicht) + 5), 4),
    round(sum(b.gewicht), 1)
  from beitraege b
  join public.film_categories fc on fc.film_id = b.film_id
  join public.genres g on g.wikidata_id = fc.category_id
  group by fc.category_id, coalesce(g.label_de, g.label_en)
  order by 3 desc;
$$;

comment on function public.taste_profile() is
  'Vorliebe je Kategorie, -1 bis +1. Gemessen als Abweichung vom eigenen '
  'Notenschnitt, geschrumpft gegen null, damit eine einzelne Beobachtung '
  'keine Aussage wird. Tagebuchnote 1,0, Stimme aus dem Stapel 0,4.';

revoke execute on function public.taste_profile() from public;
grant execute on function public.taste_profile() to authenticated;

-- ------------------------------------------------------------------ Je Film

-- Der Prozentwert fuer eine Handvoll Filme auf einmal.
--
-- Als Liste und nicht je Film, weil eine Watchlist mit vierzig
-- Eintraegen sonst vierzig Anfragen kostet.
create or replace function public.film_match(films text[])
returns table (
  film_id text,
  match   integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with reife as (
    select readiness from public.taste_readiness()
  ),
  profil as (
    select category_id, score from public.taste_profile()
  )
  select
    fc.film_id,
    -- Der Mittelwert der Kategorien dieses Films, von -1..+1 auf
    -- 1..99 Prozent gelegt. 50 heisst neutral, und das ist eine
    -- ehrliche Antwort; 0 und 100 gibt es nicht, weil es sie nicht gibt.
    greatest(1, least(99, round(50 + 50 * avg(coalesce(p.score, 0)))))::integer
  from public.film_categories fc
  left join profil p on p.category_id = fc.category_id
  where fc.film_id = any(films)
    -- Reicht das Profil nicht, kommt keine Zeile zurueck. Der Client
    -- zeigt dann nichts an, statt eine Zahl zu zeigen, die er selbst
    -- verwerfen muesste.
    and (select readiness from reife) >= 50
  group by fc.film_id;
$$;

comment on function public.film_match(text[]) is
  'Uebereinstimmung in Prozent fuer mehrere Filme. Leer, solange '
  'taste_readiness unter 50 liegt: eine Zahl auf duenner Grundlage sieht '
  'aus wie Wissen.';

revoke execute on function public.film_match(text[]) from public;
grant execute on function public.film_match(text[]) to authenticated;

-- ----------------------------------------------------------- Nachtrag

-- Die Streuung zaehlte nur die Stimmen aus dem Stapel.
--
-- Damit fiel jemand, der 70 echte Bewertungen mitbringt und danach
-- dreimal "gefaellt mir" tippt, auf 0 in diesem Teil — obwohl sein
-- Profil das breiteste im Haus ist. Gemessen wird jetzt ueber
-- **beide** Quellen: eine Note zaehlt in die Richtung, in die sie vom
-- eigenen Schnitt abweicht, eine Stimme in die ihres Daumens. "Weiss
-- nicht" und eine Note genau auf dem eigenen Schnitt haben keine
-- Richtung und bleiben draussen.
--
-- Aufgefallen am 02.09.2026 im Test zum Match-Wert: acht gedeckte
-- Kategorien und 46 Beobachtungen ergaben 39 von 100.
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
  with mein_schnitt as (
    select avg(rating)::numeric as mitte
    from public.diary_entries
    where user_id = (select auth.uid()) and rating is not null
  ),
  -- Dieselben Beitraege wie in taste_profile: Film, Gewicht, Richtung.
  beitraege as (
    select
      d.film_id,
      1.0::numeric as gewicht,
      greatest(-1.0, least(1.0, (d.rating - m.mitte) / 4.5)) as richtung
    from public.diary_entries d
    cross join mein_schnitt m
    where d.user_id = (select auth.uid())
      and d.rating is not null
      and m.mitte is not null

    union all

    select
      v.film_id,
      0.4::numeric,
      case v.verdict
        when 'like' then 0.8
        when 'dislike' then -0.8
        else 0.0
      end
    from public.taste_votes v
    where v.user_id = (select auth.uid())
  ),
  stimmen as (
    select count(*)::integer as anzahl
    from public.taste_votes
    where user_id = (select auth.uid())
  ),
  noten as (
    select count(*)::integer as anzahl
    from public.diary_entries
    where user_id = (select auth.uid()) and rating is not null
  ),
  je_kategorie as (
    select fc.category_id, sum(b.gewicht) as gewicht
    from beitraege b
    join public.film_categories fc on fc.film_id = b.film_id
    group by fc.category_id
  ),
  richtungen as (
    select
      sum(gewicht) filter (where richtung > 0) as dafuer,
      sum(gewicht) filter (where richtung < 0) as dagegen
    from beitraege
  ),
  teile as (
    select
      (select anzahl from stimmen) as stimmen,
      (select anzahl from noten) as noten,
      coalesce((select sum(gewicht) from je_kategorie), 0) as summe,
      coalesce((select count(*) from je_kategorie where gewicht >= 5), 0) as gedeckt,
      -- Ohne eine einzige gerichtete Beobachtung steht der Anteil
      -- neutral, statt das Ergebnis zu druecken.
      case
        when coalesce((select dafuer from richtungen), 0)
           + coalesce((select dagegen from richtungen), 0) = 0 then 0.5
        else (select dafuer from richtungen)
             / ((select dafuer from richtungen) + (select dagegen from richtungen))
      end as anteil
  ),
  werte as (
    select
      stimmen, noten, summe, gedeckt,
      least(1.0, gedeckt / 16.0) as abdeckung,
      least(1.0, summe / 80.0) as menge,
      4 * anteil * (1 - anteil) as streuung
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
  '(0,5), Menge (0,3) und Streuung (0,2). Die Streuung misst ueber beide '
  'Quellen — Noten nach ihrer Abweichung vom eigenen Schnitt, Stimmen '
  'nach ihrem Daumen. Tagebuchnote 1,0, Stimme aus dem Stapel 0,4.';

revoke execute on function public.taste_readiness() from public;
grant execute on function public.taste_readiness() to authenticated;
