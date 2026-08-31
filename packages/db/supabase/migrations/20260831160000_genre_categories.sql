-- Feste Kategorien statt beliebiger Genres (Suchkonzept, 26).
--
-- Bisher wurde jedes Genre, das Wikidata an einem Film fuehrt, als
-- eigene Kategorie angelegt. Der Katalog kennt dadurch vierzig Genres,
-- darunter "Rueckblenden-Film" und "Stummfilm" — beides keine Genres,
-- sondern Machart. Die Kacheln auf Entdecken zeigen sechzehn davon,
-- weil es nur fuer sechzehn Bilder gibt; die uebrigen vierundzwanzig
-- sind eine Halde.
--
-- **Die Rohdaten bleiben.** Was Wikidata an einem Film fuehrt, wird
-- weiterhin in `film_genres` gespeichert — es ist die Herkunft, und wer
-- sie wegwirft, kann eine falsche Zuordnung spaeter nicht mehr
-- korrigieren. Dazu kommt nur eine Abbildung: jedes Genre zeigt auf
-- eine der sechzehn Kategorien, oder auf keine.
--
-- **Auf keine ist eine gueltige Antwort.** "Stummfilm" ist keine der
-- sechzehn und soll auch keine siebzehnte werden. Solche Genres
-- verschwinden aus den Kacheln und aus den Vorschlaegen, ohne dass die
-- Zeile verlorengeht.
--
-- Neue Genres, die ueber `lazy-film` hereinkommen, haben von selbst
-- keine Kategorie: `category_id` ist dann null. Damit erzeugt kein
-- fremder Begriff mehr eine Kategorie — genau das, was das Konzept
-- verlangt.

alter table public.genres
  add column is_category boolean not null default false,
  add column category_id text references public.genres (wikidata_id) on delete set null;

comment on column public.genres.is_category is
  'Eine der sechzehn festen Kategorien. Nur fuer diese gibt es Kacheln.';
comment on column public.genres.category_id is
  'Auf welche Kategorie dieses Genre abgebildet wird. Null heisst: auf '
  'keine, und das ist eine Antwort und kein fehlender Eintrag.';

-- Die sechzehn. Sie zeigen auf sich selbst, damit die Abbildung eine
-- einzige Regel hat und nicht zwei Faelle.
update public.genres
   set is_category = true,
       category_id = wikidata_id
 where wikidata_id in (
   'Q130232',     -- Filmdrama
   'Q157443',     -- Filmkomoedie
   'Q157394',     -- Fantasyfilm
   'Q2484376',    -- Thriller
   'Q319221',     -- Abenteuerfilm
   'Q188473',     -- Actionfilm
   'Q959790',     -- Kriminalfilm
   'Q471839',     -- Science-Fiction-Film
   'Q842256',     -- Musikfilm
   'Q102429885',  -- Coming-of-Age-Film
   'Q200092',     -- Horrorfilm
   'Q1200678',    -- Mysteryfilm
   'Q1054574',    -- Liebesfilm
   'Q652256',     -- Monumentalfilm
   'Q93204',      -- Dokumentarfilm
   'Q859369'      -- Dramedy
 );

-- Die Abbildung. Jede Zeile ist eine Entscheidung, keine Ableitung —
-- deshalb steht der Grund daneben, wo er nicht offensichtlich ist.
update public.genres g
   set category_id = z.ziel
  from (values
    -- Eindeutig: eine engere Form derselben Sache.
    ('Q19367312',  'Q2484376'),   -- Krimi-Thriller     -> Thriller
    ('Q11304653',  'Q2484376'),   -- spannender Film    -> Thriller
    ('Q113485322', 'Q959790'),    -- Krimidrama         -> Kriminalfilm
    ('Q7444356',   'Q959790'),    -- Gangsterfilm       -> Kriminalfilm
    ('Q185867',    'Q959790'),    -- Film noir          -> Kriminalfilm
    ('Q2421031',   'Q959790'),    -- Neo-Noir           -> Kriminalfilm
    ('Q108084492', 'Q471839'),    -- Arthaus-SF         -> Science-Fiction
    ('Q20443008',  'Q471839'),    -- Dystopiefilm       -> Science-Fiction
    ('Q1341051',   'Q471839'),    -- Endzeitfilm        -> Science-Fiction
    ('Q174526',    'Q471839'),    -- Cyberpunk          -> Science-Fiction
    ('Q1957385',   'Q157394'),    -- Maerchenfilm       -> Fantasyfilm
    ('Q118612349', 'Q157443'),    -- Romantische Komoedie -> Filmkomoedie
    ('Q663106',    'Q157443'),    -- Buddy-Film         -> Filmkomoedie
    ('Q63214877',  'Q130232'),    -- Psychodrama        -> Filmdrama
    ('Q645928',    'Q130232'),    -- Filmbiografie      -> Filmdrama
    ('Q17013749',  'Q652256'),    -- Historienfilm      -> Monumentalfilm

    -- Abwaegungen. Sie koennten auch anders ausfallen und stehen
    -- deshalb hier, wo man sie findet und mit einem UPDATE aendert:
    --
    -- LGBT-Film ist kein Erzaehlmuster, sondern ein Thema. Von den
    -- sechzehn traegt Filmdrama es am ehesten.
    ('Q20442589',  'Q130232'),
    -- Kriegsfilm: Actionfilm waere die andere Lesart. Filmdrama, weil
    -- die Filme im Katalog erzaehlen und nicht zeigen.
    ('Q369747',    'Q130232'),
    -- Sciencefiction-Horrorfilm traegt beides. Horror ist das, wonach
    -- jemand sucht, der ihn sucht.
    ('Q10663882',  'Q200092')
  ) as z(quelle, ziel)
 where g.wikidata_id = z.quelle;

