-- =============================================================================
-- 0001 — rollback
-- =============================================================================
-- Rehearsed in CI, not assumed: apply, roll back, assert the database matches
-- its bootstrap state, re-apply, and assert the suite still passes. An
-- untested rollback is a rollback that fails the first time it is needed.
--
-- WHAT THIS CANNOT RECOVER: dropping the tables destroys their rows. That is
-- harmless in Milestone 3 — the tables are new and hold nothing — and stops
-- being harmless at the first release, when the correct response to a bad
-- migration becomes a FORWARD fix. These .down files are a development-time
-- tool (plan §8).
--
-- Dependency order: triggers, then functions, then tables, then the enum last,
-- since both tables depend on it.
-- =============================================================================

drop trigger if exists on_auth_user_created  on auth.users;
drop trigger if exists set_profiles_updated_at on public.profiles;

drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();

drop table if exists public.user_roles;
drop table if exists public.profiles;

drop type if exists public.app_role;
