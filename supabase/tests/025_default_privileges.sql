-- =============================================================================
-- 025 — default privileges actually fail closed (E.4, bootstrap 04)
-- =============================================================================
-- Every other test in this suite checks objects that EXIST. This one checks
-- the rule governing objects that do not exist yet: when a migration forgets
-- its GRANTs, does the new object arrive closed or open?
--
-- It answers that by MEASURING — creating a throwaway table and function and
-- reading back their real ACLs — rather than by inspecting pg_default_acl and
-- reasoning about how global and schema-scoped entries merge.
--
-- THE NULL TRAP: a NULL proacl does not mean "no privileges". It means no
-- entry was recorded, so PostgreSQL's hardwired default stands — and for
-- functions that default is EXECUTE TO PUBLIC. Same trap as 050.
--
-- Mirrors supabase/verify/02_default_acl_probe.sql, which is run by hand
-- against Supabase Cloud. If these two ever disagree, the parity check has
-- found a real divergence (H.6.1 category 3).
-- =============================================================================
begin;
select plan(6);

create table public.zz_probe_table (id int);

create function public.zz_probe_function() returns int
  language sql immutable as $$ select 1 $$;

-- The load-bearing assertion. anon and authenticated reach EXECUTE through
-- PUBLIC, not by name, so this is the one that closes the hole.
select ok(
  not has_function_privilege('public', 'public.zz_probe_function()', 'EXECUTE'),
  'PUBLIC cannot execute a newly created function'
);

select ok(
  (select proacl is not null
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'zz_probe_function'),
  'a default-privilege entry fired for the creating role (proacl is not NULL)'
);

select ok(
  not has_function_privilege('anon', 'public.zz_probe_function()', 'EXECUTE'),
  'anon cannot execute a newly created function'
);

select ok(
  not has_function_privilege('authenticated', 'public.zz_probe_function()', 'EXECUTE'),
  'authenticated cannot execute a newly created function'
);

select ok(
  not has_table_privilege('anon', 'public.zz_probe_table', 'SELECT'),
  'anon cannot select from a newly created table'
);

select ok(
  not has_table_privilege('authenticated', 'public.zz_probe_table', 'SELECT'),
  'authenticated cannot select from a newly created table'
);

select * from finish();
rollback;
