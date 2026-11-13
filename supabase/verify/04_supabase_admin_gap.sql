-- =============================================================================
-- DIAGNOSTIC — the supabase_admin default-privilege entries
-- =============================================================================
-- 04_default_privileges.sql is role-scoped: run as `postgres`, it writes
-- `postgres` entries. Entries owned by supabase_admin are untouched, and the
-- stock Supabase set grants anon and authenticated broadly.
--
-- This asks three questions the earlier query could not answer:
--   1. Are those entries GLOBAL or scoped to a single schema?
--   2. Exactly which privileges do anon and authenticated receive?
--   3. Can the current role do anything about it?
--
-- Read-only. Creates nothing, changes nothing.
-- =============================================================================

-- 1. Every default-privilege entry, with its scope spelled out.
select pg_get_userbyid(d.defaclrole)     as set_by,
       coalesce(n.nspname, '(GLOBAL)')   as scope,
       case d.defaclobjtype
         when 'r' then 'tables' when 'S' then 'sequences'
         when 'f' then 'functions' when 'T' then 'types'
         when 'n' then 'schemas' else d.defaclobjtype::text
       end                               as object_type,
       a.grantee_name,
       a.privs
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral (
    select case when x.grantee = 0 then 'PUBLIC'
                else pg_get_userbyid(x.grantee) end as grantee_name,
           string_agg(x.privilege_type, ',' order by x.privilege_type) as privs
      from aclexplode(d.defaclacl) x
     group by 1
  ) a
 where a.grantee_name in ('anon','authenticated','PUBLIC')
 order by set_by, scope, object_type, grantee_name;

-- 2. Can the current role rewrite supabase_admin's entries?
--    ALTER DEFAULT PRIVILEGES FOR ROLE x requires membership in x.
--    Expect `false` on a hosted project — postgres is not normally a member.
select current_user,
       pg_has_role(current_user, 'supabase_admin', 'MEMBER') as may_alter_supabase_admin_defaults;

-- 3. Does supabase_admin actually own anything in public right now?
--    Expect zero rows. If it owns nothing here, the gap is latent rather
--    than live: it would bite only when the platform next creates an object
--    in this schema.
select c.relname,
       c.relkind,
       pg_get_userbyid(c.relowner) as owner
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and pg_get_userbyid(c.relowner) = 'supabase_admin'
   and c.relkind in ('r','v','m','S','p')
 order by c.relname;