-- Ausdruecklich **ohne** Kategorie. Das ist eine Entscheidung und kein
-- vergessener Eintrag:
--
--   Familienfilm, Kinderfilm  Zielgruppe, kein Genre
--   Stummfilm                 Machart
--   Rueckblenden-Film         Erzaehlmittel
--   Weihnachtsfilm            Anlass
--
-- Sie bleiben als Genre am Film stehen und tauchen nur nicht mehr als
-- Kategorie auf.

-- --------------------------------------------------------------------
-- Die Regel, dass eine Abbildung auf eine Kategorie zeigt
-- --------------------------------------------------------------------
--
-- Ein Fremdschluessel allein reicht nicht: er verlangt nur, dass die
-- Zeile existiert, nicht dass sie eine Kategorie ist. Ohne diese
-- Pruefung koennte "Neo-Noir" auf "Film noir" zeigen, und die Kacheln
-- haetten siebzehn Eintraege, von denen einer kein Bild hat.

create or replace function public.genre_category_must_be_one()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is null then
    return new;
  end if;

  -- Eine Kategorie zeigt auf sich selbst.
  if new.is_category and new.category_id = new.wikidata_id then
    return new;
  end if;

  if not exists (
    select 1 from public.genres g
     where g.wikidata_id = new.category_id and g.is_category
  ) then
    raise exception 'category_id % is not one of the categories', new.category_id;
  end if;

  return new;
end;
$$;

create trigger genres_category_is_a_category
  before insert or update on public.genres
  for each row execute function public.genre_category_must_be_one();

create index genres_category_idx on public.genres (category_id)
  where category_id is not null;

-- --------------------------------------------------------------------
-- Filme und ihre Kategorien
-- --------------------------------------------------------------------
--
-- Distinct, weil ein Film ueber mehrere Genres auf dieselbe Kategorie
-- zeigen kann: "Krimidrama" und "Neo-Noir" landen beide bei
-- Kriminalfilm, und der Film soll darum nicht zweimal darunter stehen.

create or replace view public.film_categories
with (security_invoker = true)
as
select distinct fg.film_id, g.category_id
from public.film_genres fg
join public.genres g on g.wikidata_id = fg.genre_id
where g.category_id is not null;

comment on view public.film_categories is
  'Filme, abgebildet auf die sechzehn Kategorien. Die Rohzuordnung steht '
  'weiterhin in film_genres.';

grant select on public.film_categories to anon, authenticated;

-- --------------------------------------------------------------------
-- Was die Kacheln zeigen
-- --------------------------------------------------------------------

create or replace function public.genre_tiles(max_results integer default 20)
returns table (
  genre_id text,
  label    text,
  films    integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.wikidata_id,
    coalesce(g.label_de, g.label_en) as label,
    count(*)::integer                as films
  from public.film_categories fc
  join public.genres g on g.wikidata_id = fc.category_id
  where g.is_category
    and coalesce(g.label_de, g.label_en) is not null
  group by g.wikidata_id, 2
  having count(*) >= 3
  order by count(*) desc, 2
  limit greatest(1, least(max_results, 40));
$$;

comment on function public.genre_tiles(integer) is
  'M4 4.4, auf Kategorien umgestellt (Suchkonzept 26). Nur die sechzehn '
  'festen Kategorien, ab drei Filmen. Ein fremdes Genre erzeugt keine '
  'Kachel mehr.';

grant execute on function public.genre_tiles(integer) to anon, authenticated;

-- Und die Vorschlaege ebenso: der Geschmack wird ueber Kategorien
-- gemessen, sonst zaehlt "Neo-Noir" neben "Kriminalfilm" doppelt.

create or replace function public.films_for_me(max_results integer default 12)
returns table (
  wikidata_id    text,
  title_de       text,
  title_original text,
  release_year   integer,
  poster_source  text,
  poster_url     text,
  weight         integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with liked as (
    select d.film_id
    from public.diary_entries d
    where d.user_id = (select auth.uid())
      and d.rating >= 7
  ),
  taste as (
    select fc.category_id, count(*)::integer as weight
    from public.film_categories fc
    join liked l on l.film_id = fc.film_id
    group by fc.category_id
  ),
  seen as (
    select d.film_id from public.diary_entries d where d.user_id = (select auth.uid())
  ),
  candidates as (
    select fc.film_id, sum(t.weight)::integer as weight
    from public.film_categories fc
    join taste t on t.category_id = fc.category_id
    where fc.film_id not in (select film_id from seen)
    group by fc.film_id
  )
  select
    f.wikidata_id, f.title_de, f.title_original, f.release_year,
    f.poster_source, f.poster_url, c.weight
  from candidates c
  join public.films f on f.wikidata_id = c.film_id
  order by c.weight desc, f.sitelink_count desc, f.wikidata_id
  limit greatest(1, least(max_results, 40));
$$;

revoke execute on function public.films_for_me(integer) from public;
grant execute on function public.films_for_me(integer) to authenticated;
