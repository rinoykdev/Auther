# Milestone 3 — owner runbook

The two steps I cannot do for you, with exact commands. Everything else in
Milestone 3 runs in CI.

**Why these are yours.** Both need privileged database access to the Supabase
project. Architecture H.6 condition 6 keeps that credential out of CI and out of
this repository, and I do not need it either — nothing in this runbook asks you
to send me a key.

---

## Step 6 — apply the migration to the development project

**Do this only after CI's `database` job is green**, so the SQL has already been
applied, tested and rolled back against a disposable copy.

### The easy route — dashboard SQL editor

1. Open the project → **SQL Editor** → **New query**.
2. Paste the contents of **`supabase/bootstrap/04_default_privileges.sql`** and
   run it.

   This one bootstrap file is meant for the cloud project too. It narrows
   Supabase's stock default privileges so that a future migration which forgets
   its GRANTs fails **closed** rather than quietly opening a table to everyone.
   The other bootstrap files are reconstruction only — **do not run them here**;
   the real project already has its roles, its `auth` schema and its helpers.
3. Paste the contents of **`supabase/migrations/0001_profiles_and_roles.sql`**
   and run it.
4. Expect: `Success. No rows returned.`

### Or with `psql`, if you prefer

Connection string: **Project Settings → Database → Connection string → URI**.
It contains your database password — do not paste it into chat, a commit, or a
file in this repository.

```bash
psql -v ON_ERROR_STOP=1 "$CONN" -f supabase/bootstrap/04_default_privileges.sql
```

```bash
psql -v ON_ERROR_STOP=1 "$CONN" -f supabase/migrations/0001_profiles_and_roles.sql
```

### Immediately after — verify it landed

Re-running the checks against the real project matters: "it passed in the
container" is precisely the claim the parity procedure exists to doubt.

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

Expect both `profiles` and `user_roles` with `rowsecurity = true`. Then:

```sql
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where grantee in ('anon','authenticated') and table_schema = 'public'
 order by grantee, table_name;
```

Expect **only** `authenticated`: `SELECT` on both tables, plus `UPDATE` on
`profiles`. **`anon` must not appear at all.** If it does, stop — the default
privileges were not narrowed, and the publishable key's conditional safety (E.5)
does not currently hold.

### Then tell me

I'll run the end-to-end check: sign up through the Auth API, confirm no session
is returned, confirm the profile row carries the name that was sent and the role
row says `user`, and confirm a second account can read neither. I'll need two
disposable email addresses, as in Milestone 2 — I won't invent them.

---

## Step 7 — the parity check (H.6.1)

Run after Step 6. This compares the CI reconstruction against the real platform
and is triggered here by **P2 and P3** — this milestone creates both the
bootstrap and the first database objects.

1. Download `parity-ci.txt` from the latest green CI run: **Actions → the run →
   Artifacts → `parity-ci`**.
2. Produce the cloud half locally:

```bash
psql -v ON_ERROR_STOP=1 -tA "$CONN" -f supabase/parity/collect.sql > parity-cloud.txt
```

3. Diff them:

```bash
diff parity-ci.txt parity-cloud.txt
```

**Pass condition: an empty diff.** Not a visual comparison — a difference in one
column of one role is exactly what the eye skips.

### Expect a non-empty first run

The bootstrap is written from documentation; the cloud project is the real
thing. The first comparison is how the reconstruction gets corrected. A clean
first run would be more surprising than a dirty one.

Send me the diff — it contains catalogue metadata (role names, privileges,
policy expressions), no secrets and no user data. I'll classify each line per
H.6.1: either our reconstruction is wrong, or the cloud project has drifted. The
remedies differ, which is why classification comes before fixing.

**The rule that binds while a diff is open:** every pgTAP result covering a
diverged object is **unproven** until the diff is closed. A passing suite over a
diverged object is not evidence.

---

## Step 5b — branch protection (repository settings, also yours)

Once `database` has run green once, make it required:

**Settings → Branches → Add branch ruleset** (or *Add rule* on older UIs) →
branch `main` → **Require status checks to pass** → add:

- `Lint, build, test`
- `Secret scan`
- `Database — GRANTs and RLS`

Without this the suite still runs, but a red run can be merged — which makes it
a report rather than a gate, and H.5 requires a gate.

---

## What is NOT in this runbook, deliberately

- **Creating an admin.** No application path grants it (requirement 10). When
  you want one, it is register → confirm the email → one explicit `insert` with
  `granted_by` set, run from the SQL editor, recorded in the project log. The
  procedure is architecture D.7.1, and it stays manual on purpose.
- **Anything involving the secret key.** Nothing in Milestone 3 needs it.
