-- =============================================================================
-- 040 — the new-user trigger (D.4)
-- =============================================================================
begin;
select plan(11);

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

update public.profiles set display_name = 'Ada L.'
 where id='aaaaaaaa-0000-0000-0000-000000000001';
select ok(
  (select updated_at > created_at from public.profiles
    where id='aaaaaaaa-0000-0000-0000-000000000001'),
  'updated_at advances on update, via the trigger');

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
