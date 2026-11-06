-- =============================================================================
-- 040 — the new-user trigger (D.4)
-- =============================================================================
begin;
select plan(14);

-- A user who supplied a name.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','named@test.dev',
   '{"display_name":"Ada Lovelace"}');

select is((select count(*) from public.profiles
            where id='aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint,
  'a new user gets exactly one profile row');
select is((select display_name from public.profiles
            where id='aaaaaaaa-0000-0000-0000-000000000001'), 'Ada Lovelace',
  'the display_name comes from raw_user_meta_data.display_name');
select is((select count(*) from public.user_roles
            where user_id='aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint,
  'and exactly one role row');

-- A user who supplied nothing. The trigger must not raise — an exception here
-- aborts the auth.users insert and breaks registration itself.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000002','bare@test.dev');

select is((select display_name from public.profiles
            where id='aaaaaaaa-0000-0000-0000-000000000002'), 'New user',
  'a user with no metadata still gets a profile, with the fallback name');
select is((select count(*) from public.user_roles
            where user_id='aaaaaaaa-0000-0000-0000-000000000002'), 1::bigint,
  'and still gets a role');

-- An empty or whitespace-only name is treated as absent rather than stored.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000003','blank@test.dev',
   '{"display_name":"   "}');
select is((select display_name from public.profiles
            where id='aaaaaaaa-0000-0000-0000-000000000003'), 'New user',
  'a whitespace-only name falls back rather than storing blanks');

-- The email must never leak into the profile by any route.
select is((select count(*) from public.profiles
            where display_name like '%@%'), 0::bigint,
  'no display_name was derived from an email address');

-- updated_at is maintained server-side, because the client cannot write it.
select ok(
  (select updated_at from public.profiles
    where id='aaaaaaaa-0000-0000-0000-000000000001') is not null,
  'updated_at is set on insert');

-- ---------------------------------------------------------------------------
-- The updated_at trigger
-- ---------------------------------------------------------------------------
-- WHAT THE PREVIOUS VERSION OF THIS TEST GOT WRONG, recorded because the
-- mistake is an easy one to make again:
--
--   it asserted `updated_at > created_at` after an UPDATE. That can never be
--   true here. `now()` is `transaction_timestamp()` — it is fixed for the
--   whole transaction — and this file runs inside a single begin/rollback. So
--   created_at (column default now()) and updated_at (trigger now()) are the
--   SAME value by construction, and the assertion failed even though the
--   trigger was working perfectly.
--
-- The trigger is NOT changed to satisfy it. Switching to clock_timestamp()
-- would make the old assertion pass while making the column worse: rows
-- updated together in one transaction would get slightly different stamps,
-- and `updated_at` would stop meaning "the transaction that last changed
-- this row". now() is the correct choice.
--
-- What is tested instead is the property that actually matters and that IS
-- observable here: the trigger fires, and it OWNS the column — a value
-- supplied by the writer is overwritten, not honoured. Advancement across
-- transactions then follows from now() differing per transaction, which is
-- PostgreSQL's contract rather than ours to re-test.

select has_trigger('public', 'profiles', 'set_profiles_updated_at',
  'the updated_at trigger is wired to profiles');

-- A deliberately absurd value, written by a superuser — a stronger case than
-- a client could even attempt, since `authenticated` holds no UPDATE
-- privilege on this column at all (E.4).
update public.profiles
   set display_name = 'Ada L.',
       updated_at   = timestamptz '1999-01-01'
 where id='aaaaaaaa-0000-0000-0000-000000000001';

select is(
  (select updated_at from public.profiles
    where id='aaaaaaaa-0000-0000-0000-000000000001'),
  transaction_timestamp(),
  'the trigger OVERWRITES a supplied updated_at with the transaction time');

select ok(
  (select updated_at from public.profiles
    where id='aaaaaaaa-0000-0000-0000-000000000001') > timestamptz '1999-01-01',
  'the supplied value did not survive');

select is(
  (select created_at from public.profiles
    where id='aaaaaaaa-0000-0000-0000-000000000001'),
  transaction_timestamp(),
  'created_at is untouched by the update — the trigger sets only updated_at');

-- The cascade. Milestone 12 depends on this; proving it now costs nothing.
delete from auth.users where id='aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*) from public.profiles
            where id='aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint,
  'deleting the user removes the profile (cascade)');
select is((select count(*) from public.user_roles
            where user_id='aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint,
  'and removes the role rows');

select * from finish();
rollback;
