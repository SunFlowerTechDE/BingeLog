-- Filme aus einem Import zuordnen (M5).
--
-- **Der Letterboxd-Export fuehrt keine TMDb- und keine IMDb-Nummer.**
-- Er nennt Titel, Jahr und eine eigene Kurzadresse (boxd.it). Die
-- Konzeptvorgabe "eindeutiger externer Identifier hat Vorrang vor einem
-- Textvergleich" laesst sich damit nicht erfuellen — es gibt keinen.
-- Also Titel und Jahr, und zwar sorgfaeltig:
--
--   1. Titel **und** Jahr stimmen ueberein  -> sicher
--   2. Titel stimmt, das Jahr liegt ein Jahr daneben -> sicher genug
--      (Kinostart und Festivaljahr gehen bei Wikidata auseinander)
--   3. Titel stimmt, mehrere Jahre kommen in Frage -> Rueckfrage
--   4. sonst kein Treffer
--
-- Verglichen wird ueber alle drei Titelfelder und in normalisierter
-- Form: Kleinschreibung, ohne Satzzeichen, ohne fuehrenden Artikel.
-- "The Godfather" und "Godfather, The" sind derselbe Film.

create or replace function public.normalise_title(text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Der Reihe nach: kleinschreiben, Satzzeichen zu Leerzeichen,
  -- Leerzeichen verdichten, den Artikel hinten weg, den Artikel vorn
  -- weg, trimmen.
  --
  -- Beide Richtungen, weil Kataloge beide Formen fuehren: "Der Pate"
  -- und "Pate, Der" sind derselbe Film. Erst hinten, dann vorn — sonst
  -- bliebe bei "Pate, Der" der Artikel stehen.
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce($1, '')), '[^a-z0-9äöüß ]+', ' ', 'g'),
            ' +', ' ', 'g'
          ),
          ' (the|a|an|der|die|das)$', ''
        ),
        '^(the|a|an|der|die|das) ', ''
      ),
      ' +', ' ', 'g'
    )
  );
$$;

comment on function public.normalise_title(text) is
  'Kleinschreibung, ohne Satzzeichen, ohne Artikel — vorn wie hinten, denn '
  '"Der Pate" und "Pate, Der" sind derselbe Film. Fuer den Abgleich beim '
  'Import, nicht fuer die Suche: die hat ihre eigene Rangfolge.';

create index films_normalised_de_idx on public.films (public.normalise_title(title_de));
create index films_normalised_original_idx
  on public.films (public.normalise_title(title_original));
create index films_normalised_en_idx on public.films (public.normalise_title(title_en));

-- --------------------------------------------------------------------
-- Der Abgleich, gesammelt
-- --------------------------------------------------------------------
--
-- Eine Anfrage fuer tausend Zeilen, nicht tausend Anfragen. Das ist die
-- Leistungsvorgabe des Konzepts ("bereits vorhandene Filme moeglichst
-- gesammelt laden"), und bei 8000 Filmen ist sie der Unterschied
-- zwischen Minuten und Stunden.

create or replace function public.match_import_titles(rows jsonb)
returns table (
  idx       integer,
  film_id   text,
  certainty text   -- 'exact', 'near', 'ambiguous'
)
language sql
stable
security definer
set search_path = ''
as $$
  with eingaben as (
    select
      (r.ord - 1)::integer                       as idx,
      public.normalise_title(r.value->>'title')  as title,
      nullif(r.value->>'year', '')::integer      as year
    from jsonb_array_elements(rows) with ordinality r(value, ord)
  ),
  treffer as (
    select
      e.idx,
      f.wikidata_id,
      e.year,
      f.release_year,
      -- Genau das Jahr, oder eins daneben. Weiter nicht: "Halloween
      -- 1978" und "Halloween 2018" sind verschiedene Filme.
      case
        when e.year is null then 'near'
        when f.release_year = e.year then 'exact'
        when abs(f.release_year - e.year) <= 1 then 'near'
        else null
      end as guete
    from eingaben e
    join public.films f
      on public.normalise_title(f.title_de) = e.title
      or public.normalise_title(f.title_original) = e.title
      or public.normalise_title(f.title_en) = e.title
  ),
  gewertet as (
    select t.idx, t.wikidata_id, t.guete
    from treffer t
    where t.guete is not null
  )
  select
    g.idx,
    -- Bei mehreren Treffern derselben Guete gibt es keinen: dann muss
    -- der Nutzer entscheiden. Lieber eine Rueckfrage als der falsche
    -- Film in einem fremden Tagebuch.
    (array_agg(g.wikidata_id order by g.guete, g.wikidata_id))[1] as film_id,
    case
      when count(*) filter (where g.guete = 'exact') = 1 then 'exact'
      when count(*) filter (where g.guete = 'exact') > 1 then 'ambiguous'
      when count(*) = 1 then 'near'
      else 'ambiguous'
    end as certainty
  from gewertet g
  group by g.idx;
$$;

comment on function public.match_import_titles(jsonb) is
  'Ordnet eine Liste aus {title, year} gesammelt Filmen zu. Der '
  'Letterboxd-Export fuehrt keine externe Film-Id, deshalb ueber '
  'normalisierte Titel und das Jahr. Mehrere gleich gute Treffer ergeben '
  'ambiguous — lieber eine Rueckfrage als der falsche Film in einem '
  'fremden Tagebuch. Security definer, weil sie nur den Katalog liest, '
  'der ohnehin oeffentlich ist.';

revoke execute on function public.match_import_titles(jsonb) from public;
grant execute on function public.match_import_titles(jsonb) to authenticated, service_role;
