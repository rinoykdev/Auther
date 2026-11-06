-- =============================================================================
-- 0001 — profiles, user_roles, the new-user trigger, GRANTs and RLS
-- =============================================================================
-- ONE migration carrying schema, automation and BOTH gates, per architecture
-- checklist item 14. Splitting these across files is how a table ships with a
-- gate missing.
--
-- Gate 1 = PostgreSQL GRANTs: may this role touch the table at all?
-- Gate 2 = RLS policies:       which rows?
-- A request must pass both (E.4). Gate 1 is the stronger of the two, because a
-- privilege never granted cannot be defeated by a policy written wrong.
--
-- This file is immutable once applied anywhere. A correction is a NEW
-- migration — editing an applied file is how the CI reconstruction and the
-- cloud project silently diverge (plan §8).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Roles enum
-- -----------------------------------------------------------------------------
-- An enum, not free text: a typo'd 'amdin' is then a database error at write
-- time rather than a user who silently holds no role at all.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('user', 'admin');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2. profiles (D.2)
-- -----------------------------------------------------------------------------
-- Deliberately ABSENT, and asserted absent by 010_schema.sql:
--   * email, or any column mirrored from auth.users — a convenience copy turns
--     any future "read all profiles" policy into a directory of every
--     registered address (an enumeration hole created by schema, not policy);
--   * any role or entitlement column — users may UPDATE their own profile, so
--     a role living here would make escalation a column-grant problem (D.7);
--   * deleted_at — deletion is permanent (D8), so no policy has to remember to
--     exclude tombstoned rows.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New user'
               constraint profiles_display_name_length
               check (char_length(display_name) between 1 and 80),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.profiles.display_name is
  'Seeded from the Full name field at sign-up, editable thereafter. Chosen '
  'presentation, not verified identity (architecture D.2 naming note).';

-- -----------------------------------------------------------------------------
-- 3. user_roles (D.7)
-- -----------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on column public.user_roles.granted_by is
  'NULL for the trigger''s automatic default grant; set to the granting user '
  'for an out-of-band admin grant (architecture D.7.1).';

-- -----------------------------------------------------------------------------
-- 4. Automation (D.4)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so the client cannot skip it, with `search_path = ''` and
-- every identifier schema-qualified. An unqualified search_path in a definer
-- function is a known privilege-escalation vector (E.4), asserted by
-- 050_definer_audit.sql rather than merely intended.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The profile. The name comes from metadata the caller supplied, falling
  -- back to the column default. NEVER from the email local-part, which would
  -- reintroduce the address into a client-readable table by the back door.
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      'New user'
    )
  )
  on conflict (id) do nothing;

  -- The default role (requirement 8). 'user' is a LITERAL.
  --
  -- It is not read from raw_user_meta_data, not from the request, and not from
  -- a column default a client could influence. There is NO branch producing
  -- the elevated role here — in particular no "if this is the first user"
  -- convenience, which is the usual shape of requirement 9 being violated.
  -- Elevation happens only out of band, by someone holding database
  -- credentials this application does not possess (D.7.1).
  --
  -- NOTE: 045_default_role.sql asserts that no function body in `public`
  -- contains the elevated role name as a quoted literal. That is why this
  -- comment does not spell it. The test is crude on purpose — a static check
  -- that cannot be argued with beats a careful reading nobody repeats.
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- This function runs inside the auth.users INSERT transaction, so an exception
-- raised here ABORTS registration and surfaces as an unexplained auth bug.
-- Both inserts above are therefore conflict-tolerant and depend on no optional
-- metadata: a user who supplies no name still gets both rows.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- EXECUTE revoked from PUBLIC: these are invoked by triggers, never by a
-- caller. Nothing grants them to a client role (E.4).
revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. GATE 1 — GRANTs (E.4)
-- -----------------------------------------------------------------------------
revoke all on public.profiles   from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
-- COLUMN-level UPDATE is the load-bearing line: id, created_at and updated_at
-- cannot be written even by a correctly-shaped request that satisfies every
-- policy. No INSERT (the trigger does it); no DELETE (the cascade does it).
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- user_roles: SELECT and nothing else, ever. This is where requirement 10
-- actually holds — a client role with no write privilege cannot escalate
-- regardless of what any policy says, because the attempt dies at gate 1.
grant select on public.user_roles to authenticated;

-- anon receives nothing on either table.

-- -----------------------------------------------------------------------------
-- 6. GATE 2 — RLS (E.3)
-- -----------------------------------------------------------------------------
-- FORCE as well as ENABLE: without it the table owner is exempt from its own
-- policies, so a definer function or an owner-run query would read every row.
alter table public.profiles   enable row level security;
alter table public.profiles   force  row level security;
alter table public.user_roles enable row level security;
alter table public.user_roles force  row level security;

-- Separate policies per command, never FOR ALL, so each is readable and
-- testable in isolation. auth.uid() is wrapped in a SELECT so the planner
-- treats it as a constant instead of re-evaluating it per row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

-- WITH CHECK is not decorative: without it a user could update their row into
-- a state the policy no longer matches — including handing it to someone else.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- No INSERT or DELETE policy on either table, and no write policy of any kind
-- on user_roles. With RLS enabled, the absence of a policy IS a denial — and
-- it matches a grant that does not exist. The two refusals are deliberately
-- redundant (E.4).
