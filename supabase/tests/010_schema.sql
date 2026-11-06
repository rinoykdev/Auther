-- 010 — schema shape, and the columns that must NOT exist.
begin;
select plan(25);

select has_table('public', 'profiles',   'profiles exists');
select has_table('public', 'user_roles', 'user_roles exists');

-- profiles columns
select has_column('public','profiles','id','profiles.id');
select col_type_is('public','profiles','id','uuid','profiles.id is uuid');
select col_is_pk('public','profiles','id','profiles.id is the primary key');
select has_column('public','profiles','display_name','profiles.display_name');
select has_column('public','profiles','avatar_url','profiles.avatar_url');
select has_column('public','profiles','created_at','profiles.created_at');
select has_column('public','profiles','updated_at','profiles.updated_at');

-- The absences (D.2). These are assertions about security design, not tidiness:
-- an email column makes any future broad read policy an address directory, and
-- a role column makes escalation a column-grant problem.
select hasnt_column('public','profiles','email',
  'profiles has NO email column — it would be an enumeration hole (D.2)');
select hasnt_column('public','profiles','role',
  'profiles has NO role column — roles live in user_roles (D.7)');
select hasnt_column('public','profiles','deleted_at',
  'profiles has NO deleted_at — deletion is permanent (D8)');

-- user_roles columns
select has_column('public','user_roles','user_id','user_roles.user_id');
select has_column('public','user_roles','role','user_roles.role');
select has_column('public','user_roles','granted_by','user_roles.granted_by');
select has_column('public','user_roles','granted_at','user_roles.granted_at');
select col_is_pk('public','user_roles', array['user_id','role'],
  'user_roles PK is (user_id, role) — a role cannot be granted twice');

-- The enum, and exactly which values it holds. A third value appearing here
-- without a decision is a change to the authorization model (O8).
select has_type('public','app_role','app_role enum exists');
select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role'),
  array['user','admin'],
  'app_role holds exactly user and admin');

-- Cascades. Milestone 12 (account deletion) assumes these; proving it now is
-- far cheaper than discovering it then.
select col_is_fk('public','profiles','id','profiles.id is a foreign key');
select col_is_fk('public','user_roles','user_id','user_roles.user_id is a foreign key');
select ok(
  (select bool_or(pg_get_constraintdef(oid) like '%ON DELETE CASCADE%')
     from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f'),
  'profiles.id cascades on delete');

-- bool_or over the matching constraints rather than a bare subquery: two
-- foreign keys on user_roles (user_id and granted_by) and a scalar subquery
-- would raise "more than one row" instead of asserting anything.
select ok(
  (select bool_or(pg_get_constraintdef(oid) like '%ON DELETE CASCADE%')
     from pg_constraint
    where conrelid = 'public.user_roles'::regclass and contype = 'f'
      and conname like '%user_id%'),
  'user_roles.user_id cascades on delete');

-- The NAMED length check, not merely "some check exists" — the name is what a
-- later migration would have to go out of its way to remove.
select ok(
  exists (select 1 from pg_constraint
           where conrelid = 'public.profiles'::regclass
             and contype = 'c'
             and conname = 'profiles_display_name_length'),
  'the display_name length CHECK exists by name');
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000aa','len@test.dev');

select throws_ok(
  $$ update public.profiles set display_name = repeat('x', 81)
      where id = '00000000-0000-0000-0000-0000000000aa' $$,
  '23514', null, 'display_name over 80 characters is rejected');

select * from finish();
rollback;
