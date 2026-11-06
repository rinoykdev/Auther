-- =============================================================================
-- POST-MIGRATION VERIFICATION — run after both scripts
-- =============================================================================
-- Mirrors the pgTAP suite that passes in CI, but against the REAL project.
-- "It passed in the container" is precisely the claim H.6.1 exists to doubt.
--
-- Read-only. Every query below states its expected result.
-- =============================================================================

-- 1. Both tables exist, with RLS ENABLED and FORCED.
--    Expect exactly two rows, all three booleans true.
--    `forced` matters: without it the table owner is exempt from its own
--    policies, so an owner-run query or a definer function reads every row.
select c.relname,
       c.relrowsecurity      as rls_enabled,
       c.relforcerowsecurity as rls_forced
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('profiles','user_roles')
 order by c.relname;

-- 2. NO table in public has RLS off. Expect zero rows.
--    This is the sweep that catches every future table that forgets.
select tablename from pg_tables
 where schemaname = 'public' and not rowsecurity;

-- 3. GATE 1 — table privileges. Expect EXACTLY three rows:
--      authenticated | profiles   | SELECT
--      authenticated | user_roles | SELECT
--      authenticated | profiles   | UPDATE
--    `anon` MUST NOT APPEAR AT ALL. If it does, stop: the default privileges
--    were not narrowed and the publishable key's safety (E.5) does not hold.
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where grantee in ('anon','authenticated') and table_schema = 'public'
 order by grantee, table_name, privilege_type;

-- 4. GATE 1 — COLUMN privileges. Expect exactly two rows:
--    display_name and avatar_url. If `id`, `created_at` or `updated_at`
--    appear, a client could rewrite them through a perfectly valid request.
select grantee, table_name, column_name, privilege_type
  from information_schema.column_privileges
 where grantee in ('anon','authenticated')
   and table_schema = 'public' and privilege_type = 'UPDATE'
 order by table_name, column_name;

-- 5. GATE 2 — the policies. Expect three, all for `authenticated`:
--      profiles_select_own    SELECT
--      profiles_update_own    UPDATE   (qual AND with_check both present)
--      user_roles_select_own  SELECT
--    A NULL with_check on the UPDATE policy means a user could update their
--    row into a state the policy no longer matches.
select tablename, policyname, cmd,
       array_to_string(roles::text[], ',') as roles,
       qual, with_check
  from pg_policies where schemaname = 'public'
 order by tablename, policyname;

-- 6. The triggers exist and are wired to the right tables.
--    Expect: on_auth_user_created on auth.users,
--            set_profiles_updated_at on public.profiles.
select c.relname as on_table, t.tgname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal
   and t.tgname in ('on_auth_user_created','set_profiles_updated_at')
 order by t.tgname;

-- 7. SECURITY DEFINER hygiene. Expect both functions with
--    search_path="" and acl NOT granting PUBLIC.
--    A definer function with an unpinned search_path is a known
--    privilege-escalation vector.
select p.proname,
       p.prosecdef                                           as is_definer,
       coalesce(array_to_string(p.proconfig, ','), 'UNSET')  as search_path,
       coalesce(p.proacl::text, 'NULL (= PUBLIC may execute)') as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('handle_new_user','set_updated_at')
 order by p.proname;

-- 8. The enum holds exactly the two approved values. A third appearing here
--    is a change to the authorization model, not a detail.
select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'app_role' order by e.enumsortorder;

-- 9. The profiles table must NOT have these columns. Expect zero rows.
--    An email column turns any future broad read policy into a directory of
--    every registered address; a role column makes escalation a column-grant
--    problem (D.2, D.7).
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('email','role','deleted_at');

-- 10. Nothing in public may read auth.users through a view. Expect zero rows.
select viewname from pg_views
 where schemaname = 'public' and definition ilike '%auth.users%';

-- 11. The default privileges AFTER 04. anon/authenticated should no longer
--     appear for new tables in public.
select pg_get_userbyid(defaclrole) as set_by, defaclobjtype, defaclacl
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
 where n.nspname = 'public' or n.nspname is null;
