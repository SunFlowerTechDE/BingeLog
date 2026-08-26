-- M0 0.4c — Film discussion with the spoiler gate (ADR-010, ADR-011).
--
-- This is the security-critical part of the whole project. The gate lives
-- here and nowhere else: not in the UI, not in the API layer, not in the
-- client. A hidden component is not spoiler protection.
--
-- What the gate does: it reliably prevents accidental spoilers, the case
-- where someone lands on a film page and reads the ending while scrolling.
-- What it does not do: stop deliberate circumvention. Anyone can mark a
-- film watched and rate it in three seconds. That is accepted, and the UI
-- says "visible once you have rated it", never "guaranteed spoiler-free".

-- ---------------------------------------------------------------------------
-- film_threads — one row per film, created lazily once people log the film.
-- ---------------------------------------------------------------------------

create table public.film_threads (
  film_id          text primary key references public.films (wikidata_id) on delete cascade,
  message_count    integer not null default 0 check (message_count >= 0),
  viewer_count     integer not null default 0 check (viewer_count >= 0),
  is_active        boolean not null default false,
  is_locked        boolean not null default false,
  last_activity_at timestamptz
);

comment on column public.film_threads.viewer_count is
  'Distinct users with at least one diary entry for this film.';
comment on column public.film_threads.is_active is
  'Latches to true at viewer_count >= 5 and never goes back. Below the '
  'threshold no thread is created at all: 350k empty rooms are worse than '
  'no rooms (ADR-010).';

alter table public.film_threads enable row level security;

-- Thread metadata carries no spoiler. The messages are gated, the counter
-- is not, and the UI needs it to decide what to offer.
create policy film_threads_public_read on public.film_threads
  for select to anon, authenticated using (true);

-- No write policies: only triggers and the service role touch this table.

-- ---------------------------------------------------------------------------
-- thread_messages
-- ---------------------------------------------------------------------------

create table public.thread_messages (
  id         uuid primary key default gen_random_uuid(),
  film_id    text not null references public.films (wikidata_id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  is_removed boolean not null default false,

  -- A reply can only answer a message about the same film.
  unique (id, film_id),
  foreign key (parent_id, film_id)
    references public.thread_messages (id, film_id) on delete cascade
);

create index thread_film_idx on public.thread_messages (film_id, created_at desc);
create index thread_parent_idx on public.thread_messages (parent_id);
create index thread_user_recent_idx on public.thread_messages (user_id, created_at desc);

alter table public.thread_messages enable row level security;

-- --- The spoiler gate ------------------------------------------------------

-- Read: only with an own, rated entry for the same film.
create policy discussion_read_gate on public.thread_messages
  for select to authenticated
  using (
    is_removed = false
    and exists (
      select 1
      from public.diary_entries d
      where d.user_id = (select auth.uid())
        and d.film_id = thread_messages.film_id
        and d.rating is not null
    )
  );

-- Note the absence of a policy for anon. Anonymous visitors get zero rows,
-- because a command without a matching policy is denied outright.

-- Write: same condition, plus the thread must be active and unlocked.
create policy discussion_write_gate on public.thread_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and is_removed = false
    and exists (
      select 1
      from public.diary_entries d
      where d.user_id = (select auth.uid())
        and d.film_id = thread_messages.film_id
        and d.rating is not null
    )
    and exists (
      select 1
      from public.film_threads t
      where t.film_id = thread_messages.film_id
        and t.is_active = true
        and t.is_locked = false
    )
  );

-- Edit and delete: own messages only, and not in a locked thread.
create policy discussion_own_update on public.thread_messages
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and not exists (
      select 1
      from public.film_threads t
      where t.film_id = thread_messages.film_id
        and t.is_locked = true
    )
  );

create policy discussion_own_delete on public.thread_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- viewer_count and thread activation, driven off diary_entries.
--
-- A user can log the same film many times (rewatches), so the counter
-- tracks distinct users, not entries.
-- ---------------------------------------------------------------------------

create or replace function public.sync_thread_viewer_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_film text;
  affected_user uuid;
  remaining     integer;
