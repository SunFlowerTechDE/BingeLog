-- M3 3.1 — username rules.
--
-- The first migration allowed 3 to 24 characters; the milestone asks for
-- 3 to 20. Narrowing a constraint is safe here because no profile exists
-- yet, and it is worth doing now: a username appears in a URL and in
-- every mention, and shortening the limit later would break both.
--
-- Case-insensitive uniqueness needs no extra index. The pattern admits
-- lowercase only, so two names that differ in case cannot both exist.

alter table public.profiles
  drop constraint if exists profiles_username_check;

alter table public.profiles
  add constraint profiles_username_check
  check (username ~ '^[a-z0-9_]{3,20}$');

-- ---------------------------------------------------------------------------
-- Reserved names.
--
-- A table rather than a constraint, so the list can grow without a
-- migration, and a trigger rather than a check, because a check cannot
-- consult another table.
-- ---------------------------------------------------------------------------

create table public.reserved_usernames (
  username text primary key,
  reason   text not null
);

comment on table public.reserved_usernames is
  'Names that must not become profiles: route segments that would collide '
  'with a profile URL, and identities that would let someone pass as the '
  'service.';

insert into public.reserved_usernames (username, reason) values
  -- Route segments. A profile at /<username> collides with these.
  ('anmelden', 'route'), ('abmelden', 'route'), ('registrieren', 'route'),
  ('einstellungen', 'route'), ('profil', 'route'), ('konto', 'route'),
  ('suche', 'route'), ('suchen', 'route'), ('film', 'route'), ('filme', 'route'),
  ('liste', 'route'), ('listen', 'route'), ('tagebuch', 'route'),
  ('watchlist', 'route'), ('feed', 'route'), ('kino', 'route'),
  ('impressum', 'route'), ('datenschutz', 'route'), ('agb', 'route'),
  ('hilfe', 'route'), ('kontakt', 'route'), ('ueber', 'route'),
  ('api', 'route'), ('auth', 'route'), ('login', 'route'), ('logout', 'route'),
  ('signup', 'route'), ('settings', 'route'), ('search', 'route'),
  ('about', 'route'), ('help', 'route'), ('poster', 'route'),
  ('new', 'route'), ('neu', 'route'), ('edit', 'route'), ('bearbeiten', 'route'),
  -- Identities that would let someone pass as the service or its staff.
  ('admin', 'impersonation'), ('administrator', 'impersonation'),
  ('moderator', 'impersonation'), ('mod', 'impersonation'),
  ('support', 'impersonation'), ('team', 'impersonation'),
  ('staff', 'impersonation'), ('system', 'impersonation'),
  ('root', 'impersonation'), ('official', 'impersonation'),
  ('bingelog', 'brand'), ('sunflower', 'brand'), ('sunflowertech', 'brand'),
  -- Values that read as an absent value in a URL or a log line.
  ('null', 'reserved'), ('undefined', 'reserved'), ('nan', 'reserved'),
  ('me', 'reserved'), ('ich', 'reserved'), ('you', 'reserved'),
  ('anonymous', 'reserved'), ('anonym', 'reserved'), ('deleted', 'reserved'),
  ('geloescht', 'reserved');

alter table public.reserved_usernames enable row level security;

-- Readable so the sign-up form can say why a name is unavailable before
-- the round trip. There is nothing sensitive in the list.
create policy reserved_usernames_public_read on public.reserved_usernames
  for select to anon, authenticated using (true);

create or replace function public.reject_reserved_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.reserved_usernames r where r.username = new.username) then
    raise exception 'username_reserved'
      using hint = 'This username is reserved.', errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_reject_reserved_username
  before insert or update of username on public.profiles
  for each row execute function public.reject_reserved_username();

-- ---------------------------------------------------------------------------
-- Availability check for the sign-up form.
--
-- A function rather than a select, so the form never needs to read the
-- profiles table to find out that a name is taken, and so the answer is
-- the same one the insert would give.
-- ---------------------------------------------------------------------------

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.reserved_usernames r where r.username = candidate)
     and not exists (select 1 from public.profiles p where p.username = candidate);
$$;

grant execute on function public.username_available(text) to anon, authenticated;
