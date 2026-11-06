-- =============================================================================
-- 045 — requirements 8, 9 and 10
-- =============================================================================
-- "Every new user receives the default user role", "the first registered user
-- must NOT become an admin", and "admin provisioning is handled separately".
--
-- These are the reason user_roles exists in Milestone 3 rather than Milestone
-- 10 (decision R1). A security property with nothing to assert against cannot
-- be tested, only hoped for.
-- =============================================================================
begin;
select plan(9);

-- ---------------------------------------------------------------------------
-- Requirement 9 — the EMPTY-database case
-- ---------------------------------------------------------------------------
-- This is the case that matters, and the only one in which a "first user
-- becomes admin" convenience is visible at all. Every other test in this suite
-- passes with such a branch present.
select is((select count(*) from auth.users), 0::bigint,
  'precondition: the database has no users at all');
select is((select count(*) from public.user_roles where role='admin'), 0::bigint,
  'precondition: no admin exists anywhere');

insert into auth.users (id, email) values
  ('f1f1f1f1-0000-0000-0000-000000000001','first@test.dev');

select is(
  (select array_agg(role::text) from public.user_roles
    where user_id='f1f1f1f1-0000-0000-0000-000000000001'),
  array['user'],
  'THE FIRST REGISTERED USER RECEIVES user AND NOTHING ELSE (requirement 9)');
select is((select count(*) from public.user_roles where role='admin'), 0::bigint,
  'no admin row was created by registering the first user');

-- The second user behaves identically.
insert into auth.users (id, email) values
  ('f2f2f2f2-0000-0000-0000-000000000002','second@test.dev');
select is(
  (select array_agg(role::text) from public.user_roles
    where user_id='f2f2f2f2-0000-0000-0000-000000000002'),
  array['user'],
  'the second user also receives exactly user (requirement 8)');

-- ---------------------------------------------------------------------------
-- The role is never taken from anything a client controls
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('f3f3f3f3-0000-0000-0000-000000000003','sneaky@test.dev',
   '{"display_name":"Mallory","role":"admin","app_role":"admin"}');

select is(
  (select array_agg(role::text) from public.user_roles
    where user_id='f3f3f3f3-0000-0000-0000-000000000003'),
  array['user'],
  'a role supplied in user metadata is IGNORED — the trigger writes a literal');

-- ---------------------------------------------------------------------------
-- Requirement 10 — no application path grants admin
-- ---------------------------------------------------------------------------
-- A static assertion over the function bodies. If a future change introduces
-- an admin grant anywhere reachable from a client action, this fails.
-- Extension-owned functions are excluded: pgTAP and pgcrypto install into
-- `public`, and what they contain says nothing about our code.
select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ilike '%''admin''%'
      and not exists (select 1 from pg_depend d
                       where d.objid = p.oid and d.deptype = 'e')),
  0::bigint,
  'NO function in public writes the literal admin (requirement 10)');

-- And the grant gate, restated here so this file fails on its own if the
-- privilege plan is ever loosened.
select ok(not has_table_privilege('authenticated','public.user_roles','INSERT'),
  'no client role can insert a role row at all');

-- Admin IS reachable with database credentials — which is the point. The
-- out-of-band process in D.7.1 must work, or the system has no administrators.
insert into public.user_roles (user_id, role, granted_by)
values ('f2f2f2f2-0000-0000-0000-000000000002','admin',
        'f1f1f1f1-0000-0000-0000-000000000001');
select is(
  (select granted_by from public.user_roles
    where user_id='f2f2f2f2-0000-0000-0000-000000000002' and role='admin'),
  'f1f1f1f1-0000-0000-0000-000000000001'::uuid,
  'an out-of-band grant works and records who made it (D.7.1)');

select * from finish();
rollback;
