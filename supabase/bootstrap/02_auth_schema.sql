-- =============================================================================
-- Bootstrap 02 — the auth schema
-- =============================================================================
-- Only the parts our migration actually references: `id`, which `profiles.id`
-- and `user_roles.user_id` point at, and `raw_user_meta_data`, which the
-- trigger reads. Recreating more would be inventing a contract we do not have.
--
-- `email_confirmed_at` is present because the end-to-end work in Milestone 4
-- reads it through the authorized server-side path (D.6) — never from the
-- client, and never from a JWT claim (C.1.1).
--
-- NO privilege is granted to anon or authenticated on anything in this schema.
-- That absence is the point, and 020_grants.sql asserts it.
-- =============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  email_confirmed_at  timestamptz,
  created_at          timestamptz not null default now()
);

-- Fidelity detail that matters (H.6.1 category 4): in a real Supabase project
-- anon and authenticated DO hold USAGE on this schema — that is how they can
-- call auth.uid() at all. What they hold is no privilege on auth.users.
-- Revoking schema usage here would both break the helpers and make the
-- reconstruction diverge from the platform in a way the policies depend on.
grant usage on schema auth to anon, authenticated, service_role;

revoke all on all tables in schema auth from anon, authenticated;
alter default privileges in schema auth revoke all on tables from anon, authenticated;
