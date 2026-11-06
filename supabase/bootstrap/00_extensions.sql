-- =============================================================================
-- Bootstrap 00 — extensions
-- =============================================================================
-- Runs ONLY against the disposable CI container (architecture H.6). It is never
-- applied to a Supabase project, which ships these already.
-- =============================================================================

create extension if not exists pgtap;
create extension if not exists pgcrypto;
