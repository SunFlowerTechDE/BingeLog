-- Die Zahlen fuer das Dashboard (M4 4.7).
--
-- **Security definer mit Tuersteher.** Die Funktion zaehlt ueber alle
-- Nutzer hinweg und muss dafuer an der RLS vorbei — sonst zaehlte sie
-- nur, was der Aufrufer ohnehin sieht, und das waere bei einem Fremden
-- fast nichts.
--
-- Genau deshalb steht die Pruefung **in** der Funktion und nicht davor:
-- eine `security definer`-Funktion, die Mitgliederzahlen zurueckgibt,
-- ist ohne diese erste Zeile ein Leck, das niemandem auffaellt.
--
-- Was gezaehlt wird und warum:
--
-- Summen schmeicheln, Zuwaechse sagen etwas. Deshalb steht neben jeder
-- Gesamtzahl, was in den letzten sieben Tagen dazugekommen ist. Eine
-- Mitgliederzahl, die steigt, waehrend die Eintraege stehen bleiben,
-- sieht auf einer Kachel gut aus und ist ein Alarm.
--
-- Die wichtigste Zahl ist `active_7d`: Leute, die in den letzten sieben
-- Tagen etwas eingetragen haben. Anmeldungen sind Neugier, Eintraege
-- sind Nutzung. ADR-009 nennt das Eintragen die wichtigste
-- Retention-Kennzahl — hier ist sie.
--
-- `dormant` ist die Gegenprobe: Konten, die nie einen Eintrag gemacht
-- haben. Das ist das Leck im Trichter, und es steht bewusst neben der
-- Mitgliederzahl.

create or replace function public.admin_overview()
returns table (
  members        integer,
  members_7d     integer,
  dormant        integer,
  films          integer,
  films_7d       integer,
  entries        integer,
  entries_7d     integer,
  active_7d      integer,
  reviews        integer,
  lists          integer,
  open_threads   integer,
  open_reports   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles)::integer,
    (select count(*) from public.profiles
      where created_at > now() - interval '7 days')::integer,
    (select count(*) from public.profiles p
      where not exists (select 1 from public.diary_entries d where d.user_id = p.id))::integer,

    (select count(*) from public.films)::integer,
    (select count(*) from public.films
      where updated_at > now() - interval '7 days')::integer,

    (select count(*) from public.diary_entries)::integer,
    (select count(*) from public.diary_entries
      where created_at > now() - interval '7 days')::integer,
    (select count(distinct user_id) from public.diary_entries
      where created_at > now() - interval '7 days')::integer,

    (select count(*) from public.diary_entries
      where review is not null and length(btrim(review)) > 0)::integer,
    (select count(*) from public.lists)::integer,
    (select count(*) from public.film_threads where is_active)::integer,
    (select count(*) from public.reports where status in ('open', 'in_progress'))::integer
  where public.is_moderator();
$$;

comment on function public.admin_overview() is
  'M4 4.7. Security definer — zaehlt an der RLS vorbei, deshalb die '
  'is_moderator()-Bedingung in der Abfrage selbst. Ohne sie waere das '
  'ein Leck, das niemandem auffiele.';

grant execute on function public.admin_overview() to authenticated;
