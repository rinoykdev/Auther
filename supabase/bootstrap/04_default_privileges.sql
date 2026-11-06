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
-- This is the one bootstrap file whose real target is the cloud project too.
-- Applying it there is part of Milestone 3 Step 6, and the parity check
-- compares the resulting state (H.6.1 category 3).
-- =============================================================================

alter default privileges in schema public
  revoke all on tables from anon, authenticated;

alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges in schema public
  revoke all on functions from anon, authenticated;

-- EXECUTE on new functions is granted to PUBLIC by PostgreSQL itself, which is
-- how a SECURITY DEFINER function becomes callable by a client nobody intended
-- to call it. Revoked here as well as per-function in the migration (E.4).
alter default privileges in schema public
  revoke execute on functions from public;
