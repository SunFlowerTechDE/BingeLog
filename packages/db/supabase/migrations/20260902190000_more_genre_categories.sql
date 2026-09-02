-- Mehr Rohgenres auf die sechzehn Kategorien abbilden.
--
-- Gemessen am 02.09.2026: 85 Rohgenres im Katalog zeigen auf keine
-- Kategorie, und 17 echte Filme haben deshalb gar keine. Ohne Kategorie
-- bekommt ein Film nie einen Match-Wert, taucht in keinem Genrefilter
-- auf und taugt nicht als Karte im Geschmackscheck.
--
-- **Es bleiben sechzehn Kategorien.** Hier entsteht keine neue; es
-- zeigen nur mehr Genres auf die vorhandenen (`genres.category_id`, der
-- Trigger `genre_category_must_be_one` besteht darauf).
--
-- **Die Regel ist das Grundwort.** Bei einem deutschen Kompositum
-- entscheidet der letzte Teil: "Actionthriller" ist ein Thriller,
-- "Actionkomoedie" eine Komoedie, "Horrorkomoedie" ebenfalls. Das ist
-- nicht in jedem Einzelfall die schoenste Antwort — eine Horrorkomoedie
-- ist beides —, aber es ist eine Regel, die jeder nachvollziehen und
-- fortsetzen kann. Nach Gefuehl zugeordnet waere die Liste beim
-- naechsten Nachtrag schon widersprüchlich.

-- --------------------------------------------------------------- Horror

update public.genres set category_id = 'Q200092' where wikidata_id in (
  'Q2137852',    -- Vampirfilm
  'Q5258881',    -- Werwolffilm
  'Q1342372',    -- Monsterfilm
  'Q3072049',    -- Zombiefilm
  'Q853630',     -- Slasher-Film
  'Q102260466',  -- Koerper-Horrorfilm
  'Q109626272',  -- natuerlicher Horrorfilm
  'Q109629396',  -- psychologischer Horrorfilm
  'Q43911809'    -- Uebernatuerlicher Horrorfilm
);

-- ---------------------------------------------------------------- Krimi

update public.genres set category_id = 'Q959790' where wikidata_id in (
  'Q496523',     -- Heist-Movie
  'Q3072039',    -- Gerichtsfilm
  'Q109733630',  -- police procedural film
  'Q4984974',    -- Buddy-Cop-Film
  'Q25533274',   -- Detektivfilm
  'Q586250'      -- Gefaengnisfilm
);

-- -------------------------------------------------------------- Komoedie

update public.genres set category_id = 'Q157443' where wikidata_id in (
  'Q5778924',    -- Schwarze Komoedie
  'Q53094',      -- schwarzer Humor
  'Q2678111',    -- Actionkomoedie
  'Q1788980',    -- Kriminalkomoedie
  'Q224700',     -- Horrorkomoedie
  'Q761469',     -- Science-Fiction-Comedy
  'Q860626',     -- romantische Komoedie
  'Q622548',     -- Filmparodie
  'Q624771'      -- Slapstick
);

-- ---------------------------------------------------------------- Drama

update public.genres set category_id = 'Q130232' where wikidata_id in (
  'Q1919632',    -- Melodram
  'Q191489',     -- Melodram (zweiter Eintrag bei Wikidata)
  'Q116514801',  -- historisches Filmdrama
  'Q7168625',    -- historisches Drama
  'Q116456802',  -- war drama
  'Q4774498'     -- Anti-Kriegsfilm
);

update public.genres set category_id = 'Q859369' where wikidata_id in (
  'Q192881'      -- Tragikomoedie
);

-- --------------------------------------------------------------- Thriller

update public.genres set category_id = 'Q2484376' where wikidata_id in (
  'Q3990883',    -- Actionthriller
  'Q109733304',  -- psychological thriller film
  'Q590103',     -- Psychothriller
  'Q2439025',    -- Erotik-Thriller
  'Q109733294',  -- erotic thriller film
  'Q109733333',  -- Politthrillerfilm
  'Q580850'      -- Techno-Thriller
);

