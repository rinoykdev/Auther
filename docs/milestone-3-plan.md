# Milestone 3 — Database foundation: implementation plan

**For approval. Nothing in this document has been executed.** No migration has
been written or run, no object exists in Supabase Cloud, and the CI workflow is
unchanged.

| | |
| --- | --- |
| Milestone | 3 — `profiles`, the new-user trigger, GRANTs and RLS, pgTAP in CI |
| Authority | `architecture.md` D.2, D.4, E.3, E.4, H.3, H.6, H.6.1; decisions D10, D13, D16 |
| Governing rule | **Checklist item 14** — no table ships without RLS, GRANTs and tests for both gates **in the same migration** |
| Out of scope | Every authentication flow (Milestone 4+), `user_roles` (Milestone 10), account deletion (Milestone 12), deployment (Milestone 14) |

---

## 0. What this milestone is actually for

One table and one trigger is a small amount of SQL. The milestone is not the SQL —
it is establishing that **both gates are tested separately**, that a future table
cannot ship without them, and that the test environment is trustworthy enough for
a green result to mean something. Everything below serves that.

The ordering is deliberate: **the test harness is built before the table exists**
(Step 2 before Step 4), so the first run of the suite is against an empty database
and must *fail* in the ways we predict. A suite written after the schema tends to
assert whatever the schema happens to do.

---

## 1. Steps, in order

Each step stops for your checkpoint, per the standing working rules.

| Step | What it does | Touches Supabase Cloud? |
| --- | --- | --- |
| 1 | Repository scaffolding: `supabase/` layout, migration naming, tooling decision | No |
| 2 | CI database bootstrap + pgTAP harness, proven to fail | No |
| 3 | Migration `0001` written and reviewed — schema, trigger, GRANTs, RLS in one file | No |
| 4 | pgTAP suite written against `0001`, run in the container | No |
| 5 | GitHub Actions integration; both gates become required checks | No |
| 6 | **Apply `0001` to Supabase Cloud development** — the first step that changes the database | **Yes** — on your approval |
| 7 | Parity check (H.6.1) between the CI reconstruction and the cloud project | Read-only against cloud |
| 8 | Milestone 3 test report; rollback rehearsal recorded | No |

---

## 2. Step 1 — Repository scaffolding

```
supabase/
  migrations/
    0001_profiles.sql            -- the single Milestone 3 migration
    0001_profiles.down.sql       -- its rollback (§8)
  bootstrap/
    00_extensions.sql            -- pgtap, pgcrypto
    01_roles.sql                 -- anon, authenticated, service_role
    02_auth_schema.sql           -- auth schema + auth.users shape we depend on
    03_auth_helpers.sql          -- auth.uid(), auth.jwt(), auth.role()
    04_default_privileges.sql    -- the ALTER DEFAULT PRIVILEGES fix (E.4)
  tests/
    010_schema.sql               -- table, columns, constraints
    020_grants.sql               -- gate 1, in isolation
    030_rls.sql                  -- gate 2, in isolation
    040_trigger.sql              -- new-user profile creation
    050_definer_audit.sql        -- SECURITY DEFINER audit (H.3 Family 2)
    060_rls_enabled_sweep.sql    -- every table in public has RLS on
  parity/
    collect.sql                  -- the H.6.1 catalogue query, run against both
```

**Decision for you — O6: the pinned image version.** H.6 condition 1 requires an
exact `supabase/postgres` tag, never `latest`. I will propose a specific version
at this step, chosen to match the PostgreSQL major version the development
project reports. I will not pick it silently, and I will not pick a moving tag.

**No Supabase CLI.** Migrations are plain SQL files applied with `psql`. The CLI's
value is the local stack, which D1 removed; adding it back would reintroduce a
Docker-shaped dependency for no benefit here.

---

## 3. Step 2 — The CI database bootstrap, proven to fail first

This is the reconstruction H.6 condition 3 requires, and the thing H.6.1 exists to
keep honest.

**What is recreated, and why each matters**

