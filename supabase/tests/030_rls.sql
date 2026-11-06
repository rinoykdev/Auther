-- =============================================================================
-- 030 — GATE 2: Row Level Security, as a real client role
-- =============================================================================
-- Every assertion runs under `set local role authenticated` with the JWT
-- claims PostgREST would set. Testing policies as a superuser proves nothing:
-- superusers bypass RLS entirely, so the suite would pass against a table with
-- no policies at all.
-- =============================================================================
begin;
select plan(14);

-- Two users, created the way Supabase creates them, so the trigger populates
-- both tables exactly as it will in production.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','a@test.dev','{"display_name":"User A"}'),
  ('22222222-2222-2222-2222-222222222222','b@test.dev','{"display_name":"User B"}');

-- ---------------------------------------------------------------------------
-- As user A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(auth.uid(), '11111111-1111-1111-1111-111111111111'::uuid,
  'auth.uid() reads sub from the request claims');

-- "Zero rows" is only meaningful alongside "and my own row IS returned" —
-- otherwise a broken query shape would look like a passing security test.
select is((select count(*) from public.profiles), 1::bigint,
  'A listing all profiles sees exactly one row');
select is((select display_name from public.profiles), 'User A',
  'and it is A''s own row');
select is(
  (select count(*) from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'), 0::bigint,
  'A cannot read B''s profile by id');

select is((select count(*) from public.user_roles), 1::bigint,
  'A sees exactly one role row');
select is((select role::text from public.user_roles), 'user',
  'and it is the default user role');
select is(
  (select count(*) from public.user_roles
    where user_id = '22222222-2222-2222-2222-222222222222'), 0::bigint,
  'A cannot read B''s roles');

-- Writes.
update public.profiles set display_name = 'A renamed'
 where id = '11111111-1111-1111-1111-111111111111';
select is((select display_name from public.profiles), 'A renamed',
  'A may update their own display_name');

-- Zero rows affected, not an error: the policy filters the row out before the
-- update is considered.
with attempted as (
  update public.profiles set display_name = 'hacked'
   where id = '22222222-2222-2222-2222-222222222222'
  returning 1
)
select is((select count(*) from attempted), 0::bigint,
  'A updating B''s profile affects zero rows');

-- The grant gate, observed from the client side this time.
select throws_ok(
  $$ update public.profiles set id = '33333333-3333-3333-3333-333333333333' $$,
  '42501', null,
  'A may not UPDATE profiles.id — refused at the column-privilege gate');

select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('11111111-1111-1111-1111-111111111111','admin') $$,
  '42501', null,
  'A may not INSERT a role for themselves — no self-promotion to admin');

select throws_ok(
  $$ insert into public.profiles (id, display_name)
     values ('44444444-4444-4444-4444-444444444444','forged') $$,
  '42501', null,
  'A may not INSERT a profile — the trigger owns that');

reset role;

-- ---------------------------------------------------------------------------
-- As an anonymous caller
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select count(*) from public.profiles $$,
  '42501', null,
  'anon may not read profiles at all — refused at the grant gate');
select throws_ok(
  $$ select count(*) from public.user_roles $$,
  '42501', null,
  'anon may not read user_roles at all');

reset role;
select * from finish();
rollback;
