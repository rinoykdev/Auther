-- =============================================================================
-- 060 — the sweep
-- =============================================================================
-- One test that catches EVERY future table which forgets RLS. It is written
-- now, while there are only two tables, because its value is entirely in the
-- tables nobody has written yet.
-- =============================================================================
begin;
select plan(4);

-- A NOTE ON ::text, because this file once died before its first assertion:
-- pg_tables.tablename and pg_class.relname are of PostgreSQL's `name` type,
-- so array_agg over them yields name[]. pgTAP's is() is polymorphic over a
-- single type, so is(name[], text[]) matches no function and psql aborts the
-- file - which pg_prove reports as "Dubious", with the error swallowed. Every
-- aggregated identifier below is cast to text for that reason.

select is(
  (select coalesce(array_agg(tablename::text order by tablename), array[]::text[])
     from pg_tables where schemaname = 'public' and not rowsecurity),
  array[]::text[],
  'NO table in public has RLS disabled');

-- ENABLE alone exempts the table owner from its own policies. FORCE closes
-- that, which matters because our trigger functions run as the owner.
select is(
  (select coalesce(array_agg(relname::text order by relname), array[]::text[])
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relrowsecurity and not c.relforcerowsecurity),
  array[]::text[],
  'every RLS table in public also FORCEs it, so the owner is not exempt');

-- A table with RLS on and no policy is default-deny, which is safe but is
-- usually a mistake — it means a table nobody can reach.
select is(
  (select coalesce(array_agg(tablename::text order by tablename), array[]::text[])
     from pg_tables t
    where t.schemaname = 'public' and t.rowsecurity
      and not exists (select 1 from pg_policies p
                       where p.schemaname = t.schemaname
                         and p.tablename = t.tablename)),
  array[]::text[],
  'every RLS-enabled table has at least one policy');

-- No view in public may read auth.users. A view runs with its owner's rights,
-- so it is the classic way the auth schema's protection is tunnelled around
-- (D.5) — and it would look like an ordinary convenience in review.
select is(
  (select count(*) from pg_views v
    where v.schemaname = 'public' and v.definition ilike '%auth.users%'),
  0::bigint,
  'no view in public selects from auth.users (D.5)');

select * from finish();
rollback;
