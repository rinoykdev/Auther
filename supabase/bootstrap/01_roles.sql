-- =============================================================================
-- Bootstrap 01 — the database roles PostgREST switches to
-- =============================================================================
-- H.6 condition 3. These are the roles a client request actually arrives as:
-- `anon` for a logged-out caller, `authenticated` for a logged-in one (E.4).
--
-- NOBYPASSRLS is written EXPLICITLY rather than relied upon as the default.
-- A role holding BYPASSRLS makes every RLS test in this suite meaningless
-- while still passing, which is the worst failure mode available to us — so it
-- is stated here and asserted in 020_grants.sql.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Supabase's service_role DOES bypass RLS. Recreated faithfully so the
    -- reconstruction matches the platform; nothing in this project's client
    -- path ever uses it (E.5).
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'postgres';
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
