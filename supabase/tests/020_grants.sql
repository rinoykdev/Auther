-- =============================================================================
-- 020 — GATE 1: PostgreSQL privileges, in isolation from any policy
-- =============================================================================
-- The full E.4 matrix. The NEGATIVES are asserted explicitly, because a
-- privilege that was never granted is a stronger control than a policy that
-- refuses — and because a grant appearing later without being added here must
-- fail the build.
--
-- This file must be able to fail INDEPENDENTLY of 030_rls.sql. A test that
-- passed only because RLS caught what a missing grant should have caught would
-- start failing open the day the grant plan changed, and nothing would say so.
-- =============================================================================
begin;
select plan(25);

-- The roles exist with the attributes the whole suite depends on.
select has_role('anon','role anon exists');
select has_role('authenticated','role authenticated exists');

-- If either of these held BYPASSRLS, every assertion in 030_rls.sql would pass
-- while proving nothing at all.
select is((select rolbypassrls from pg_roles where rolname='anon'), false,
  'anon does NOT bypass RLS');
select is((select rolbypassrls from pg_roles where rolname='authenticated'), false,
  'authenticated does NOT bypass RLS');
select is((select rolsuper from pg_roles where rolname='authenticated'), false,
  'authenticated is not a superuser');

-- Schema reachability (gate step 1).
select ok(has_schema_privilege('authenticated','public','USAGE'),
  'authenticated has USAGE on public');
-- USAGE on the auth schema IS held — that is how auth.uid() is callable. The
-- protection is the absence of any privilege on auth.users itself (D.5).
select ok(has_schema_privilege('authenticated','auth','USAGE'),
  'authenticated has USAGE on auth (required to call auth.uid())');
select ok(not has_table_privilege('authenticated','auth.users','SELECT'),
  'authenticated may NOT read auth.users');
select ok(not has_table_privilege('anon','auth.users','SELECT'),
  'anon may NOT read auth.users');

-- profiles: what authenticated MAY do.
select ok(has_table_privilege('authenticated','public.profiles','SELECT'),
  'authenticated may SELECT profiles');
select ok(has_column_privilege('authenticated','public.profiles','display_name','UPDATE'),
  'authenticated may UPDATE profiles.display_name');
select ok(has_column_privilege('authenticated','public.profiles','avatar_url','UPDATE'),
  'authenticated may UPDATE profiles.avatar_url');

-- profiles: what it MAY NOT. The column grants are the load-bearing ones.
select ok(not has_table_privilege('authenticated','public.profiles','INSERT'),
  'authenticated may NOT INSERT profiles — the trigger does that');
select ok(not has_table_privilege('authenticated','public.profiles','DELETE'),
  'authenticated may NOT DELETE profiles — the cascade does that');
select ok(not has_column_privilege('authenticated','public.profiles','id','UPDATE'),
  'authenticated may NOT UPDATE profiles.id');
select ok(not has_column_privilege('authenticated','public.profiles','created_at','UPDATE'),
  'authenticated may NOT UPDATE profiles.created_at');
select ok(not has_column_privilege('authenticated','public.profiles','updated_at','UPDATE'),
  'authenticated may NOT UPDATE profiles.updated_at — the trigger owns it');

-- user_roles: SELECT only. This is requirement 10 holding at the grant gate.
select ok(has_table_privilege('authenticated','public.user_roles','SELECT'),
  'authenticated may SELECT user_roles');
select ok(not has_table_privilege('authenticated','public.user_roles','INSERT'),
  'authenticated may NOT INSERT user_roles — no self-promotion (requirement 10)');
select ok(not has_table_privilege('authenticated','public.user_roles','UPDATE'),
  'authenticated may NOT UPDATE user_roles');
select ok(not has_table_privilege('authenticated','public.user_roles','DELETE'),
  'authenticated may NOT DELETE user_roles');

-- anon holds nothing on either table.
select ok(not has_table_privilege('anon','public.profiles','SELECT'),
  'anon may NOT SELECT profiles');
select ok(not has_table_privilege('anon','public.user_roles','SELECT'),
  'anon may NOT SELECT user_roles');

-- The trigger functions are not callable by a client role.
select ok(not has_function_privilege('authenticated','public.handle_new_user()','EXECUTE'),
  'authenticated may NOT execute handle_new_user');
select ok(not has_function_privilege('anon','public.handle_new_user()','EXECUTE'),
  'anon may NOT execute handle_new_user');

select * from finish();
rollback;
