-- =============================================================================
-- 050 — SECURITY DEFINER audit (H.3 Family 2)
-- =============================================================================
-- Schema-wide, not profiles-specific. Its entire value is in the functions
-- that do not exist yet: a definer function with a mutable search_path is a
-- known privilege-escalation vector, and it is invisible in review.
--
-- EXTENSION-OWNED FUNCTIONS ARE EXCLUDED. pgTAP and pgcrypto install into
-- `public`, and auditing them tells us nothing about our own code while
-- making the result depend on a third party's choices. `pg_depend.deptype =
-- 'e'` is the marker for "belongs to an extension".
-- =============================================================================
begin;
select plan(3);

create temporary view our_definers as
  select p.oid, p.proname, p.proconfig, p.proacl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and not exists (
       select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
     );

select is(
  (select count(*) from our_definers p
    where p.proconfig is null
       or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
  0::bigint,
  'every SECURITY DEFINER function in public pins its search_path');

-- A NULL proacl means DEFAULT privileges, and PostgreSQL's default for a
-- function is EXECUTE to PUBLIC. So "no ACL entry granting PUBLIC" is NOT the
-- same as "PUBLIC cannot execute it" — the dangerous case is precisely the
-- function nobody wrote an ACL for. Checking only aclexplode() would have
-- passed every newly created definer function, which is the opposite of what
-- this test is for.
select is(
  (select count(*) from our_definers p
    where p.proacl is null
       or exists (select 1 from aclexplode(p.proacl) a
                   where a.grantee = 0 and a.privilege_type = 'EXECUTE')),
  0::bigint,
  'no SECURITY DEFINER function leaves EXECUTE available to PUBLIC');

select is(
  (select count(*) from our_definers p
    where exists (select 1 from aclexplode(p.proacl) a
                   join pg_roles r on r.oid = a.grantee
                  where r.rolname in ('anon','authenticated')
                    and a.privilege_type = 'EXECUTE')),
  0::bigint,
  'no SECURITY DEFINER function is callable by anon or authenticated');

select * from finish();
rollback;