begin
  -- Old side: only relevant when the entry disappears from a (film, user)
  -- pairing, i.e. on delete or when film_id/user_id actually changed.
  -- This runs after the row change, so the remaining rows are the truth.
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE'
         and (old.film_id is distinct from new.film_id
              or old.user_id is distinct from new.user_id)) then
    affected_film := old.film_id;
    affected_user := old.user_id;

    select count(*) into remaining
    from public.diary_entries d
    where d.film_id = affected_film
      and d.user_id = affected_user;

    if remaining = 0 then
      update public.film_threads
      set viewer_count = greatest(viewer_count - 1, 0)
      where film_id = affected_film;
    end if;
  end if;

  -- New side: an unchanged update must not count the user twice, so the
  -- increment is limited to inserts and to genuine reassignments.
  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE'
         and (old.film_id is distinct from new.film_id
              or old.user_id is distinct from new.user_id)) then
    affected_film := new.film_id;
    affected_user := new.user_id;

    -- Entries other than this one. Zero means the user is new to this
    -- film and the counter goes up.
    select count(*) into remaining
    from public.diary_entries d
    where d.film_id = affected_film
      and d.user_id = affected_user
      and d.id <> new.id;

    if remaining = 0 then
      insert into public.film_threads (film_id, viewer_count)
      values (affected_film, 1)
      on conflict (film_id) do update
        set viewer_count = public.film_threads.viewer_count + 1;

      -- Activation latches on. It never flips back, because a thread with
      -- messages must not disappear when someone deletes their entry.
      update public.film_threads
      set is_active = true
      where film_id = affected_film
        and viewer_count >= 5
        and is_active = false;
    end if;
  end if;

  return null;
end;
$$;

create trigger diary_entries_sync_viewer_count
  after insert or update or delete on public.diary_entries
  for each row execute function public.sync_thread_viewer_count();

-- ---------------------------------------------------------------------------
-- message_count and last_activity_at.
-- ---------------------------------------------------------------------------

create or replace function public.sync_thread_message_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.film_threads
    set message_count    = message_count + 1,
        last_activity_at = new.created_at
    where film_id = new.film_id;
  elsif tg_op = 'DELETE' then
    update public.film_threads
    set message_count = greatest(message_count - 1, 0)
    where film_id = old.film_id;
  elsif old.is_removed = false and new.is_removed = true then
    update public.film_threads
    set message_count = greatest(message_count - 1, 0)
    where film_id = new.film_id;
  elsif old.is_removed = true and new.is_removed = false then
    update public.film_threads
    set message_count = message_count + 1
    where film_id = new.film_id;
  end if;

  return null;
end;
$$;

create trigger thread_messages_sync_stats
  after insert or update or delete on public.thread_messages
  for each row execute function public.sync_thread_message_stats();

-- ---------------------------------------------------------------------------
-- Rate limit: 10 messages per user per hour.
--
-- A trigger, not an RLS policy. A policy on thread_messages that counts
-- thread_messages would recurse through its own read gate; a trigger runs
-- as the table owner and sees the true count.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  select count(*) into recent
  from public.thread_messages m
  where m.user_id = new.user_id
    and m.created_at > now() - interval '1 hour';

  if recent >= 10 then
    raise exception 'rate_limit_exceeded'
      using hint = 'Maximum 10 messages per user per hour.',
            errcode = '53400';
  end if;

  return new;
end;
$$;

create trigger thread_messages_rate_limit
  before insert on public.thread_messages
  for each row execute function public.enforce_message_rate_limit();

-- ---------------------------------------------------------------------------
-- edited_at, set server-side so a client cannot lie about it.
-- ---------------------------------------------------------------------------

create or replace function public.set_message_edited_at()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at = now();
  end if;
  -- Ownership and film assignment are immutable.
  new.user_id = old.user_id;
  new.film_id = old.film_id;
  new.created_at = old.created_at;
  return new;
end;
$$;

create trigger thread_messages_set_edited_at
  before update on public.thread_messages
  for each row execute function public.set_message_edited_at();