| Object | Why a policy depends on it |
| --- | --- |
| Roles `anon`, `authenticated`, `service_role` | PostgREST switches to the role in the `role` claim. Wrong attributes here make every RLS test meaningless — in particular **`NOBYPASSRLS` must be explicit** on `anon` and `authenticated` |
| Schema `auth`, and the columns of `auth.users` we reference | The foreign key and the trigger attach to it |
| `auth.uid()`, `auth.jwt()`, `auth.role()` | `(select auth.uid()) = id` *is* the policy. If the stub's null-handling differs from Supabase's, the policy is tested against the wrong semantics |
| `ALTER DEFAULT PRIVILEGES` state | E.4 requires defaults narrowed so a migration that forgets its GRANTs fails closed |

Policies are exercised by setting the request JWT claims the way PostgREST does
(`set local role authenticated; set local request.jwt.claims = '…'`), so a test
runs as the real database role under a real claim set, not as a superuser
pretending.

**The harness is proven before it is trusted.** Milestone 2 established that a
suite which has never failed is not known to work. Before any schema exists:

1. Run the suite against the empty database → it must **fail**, naming missing
   objects. A green run here means the tests assert nothing.
2. Add a table with RLS deliberately **off** → `060_rls_enabled_sweep.sql` must
   fail. Then remove it.
3. Grant `authenticated` an `UPDATE` it should not have → `020_grants.sql` must
   fail. Then revoke it.

Each is recorded in the test report with its output.

---

## 4. Step 3 — Migration `0001_profiles.sql`

One file, four concerns, in this order. Splitting them across migrations is how a
table ships with a gate missing.

**4.1 Schema** (D.2)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` primary key | `references auth.users(id) on delete cascade` — the cascade is what makes Milestone 12 clean |
| `display_name` | `text` | `check (char_length(display_name) between 1 and 80)`. Stored as text and rendered as text (H.3 XSS basics) |
| `avatar_url` | `text`, nullable | Storage deferred; the column is not |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | Maintained by trigger, **not** by the client |

**Explicitly absent, and these absences are tested:** no `email` or any other
column mirrored from `auth.users` (an enumeration hole created by schema rather
than policy); no role or entitlement column (D.7); no `deleted_at` (D8).

**4.2 The new-user trigger** (D.4)

`handle_new_user()` — `after insert on auth.users`, `security definer`, with:

- **`set search_path = ''`** and every identifier schema-qualified. An unqualified
  `search_path` in a definer function is a known privilege-escalation vector; this
  is asserted by `050_definer_audit.sql`, not merely intended.
- **`revoke execute … from public`**, granted to no client role. It is invoked by
  the trigger, never by a caller.
- `insert … on conflict (id) do nothing`, so a replayed insert is not an error.
- `display_name` taken from `raw_user_meta_data->>'display_name'`, falling back to
  a neutral default. **Never from the email local-part** — that would reintroduce
  the email into a readable table by the back door.

Plus `set_updated_at()` — a `before update` trigger. `updated_at` is set
server-side precisely because the client holds `UPDATE` on `display_name` and
`avatar_url` only, and so cannot set it.

**4.3 GRANTs — gate 1** (E.4)

```
revoke all on public.profiles from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
-- anon: nothing. No INSERT (the trigger does it). No DELETE (cascade does it).
```

Column-level `UPDATE` is the load-bearing line: `id` and `created_at` cannot be
written even by a correctly-shaped request that satisfies every policy.

**4.4 RLS — gate 2** (E.3)

```
alter table public.profiles enable row level security;
alter table public.profiles force row level security;   -- applies to the owner too
```

Separate policies per command, never `FOR ALL`:

| Policy | Command | Clause |
| --- | --- | --- |
| `profiles_select_own` | `SELECT` | `using ((select auth.uid()) = id)` |
| `profiles_update_own` | `UPDATE` | `using ((select auth.uid()) = id)` **and** `with check ((select auth.uid()) = id)` |

No `INSERT` policy and no `DELETE` policy — with RLS on, their absence is a denial.
The `WITH CHECK` is not decorative: without it a user could update their row into
a state the policy no longer matches.

---

## 5. Step 4 — The pgTAP suite

**Gate 1 and gate 2 are tested separately and must be able to fail
independently.** A test that passes only because RLS caught what a missing GRANT
should have caught would start failing open the day the GRANT plan changes, and
nothing would say so.

| File | Asserts |
| --- | --- |
| `010_schema.sql` | Columns, types, PK, FK with `ON DELETE CASCADE`, the length check — **and that no `email`, role or `deleted_at` column exists** |
| `020_grants.sql` | The complete E.4 matrix via `has_table_privilege` / `has_column_privilege`, for both roles, **asserting the negatives explicitly**: `anon` has nothing; `authenticated` has no `INSERT`, no `DELETE`, and no `UPDATE` on `id` or `created_at`. Any new grant appearing without being added here fails the build |
| `030_rls.sql` | Under a real `authenticated` role with user A's claims: A sees exactly one row; A sees zero of B's; A cannot update B's row; `WITH CHECK` blocks A from reassigning `id`; `anon` sees zero rows (H.3 Family 1) |
| `040_trigger.sql` | Inserting into `auth.users` creates exactly one profile row; a duplicate insert does not error; **deleting the user removes the profile** (cascade, proving the Milestone 12 assumption now rather than then) |
| `050_definer_audit.sql` | Every `SECURITY DEFINER` function in the database has a non-empty fixed `search_path` and no `EXECUTE` grant to `public` |
| `060_rls_enabled_sweep.sql` | **No table in `public` has `rowsecurity = false`.** One test that catches every future table which forgets RLS |

Files `050` and `060` are schema-wide, not `profiles`-specific. They are written
now because their value is entirely in the tables that do not exist yet.

**Coverage of H.3 that this milestone can discharge:** Family 1's database cases,
Family 2's grant-gate, RLS-regression, definer-audit and column-grant cases, and
Family 3's "no email column to read". The HTTP-level cases in Families 1–4 need
running auth flows and stay with Milestone 4+ — stated so the test report does not
imply more coverage than exists.

---

## 6. Step 5 — GitHub Actions integration

A third job, `database`, alongside the existing `verify` and `secrets`:

```yaml
  database:
    name: Database — GRANTs and RLS
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:<pinned exact version>   # O6, never `latest`
        env:
          POSTGRES_PASSWORD: postgres        # ephemeral, local to the runner
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - name: Bootstrap   # supabase/bootstrap/*.sql in order
      - name: Apply migrations   # supabase/migrations/*.sql in order
      - name: Run pgTAP   # pg_prove supabase/tests/*.sql
      - name: Upload catalogue snapshot   # the CI half of the H.6.1 parity diff
