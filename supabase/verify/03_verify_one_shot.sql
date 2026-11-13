-- =============================================================================
-- ONE-SHOT VERIFICATION — the whole of 01_post_migration.sql as a single query
-- =============================================================================
-- The Supabase SQL editor shows only the LAST statement's result, so an
-- 11-query script reports one answer and silently discards ten. This collapses
-- all of them into one result set: 11 rows, each with its own pass/fail.
--
-- Read-only. Creates nothing, changes nothing.
--
-- PASS = every row shows `pass` true. Read `actual` on any row that does not.
-- 01_post_migration.sql remains the detailed version: run it query by query to
-- see the underlying rows for anything that fails here.
-- =============================================================================

with checks as (

  select 1 as seq, 'RLS enabled AND forced on both tables' as check_name,
         (select count(*)::text from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname in ('profiles','user_roles')
             and c.relrowsecurity and c.relforcerowsecurity) as actual,
         '2' as expected

  union all select 2, 'no table in public has RLS off',
         (select count(*)::text from pg_tables
           where schemaname = 'public' and not rowsecurity), '0'

  union all select 3, 'anon holds NO table privilege in public',
         (select count(*)::text from information_schema.role_table_grants
           where grantee::text = 'anon' and table_schema::text = 'public'), '0'

  union all select 4, 'authenticated holds exactly 3 table privileges',
         (select count(*)::text from information_schema.role_table_grants
           where grantee::text = 'authenticated' and table_schema::text = 'public'), '3'

  union all select 5, 'UPDATE granted on display_name + avatar_url only',
         (select coalesce(string_agg(distinct column_name::text, ',' order by column_name::text), '(none)')
            from information_schema.column_privileges
           where grantee::text in ('anon','authenticated')
             and table_schema::text = 'public' and privilege_type::text = 'UPDATE'),
         'avatar_url,display_name'

  union all select 6, 'exactly 3 policies, all to authenticated',
         (select count(*)::text from pg_policies
           where schemaname = 'public'
             and array_to_string(roles::text[], ',') = 'authenticated'), '3'

  union all select 7, 'the UPDATE policy has a WITH CHECK clause',
         (select coalesce((with_check is not null)::text, 'false') from pg_policies
           where schemaname = 'public' and policyname = 'profiles_update_own'), 'true'

  union all select 8, 'both triggers exist',
         (select count(*)::text from pg_trigger t
           where not t.tgisinternal
             and t.tgname in ('on_auth_user_created','set_profiles_updated_at')), '2'

  union all select 9, 'definer functions: search_path pinned, PUBLIC cannot execute',
         (select count(*)::text from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('handle_new_user','set_updated_at')
             and p.prosecdef
             and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
             and p.proacl is not null
             and not exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)), '2'

  union all select 10, 'app_role holds exactly user + admin',
         (select string_agg(enumlabel::text, ',' order by e.enumsortorder)
            from pg_enum e join pg_type t on t.oid = e.enumtypid
           where t.typname = 'app_role'), 'user,admin'

  union all select 11, 'profiles has no email / role / deleted_at column',
         (select count(*)::text from information_schema.columns
           where table_schema::text = 'public' and table_name::text = 'profiles'
             and column_name::text in ('email','role','deleted_at')), '0'

  union all select 12, 'no view in public exposes auth.users',
         (select count(*)::text from pg_views
           where schemaname = 'public' and definition ilike '%auth.users%'), '0'

  union all select 13, 'default privileges name neither anon nor authenticated',
         (select count(*)::text from pg_default_acl d
           where array_to_string(d.defaclacl::text[], ',') ~ '(anon|authenticated)='), '0'
)

select seq,
       case when actual is not distinct from expected then 'PASS' else 'FAIL' end as result,
       check_name,
       coalesce(actual, '(null)') as actual,
       expected
  from checks
 order by seq;
