-- =============================================================================
-- Parity catalogue (architecture H.6.1)
-- =============================================================================
-- Run against BOTH databases; diff the two outputs. The pass condition is an
-- EMPTY diff. A human reading two outputs side by side is not the procedure —
-- a difference in one column of one role is exactly what the eye skips.
--
--   CI half:    produced by the `database` job and uploaded as an artifact.
--   Cloud half: run by the owner from a local shell against the Supabase
--               development project. It reads catalogues only and writes
--               nothing. NO credential for this ever enters CI (H.6 cond. 6).
--
--   psql -v ON_ERROR_STOP=1 -tAf supabase/parity/collect.sql "$CONN" > parity-cloud.txt
--   diff parity-ci.txt parity-cloud.txt
-- =============================================================================
\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'

-- Category 2 — roles. Checked early: a role holding BYPASSRLS in one database
-- and not the other makes every RLS result incomparable.
select 'role|' || rolname::text
       || '|super='     || rolsuper::text
       || '|bypassrls=' || rolbypassrls::text
       || '|inherit='   || rolinherit::text
       || '|login='     || rolcanlogin::text
  from pg_roles
 where rolname in ('anon','authenticated','service_role','authenticator')
 order by rolname;

-- Category 3 — the full E.4 privilege matrix, table level.
select 'table_priv|' || grantee::text || '|' || table_schema::text || '.' || table_name::text
       || '|' || privilege_type::text
  from information_schema.role_table_grants
 where grantee in ('anon','authenticated')
   and table_schema in ('public','auth')
 order by grantee, table_schema, table_name, privilege_type;

-- Category 3 — column level. This is where a too-wide UPDATE hides.
select 'column_priv|' || grantee::text || '|' || table_schema::text || '.' || table_name::text
       || '.' || column_name::text || '|' || privilege_type::text
  from information_schema.column_privileges
 where grantee in ('anon','authenticated')
   and table_schema = 'public'
 order by grantee, table_name, column_name, privilege_type;

-- Category 4 — the auth.* helpers: identity.
select 'auth_fn|' || p.proname::text
       || '|returns='    || pg_get_function_result(p.oid)
       || '|secdef='     || p.prosecdef::text
       || '|search_path='|| coalesce(array_to_string(p.proconfig, ','), 'UNSET')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'auth' and p.proname in ('uid','jwt','role')
 order by p.proname;

-- Category 4 — the helpers' BEHAVIOUR under fixed claim fixtures.
-- The sharpest edge of parity drift: a stub that returns NULL where Supabase
-- raises (or the reverse) changes what `(select auth.uid()) = id` evaluates to
-- in exactly the null case a policy is most likely to get wrong.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select 'auth_uid|normal|'  || coalesce(auth.uid()::text, 'NULL');
select 'auth_role|normal|' || coalesce(auth.role(), 'NULL');

set request.jwt.claims = '{"role":"authenticated"}';
select 'auth_uid|sub_absent|' || coalesce(auth.uid()::text, 'NULL');

set request.jwt.claims = '{"sub":null,"role":"authenticated"}';
select 'auth_uid|sub_null|' || coalesce(auth.uid()::text, 'NULL');

set request.jwt.claims = '';
select 'auth_uid|claims_empty|' || coalesce(auth.uid()::text, 'NULL');

-- Malformed JSON: does the helper raise, or return NULL? Either is defensible;
-- the two databases DISAGREEING is not — and the disagreement is invisible
-- until a policy meets a token it cannot parse.
--
-- The raise must be CAUGHT rather than allowed to propagate: with
-- ON_ERROR_STOP set, an uncaught error here would abort collection, so the
-- fixture most likely to reveal drift would also be the one that never ran.
create or replace function pg_temp.probe_uid() returns text
language plpgsql as $probe$
begin
  return coalesce(auth.uid()::text, 'NULL');
exception when others then
  return 'RAISED:' || sqlstate;
end;
$probe$;

set request.jwt.claims = '{not json';
select 'auth_uid|claims_malformed|' || pg_temp.probe_uid();

set request.jwt.claims = '{"sub":"not-a-uuid","role":"authenticated"}';
select 'auth_uid|sub_not_uuid|' || pg_temp.probe_uid();

reset request.jwt.claims;

-- RLS posture of every table in public.
select 'rls|' || schemaname::text || '.' || tablename::text
       || '|enabled=' || rowsecurity::text
  from pg_tables where schemaname = 'public'
 order by tablename;

select 'policy|' || schemaname::text || '.' || tablename::text || '|' || policyname::text
       || '|cmd='   || cmd::text
       || '|roles=' || array_to_string(roles::text[], ',')
       || '|using=' || coalesce(qual, 'NONE')
       || '|check=' || coalesce(with_check, 'NONE')
  from pg_policies where schemaname = 'public'
 order by tablename, policyname;

-- Category 1 — the objects the migration created. Checked last here, but it is
-- the category that invalidates all the others when it differs.
select 'object|' || n.nspname::text || '.' || c.relname::text || '|' || c.relkind::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r','v','m')
 order by c.relname;