```

**The credential rule, restated because this is where it would be violated:**
`POSTGRES_PASSWORD` here is a throwaway for a container that exists for the
duration of one run. **No Supabase URL, publishable key or secret key is added to
Actions** (H.6 condition 6). If a future change appears to need one, that is the
signal to re-read H.6, not to add the secret.

The CI comment stating "No Docker, no service containers" becomes false at this
step and will be rewritten rather than left to mislead.

**`database` becomes a required check**, with `verify` (H.5). I will tell you
where to set this in the GitHub branch-protection UI — I cannot and will not
change repository settings myself.

---

## 7. Step 6 — Applying to Supabase Cloud

**The first destructive-capable step, and it waits for your explicit approval.**

- Applied with `psql` against the **development** project, migrations in order.
- Prerequisite: the full suite green in CI against the identical migration file.
- Immediately after: re-run `060_rls_enabled_sweep.sql` and `020_grants.sql`
  **against the cloud project**, because "it passed in the container" is the exact
  claim H.6.1 exists to doubt.
- Then one end-to-end check with a disposable account: sign up, confirm the
  profile row appears with the right `display_name`, confirm a second account
  cannot read the first through PostgREST with its own token, then delete the
  accounts and verify as in Milestone 2.

---

## 8. Migration and rollback strategy

**Forward.** Numbered, immutable, applied in order. **A migration that has been
applied anywhere is never edited** — a correction is a new migration. Editing an
applied file is how the CI reconstruction and the cloud project silently diverge,
which is the H.6.1 failure mode arriving by our own hand.

**Backward.** Every migration ships with a `.down.sql` beside it, and
`0001_profiles.down.sql` drops the policies, triggers, functions and table in
dependency order.

**The rollback is rehearsed, not assumed.** In CI, on the container: apply
`0001`, apply `0001.down`, assert the database matches its bootstrap state, then
apply `0001` again and assert the suite still passes. An untested rollback is a
rollback that fails the first time it is needed.

**What rollback cannot recover.** Dropping `profiles` destroys its rows. For
Milestone 3 this is harmless — there is no production data and the table is new —
and I am stating it now because it stops being harmless at the first release, when
the correct response to a bad migration becomes a forward fix, not a down
migration. The `.down.sql` files are a development-time tool and are recorded as
such.

**Drift prevention.** Nothing is created through the Supabase dashboard. A table,
policy or grant made by hand is invisible to review, absent from the CI
reconstruction, and will surface as a parity diff rather than as the mistake it
was.

---

## 9. Step 7 — Parity verification (H.6.1)

Triggered here by **P2 and P3** — this milestone creates the bootstrap *and* the
first database objects.

- `parity/collect.sql` is run against both databases, producing a
  machine-comparable catalogue: applied migrations, role attributes, the full
  privilege matrix at table and column level, and the `auth.*` helpers' identity
  **and behaviour** under fixed claim fixtures (normal, absent, `null`, malformed).
- **Pass condition: an empty diff.** Not a visual comparison.
- The cloud half is run **by you, locally**, since it needs privileged read access
  and no Supabase credential may enter CI. I will provide the exact command and
  will not ask for the key itself.
- Any diff follows H.6.1's ordered failure procedure, whose third step binds:
  **every pgTAP result covering a diverged object is unproven until the diff is
  closed.**

I expect a diff on the first run. The bootstrap is written from documentation and
the cloud project is the real thing; the first comparison is how the
reconstruction gets corrected. A clean first run would be more surprising than a
dirty one.

---

## 10. Definition of done

1. `0001` applied to the development project, with GRANTs and RLS in the same file.
2. The pgTAP suite green in CI, **and demonstrated to fail** when a grant or a
   policy is deliberately wrong.
3. `database` a required check on `main`.
4. Rollback rehearsed in CI.
5. Parity diff empty, or every difference classified and closed per H.6.1.
6. Test report written: what passed, what failed, **what remains untested**.
7. No Supabase credential in GitHub Actions.

---

## 11. Risks I want recorded before you approve

| # | Risk | Handling |
| --- | --- | --- |
| 1 | **`auth.*` helper fidelity.** A stub whose null-handling differs from Supabase's tests the policy against the wrong semantics — a green suite over a wrong belief | H.6.1 category 4 compares behaviour under fixed fixtures, including the `null` and malformed cases. This is the sharpest edge in the milestone |
| 2 | **`auth.users` shape** is Supabase's, not ours, and may change | We reference the minimum: `id` and `raw_user_meta_data`. The trigger test runs against the real project in Step 6, not only the reconstruction |
| 3 | **Trigger failure blocks sign-up.** A raised exception in `handle_new_user` aborts the `auth.users` insert — registration breaks in Milestone 4 and looks like an auth bug | `on conflict do nothing`, no dependency on optional metadata, and an explicit test that a user with no `display_name` metadata still gets a row |
| 4 | **`ALTER DEFAULT PRIVILEGES` may behave differently** in the container than in the cloud project, where Supabase sets its own defaults | Asserted in `020_grants.sql` and compared in the parity check. A difference here means future tables fail *open* in one environment |
| 5 | Repository settings for required checks are yours, not mine | I will give exact instructions; I will not touch repository settings |
| 6 | **Parity is checked, not guaranteed.** PostgREST's own role-switching and JWT parsing are outside the database and outside this check | Covered by the API-level suite against the real project, Milestone 4+. Named so it is not assumed covered here |

---

## 12. What I need from you

1. **Approval of this plan**, or the changes you want.
2. **A decision at Step 1 on O6**, the pinned image version — I will propose one.
3. **Explicit approval at Step 6** before anything is applied to Supabase Cloud.
4. **The parity run at Step 7**, from your own shell. No credential comes to me.
5. **Branch protection** set by you once the `database` job is green.