-- ---------------------------------------------------------------- Action

update public.genres set category_id = 'Q188473' where wikidata_id in (
  'Q1535153',    -- Superheldenfilm
  'Q20656232',   -- Science-Fiction-Action-Film
  'Q1033891',    -- Martial-Arts-Film
  'Q3072042',    -- Kung-Fu-Film
  'Q2642760',    -- Buergerwehrfilm
  'Q16538713',   -- chase film
  'Q2297927'     -- Agentenfilm
);

-- -------------------------------------------------------- Science-Fiction

update public.genres set category_id = 'Q471839' where wikidata_id in (
  'Q104765957',  -- Zeitreisefilm
  'Q468478',     -- Space Opera
  'Q904447',     -- Military-Science-Fiction
  'Q2447078',    -- Invasion durch Ausserirdische
  'Q116778237'   -- tech-noir film
);

-- -------------------------------------------------------------- Abenteuer

update public.genres set category_id = 'Q319221' where wikidata_id in (
  'Q222639',     -- Mantel-und-Degen-Film
  'Q2096633',    -- Piratenfilm
  'Q22981906',   -- Schatzsuchefilm
  'Q66914288',   -- Weltraumabenteuer
  'Q15898171'    -- Survival-Film
);

-- ---------------------------------------------------------------- Fantasy

update public.genres set category_id = 'Q157394' where wikidata_id in (
  'Q1637212',    -- humoristische Fantasy
  'Q15637301',   -- Fantasy-Manga und -Anime
  'Q53911753',   -- Isekai
  'Q104623124'   -- supernatural anime
);

-- ------------------------------------------------------------------ Rest

update public.genres set category_id = 'Q842256' where wikidata_id = 'Q2743';        -- Musical
update public.genres set category_id = 'Q93204'  where wikidata_id = 'Q121742706';   -- Kurz-Dokumentarfilm
update public.genres set category_id = 'Q652256' where wikidata_id = 'Q1433443';     -- Sandalenfilm
update public.genres set category_id = 'Q102429885' where wikidata_id = 'Q127739154'; -- teen drama film

-- --------------------------------------------------------------------
-- Was ausdruecklich **keine** Kategorie bekommt
-- --------------------------------------------------------------------
--
-- Nicht aus Nachlaessigkeit, sondern weil es keine Genres in dem Sinn
-- sind, in dem die sechzehn Kategorien welche sind:
--
--   Machart      Stummfilm, Zeichentrickfilm, Mischfilm, Avantgardefilm,
--                Kunstfilm, Independent-Film
--   Erzaehlmittel Rueckblenden-Film, Roadmovie, Spekulativer Spielfilm
--   Publikum     Familienfilm, Kinderfilm, Jugendfilm
--   Anlass       Weihnachtsfilm
--   Sujet        Boxerfilm, Amerikanischer Footballfilm, Katastrophenfilm,
--                Propagandafilm, Lesbenfilm, white savior film
--
-- Sie einer der sechzehn zuzuschlagen hiesse, eine Aussage zu treffen,
-- die niemand gemeint hat: ein Familienfilm ist kein Abenteuerfilm, er
-- ist ein Film fuer die Familie. Bleiben sie ohne Kategorie, faellt der
-- Film nicht heraus — er wird nur ueber seine anderen Genres eingeordnet.

comment on column public.genres.category_id is
  'Auf welche der sechzehn Kategorien dieses Genre abgebildet wird, oder '
  'null. Bei Komposita entscheidet das Grundwort: Actionthriller ist ein '
  'Thriller. Machart, Erzaehlmittel, Publikum und Sujet bekommen keine — '
  'ein Familienfilm ist kein Abenteuerfilm.';
