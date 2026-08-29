-- Blockieren und geschlossene Diskussionen (M4 4.5, Moderation).
--
-- Zwei Dinge, die leicht verwechselt werden.
--
-- **Blockieren** macht jeder fuer sich. Ich blockiere jemanden, seine
-- Beitraege verschwinden **fuer mich**. Fuer alle anderen aendert sich
-- nichts. Das ist keine Moderationsentscheidung, sondern Selbstschutz —
-- und es nimmt der Moderation Meldungen ab, die keine sind. "Der Typ
-- nervt mich" ist kein Verstoss, aber ein echtes Beduerfnis.
--
-- **Thread sperren** macht die Moderation, und es wirkt fuer alle. Der
-- Streithahn kann nicht mehr schreiben und die dreissig anderen auch
-- nicht. Deshalb steht es nicht hier, sondern hinter der Edge Function.

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.blocks is
  'M4 4.5. Einseitig und still: der Blockierte erfaehrt es nicht, und '
  'fuer alle anderen aendert sich nichts.';

create index blocks_by_blocked on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- **Nur die eigenen Zeilen, auch beim Lesen.** Wer wen blockiert hat,
-- geht niemanden sonst etwas an — schon gar nicht den Blockierten.
create policy blocks_own_read on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy blocks_own_insert on public.blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy blocks_own_delete on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

/**
 * Hat der Aufrufer diesen Menschen blockiert?
 *
 * `security definer`, weil eine Policy auf `thread_messages`, die direkt
 * in `blocks` schaut, dort erneut auf RLS traefe. Dieselbe Bauart wie
 * `list_is_readable` und `is_moderator`.
 */
create or replace function public.blocks_me(autor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
     where b.blocker_id = (select auth.uid())
       and b.blocked_id = autor
  );
$$;

grant execute on function public.blocks_me(uuid) to authenticated;

-- --------------------------------------------------------------------
-- Wirkung in der Diskussion
-- --------------------------------------------------------------------
--
-- **Per Policy und nicht in der Anzeige.** Ein ausgeblendeter Beitrag
-- steht weiter im Quelltext; wer ihn nicht sehen will, soll ihn nicht
-- geschickt bekommen. Dieselbe Ueberlegung wie beim Spoiler-Gate
-- (ADR-010), auch wenn hier kein Geheimnis auf dem Spiel steht.
--
-- **Nur hier und nicht auf `diary_entries`.** Eine Sperre dort wuerde
-- durch `film_rating_summary` laufen und den Schnitt eines Films
-- veraendern, sobald ich jemanden blockiere. Blockieren soll Beitraege
-- verbergen, nicht Zahlen verschieben — Rezensionen filtert deshalb die
-- Abfrage, nicht die Policy.

alter policy discussion_read_gate on public.thread_messages
  using (
    is_removed = false
    and not public.blocks_me(thread_messages.user_id)
    and exists (
      select 1
      from public.diary_entries d
      where d.user_id = (select auth.uid())
        and d.film_id = thread_messages.film_id
        and d.rating is not null
    )
  );

-- --------------------------------------------------------------------
-- Geschlossene Diskussionen
-- --------------------------------------------------------------------
--
-- `is_locked` gibt es seit M0, und die Policies achten schon darauf:
-- gesperrt nimmt die Datenbank keine Beitraege mehr an, und auch das
-- Bearbeiten eigener faellt weg. Was fehlte, war der Grund.
--
-- Wer eine geschlossene Tuer sieht, soll wissen warum. Ohne das wirkt
-- eine Sperre wie ein Fehler.

alter table public.film_threads
  add column locked_at     timestamptz,
  add column locked_by     uuid references public.profiles(id) on delete set null,
  add column locked_reason text check (length(locked_reason) <= 500);

comment on column public.film_threads.locked_reason is
  'Steht auf der Filmseite. Eine Sperre ohne Begruendung sieht aus wie '
  'ein Fehler.';
