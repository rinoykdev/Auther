-- =============================================================================
-- SIGN-UP SMOKE TEST — run AFTER registering a real user through the app
-- =============================================================================
-- The first evidence that the trigger works on a real user. pgTAP proved it
-- fires on an insert into auth.users; it cannot prove that Supabase Auth
-- inserts the row the way we assumed, nor that the Full name field arrives
-- under the metadata key the trigger reads ('display_name').
--
-- Read-only.
--
-- -----------------------------------------------------------------------------
-- READ THIS BEFORE BELIEVING A ZERO
-- -----------------------------------------------------------------------------
-- profiles and user_roles are FORCE ROW LEVEL SECURITY. FORCE means the table
-- OWNER is subject to the policies too — and the policies require
-- auth.uid() = id, which is NULL in the SQL editor.
--
-- So unless your role holds BYPASSRLS, queries 2 and 3 return ZERO ROWS even
-- when the trigger worked perfectly. Query 1 tells you which world you are in.
-- A zero there is NOT a failure; it is FORCE RLS doing its job.
-- =============================================================================

-- 1. Can this role see through RLS at all? Read this FIRST.
select current_user,
       rolbypassrls as bypasses_rls,
       case when rolbypassrls
            then 'counts below are real'
            else 'counts below will be 0 regardless -- FORCE RLS is filtering you'
       end as how_to_read_the_rest
  from pg_roles where rolname = current_user;

-- 2. What the trigger produced, joined to the account it belongs to.
--    Expect one row per registered user:
--      display_name  = the Full name typed at sign-up (NOT 'New user')
--      role          = 'user'   <- requirement 8
--      granted_by    = NULL     <- the automatic grant, not an admin action
--      confirmed_at  = NULL until the email link is clicked <- requirement 7
select u.id,
       u.email,
       u.email_confirmed_at,
       p.display_name,
       r.role,
       r.granted_by
  from auth.users u
  left join public.profiles   p on p.id      = u.id
  left join public.user_roles r on r.user_id = u.id
 order by u.created_at desc
 limit 10;

-- 3. The two failure modes worth naming, counted directly.
--      missing_profile / missing_role : the trigger did not fire at all.
--      fallback_name                  : it fired, but raw_user_meta_data did
--                                       not carry 'display_name' -- the key
--                                       does not match between the client and
--                                       the trigger. A silent, cosmetic-looking
--                                       bug that means the metadata contract
--                                       is broken.
--      elevated                       : MUST be 0. Requirement 9.
select (select count(*) from auth.users u
         where not exists (select 1 from public.profiles p where p.id = u.id))
         as missing_profile,
       (select count(*) from auth.users u
         where not exists (select 1 from public.user_roles r where r.user_id = u.id))
         as missing_role,
       (select count(*) from public.profiles where display_name = 'New user')
         as fallback_name,
       (select count(*) from public.user_roles where role = 'admin')
         as elevated;
