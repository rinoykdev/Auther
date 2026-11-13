-- =============================================================================
-- DEFAULT-ACL PROBE — run this TWICE: once before 04, once after
-- =============================================================================
-- Settles by measurement what cannot be settled by reading the catalogue:
-- when this role creates an object in `public`, what privileges does it
-- actually come out with?
--
-- Creates a throwaway table and function, reads their real ACLs, and ROLLS
-- BACK. Nothing survives. Safe to run against any project, at any time.
--
-- -----------------------------------------------------------------------------
-- HOW TO READ relacl / proacl — the NULL trap
-- -----------------------------------------------------------------------------
-- A NULL acl does NOT mean "no privileges". It means "no entry was recorded,
-- so PostgreSQL's hardwired default is in force" — and for FUNCTIONS the
-- hardwired default is EXECUTE TO PUBLIC.
--
-- So for the function probe:
--      proacl IS NULL      -> FAIL. No default-privilege entry applied.
--                             PUBLIC can execute. This is the exact trap that
--                             the SECURITY DEFINER audit (050) was rewritten
--                             to catch.
--      proacl IS NOT NULL  -> an entry applied. Now check its CONTENTS.
--
-- A non-NULL acl is itself the proof that an ALTER DEFAULT PRIVILEGES entry
-- fired for this role and this schema.
-- =============================================================================

begin;

create table public.zz_probe_table (id int);

create function public.zz_probe_function() returns int
  language sql immutable as $$ select 1 $$;

select 'table'                     as object,
       c.relacl::text              as acl,
       c.relacl is null            as acl_is_null
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'zz_probe_table'

union all

select 'function',
       p.proacl::text,
       p.proacl is null
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'zz_probe_function';

-- The same question asked a second way, in plain English, so the answer does
-- not depend on reading aclitem syntax correctly.
select has_function_privilege('public',       'public.zz_probe_function()', 'EXECUTE') as public_may_execute,
       has_function_privilege('anon',         'public.zz_probe_function()', 'EXECUTE') as anon_may_execute,
       has_function_privilege('authenticated','public.zz_probe_function()', 'EXECUTE') as authenticated_may_execute,
       has_table_privilege   ('anon',         'public.zz_probe_table',      'SELECT')  as anon_may_select,
       has_table_privilege   ('authenticated','public.zz_probe_table',      'SELECT')  as authenticated_may_select;

rollback;
