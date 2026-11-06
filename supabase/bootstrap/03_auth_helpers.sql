-- =============================================================================
-- Bootstrap 03 — the auth.* helpers that policies depend on
-- =============================================================================
-- H.6 condition 3, and the sharpest edge of parity drift (H.6.1 category 4).
--
-- `(select auth.uid()) = id` IS the policy. If these stubs differ from
-- Supabase's in null-handling, every RLS test here validates the wrong
-- semantics while passing — which is why H.6.1 compares their BEHAVIOUR under
-- fixed claim fixtures, not merely their existence.
--
-- The shape below mirrors Supabase's published definitions: read the JWT
-- claims GUC that PostgREST sets per request, and return NULL when it is
-- absent or empty rather than raising. NULL is the safe answer: a policy
-- comparing `null = id` yields NULL, which is not true, so the row is denied.
-- =============================================================================

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role()
  to anon, authenticated, service_role;
