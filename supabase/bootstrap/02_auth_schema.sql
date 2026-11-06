-- =============================================================================
-- Bootstrap 02 — the auth schema
-- =============================================================================
-- Only the parts our migration actually references: `id`, which `profiles.id`
-- and `user_roles.user_id` point at, and `raw_user_meta_data`, which the
-- trigger reads. Recreating more would be inventing a contract we do not have.
--
-- OWNERSHIP MATTERS HERE, and it is why this file is more careful than it
-- looks. The pinned supabase/postgres image already ships an `auth` schema
-- owned by `supabase_auth_admin`, and `postgres` cannot create tables in it —
-- which is NOT a quirk of the image, it is the real platform's posture. A
-- naive `create table auth.users` therefore fails with "permission denied for
-- schema auth", which is how this first ran in CI.
--
-- The fix is to create the table AS the role that owns the schema, which is
-- also exactly what GoTrue does in production. Fighting the ownership (taking
-- the schema over, or granting ourselves into it) would have produced a
-- reconstruction that diverges from the platform in precisely the area the
-- parity check exists to watch.
-- =============================================================================

create schema if not exists auth;

-- Become the schema's owner for the rest of this file, if we are not already
-- able to create in it. Fails loudly rather than silently proceeding to the
-- same permission error three statements later.
do $$
declare
  owner_role text;
begin
  if has_schema_privilege(current_user, 'auth', 'CREATE') then
    return;
  end if;

  select pg_get_userbyid(nspowner) into owner_role
    from pg_namespace where nspname = 'auth';

  if owner_role is null then
    raise exception 'schema auth has no resolvable owner';
  end if;

  if not pg_has_role(current_user, owner_role, 'MEMBER') then
    raise exception
      'cannot create in schema auth: % owns it and % is not a member',
      owner_role, current_user;
  end if;

  execute format('set role %I', owner_role);
end
$$;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  email_confirmed_at  timestamptz,
  created_at          timestamptz not null default now()
);

-- Back to the connecting role before anything else runs.
reset role;

-- Fidelity detail that matters (H.6.1 category 4): in a real Supabase project
-- anon and authenticated DO hold USAGE on this schema — that is how they can
-- call auth.uid() at all. What they lack is any privilege on auth.users.
-- Revoking schema usage would both break the helpers and diverge from the
-- platform in a way the policies depend on.
grant usage on schema auth to anon, authenticated, service_role;

revoke all on auth.users from anon, authenticated;
