-- =============================================================================
-- PRE-FLIGHT — run this BEFORE anything else, and keep the output
-- =============================================================================
-- Two reasons, and the second is the one that bites later:
--
--  1. It records what the project looked like before we touched it.
--  2. ALTER DEFAULT PRIVILEGES has no "undo to how it was" — you can only set
--     it to something else. If you do not capture the current state first,
--     the rollback for 04_default_privileges.sql cannot be written at all.
--
-- Read-only. Creates nothing, changes nothing.
-- =============================================================================

-- 1. The existing default privileges. THIS IS THE ONE TO KEEP.
select pg_get_userbyid(defaclrole) as set_by,
       n.nspname                   as schema,
       defaclobjtype               as object_type,   -- r=table s=sequence f=function
       defaclacl                   as current_defaults
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
 order by 1, 2, 3;

-- 2. Anything already in public. Expected: no rows. If `profiles` or
--    `user_roles` appear here, STOP — the migration's CREATE TABLE IF NOT
--    EXISTS would silently skip them and you would end up with a table of the
--    wrong shape and no error.
select tablename, rowsecurity
  from pg_tables where schemaname = 'public'
 order by tablename;

-- 3. Does the app_role type already exist? Expected: no rows.
select typname from pg_type where typname = 'app_role';

-- 4. Who owns the auth schema, and can the current role create a trigger on
--    auth.users? The trigger is the one statement in the migration most
--    likely to be refused.
select current_user,
       pg_get_userbyid(nspowner)                              as auth_owner,
       has_table_privilege(current_user,'auth.users','TRIGGER') as may_create_trigger
  from pg_namespace where nspname = 'auth';

-- 5. Existing triggers on auth.users. Expected: none named
--    on_auth_user_created.
select tgname from pg_trigger
 where tgrelid = 'auth.users'::regclass and not tgisinternal;
