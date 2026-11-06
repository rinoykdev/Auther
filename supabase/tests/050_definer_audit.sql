-- =============================================================================
-- 050 — SECURITY DEFINER audit (H.3 Family 2)
-- =============================================================================
-- Schema-wide, not profiles-specific. Its entire value is in the functions
-- that do not exist yet: a definer function with a mutable search_path is a
-- known privilege-escalation vector, and it is invisible in review.
-- =============================================================================
begin;
select plan(3);

select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c
                           where c like 'search_path=%'))),
  0::bigint,
  'every SECURITY DEFINER function in public pins its search_path');

select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('public', p.oid, 'EXECUTE')),
  0::bigint,
  'no SECURITY DEFINER function grants EXECUTE to PUBLIC');

select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  0::bigint,
  'no SECURITY DEFINER function is callable by anon or authenticated');

select * from finish();
rollback;
