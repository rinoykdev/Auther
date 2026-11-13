-- =============================================================================
-- Bootstrap 04 — narrow the default privileges
-- =============================================================================
-- E.4's "revoke first, grant narrowly" rule, applied to the DEFAULTS.
--
-- Supabase's stock setup grants broad privileges on newly created objects in
-- `public` to anon and authenticated. Left alone, a future migration that
-- forgets its GRANTs would open its table to everyone — failing OPEN, silently.
-- After this, such a migration fails CLOSED instead: the table is simply
-- unreachable until someone grants deliberately.
--
-- -----------------------------------------------------------------------------
-- WHY BOTH GLOBAL AND SCHEMA-SCOPED ENTRIES (revision 2)
-- -----------------------------------------------------------------------------
-- pg_default_acl rows are keyed by (defaclrole, defaclnamespace, defaclobjtype),
-- where defaclnamespace = 0 means "every schema". A new object's ACL is built
-- from PostgreSQL's hardwired default, then the global entry, then the
-- schema-specific entry.
--
-- The schema-scoped revoke SHOULD therefore win inside `public`. We do not rely
-- on that:
--
--   * the schema-scoped entries cover `public` only, so a function created in
--     any other schema still receives the hardwired EXECUTE TO PUBLIC;
--   * both layers say REVOKE, so there is no ordering conflict to resolve;
--   * and the outcome is MEASURED, not reasoned about — see the probe in
--     supabase/verify/01_post_migration.sql, which creates a throwaway object
--     and reads back its real ACL.
--
-- -----------------------------------------------------------------------------
-- THE LOAD-BEARING LINE
-- -----------------------------------------------------------------------------
-- `revoke execute on functions from public`.
--
-- anon and authenticated are NOT granted EXECUTE on new functions as
-- themselves — they receive it through PUBLIC, and every role is implicitly a
-- member of PUBLIC. That membership cannot be revoked. Revoking from anon and
-- authenticated BY NAME therefore leaves both still able to execute, via
-- PUBLIC. Those lines are kept because they undo Supabase's own shipped
-- entries, but they are not what closes the hole.
--
-- -----------------------------------------------------------------------------
-- ROLE SCOPE
-- -----------------------------------------------------------------------------
-- With no FOR ROLE clause these entries apply only to objects created by the
-- role that RUNS this file. They must therefore be run by the same role that
-- applies the migration. Pre-flight query 4 prints current_user and
-- session_user so this can be confirmed rather than assumed; pre-flight query 1
-- lists which roles already own entries.
--
-- -----------------------------------------------------------------------------
-- DELIBERATELY NOT REVOKED: TYPES
-- -----------------------------------------------------------------------------
-- PostgreSQL also default-grants USAGE on new TYPES to PUBLIC. That is left
-- alone on purpose. Reading a column whose type is public.app_role requires
-- USAGE on that type — revoking it would break `select role from user_roles`
-- for authenticated, i.e. the enum would fail closed against its own
-- legitimate reader. Type USAGE conveys no access to data.
--
-- This is the one bootstrap file whose real target is the cloud project too.
-- Applying it there is part of Milestone 3 Step 6, and the parity check
-- compares the resulting state (H.6.1 category 3).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- LAYER 1 — GLOBAL (every schema, including ones that do not exist yet)
-- -----------------------------------------------------------------------------
alter default privileges
  revoke execute on functions from public;

alter default privileges
  revoke all on tables from anon, authenticated;

alter default privileges
  revoke all on sequences from anon, authenticated;

alter default privileges
  revoke all on functions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- LAYER 2 — SCHEMA-SCOPED (public), applied last, so it wins any merge
-- -----------------------------------------------------------------------------
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges in schema public
  revoke all on functions from anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public;
