# Security — credential and access rules

The operational rules for this project, in one place. Design rationale lives in
`architecture.md` sections E.1–E.7; this file is what to actually do.

---

## The two keys

| Key | Where it may live | In the browser? |
| --- | --- | --- |
| **Publishable** (`sb_publishable_…`, formerly "anon") | `.env.local`, host env vars when deployment happens | **Yes** — by design |
| **Secret / service-role** (`sb_secret_…`) | **Only** Supabase Edge Function secrets | **Never** — it bypasses RLS entirely |

### The publishable key is safe — conditionally

It is designed to ship in frontend JavaScript and it will appear in `dist/`.
That is correct, **not** a leak.

But its safety is a *consequence of configuration*, not a property of the key.
The key grants nothing by itself; it identifies the project and selects a
database role. It is safe **only while all of the following hold**:

1. **RLS is enabled on every table** in every client-exposed schema — including
   tables added later, and tables created through the dashboard.
2. **Policies permit only what we intend**, written per command, with
   `WITH CHECK` on writes.
3. **GRANTs are narrow** — `anon` and `authenticated` hold only the table and
   column privileges they need.
4. **No `SECURITY DEFINER` function, view or exposed schema** routes around
   1–3 — in particular, nothing that selects from `auth.users`.
5. **No secret key is present** in any client bundle or build-visible variable.

If any one of these is false, the publishable key is not "safe with a small
problem" — it is a public credential that reads or writes whatever the gap
allows. **The repository is public and the database is reachable from the
internet**, so a gap is reachable from anywhere.

> **Current status:** the database has no tables, so nothing is exposed. This
> becomes load-bearing the moment Milestone 3 creates the first table.

---

## Rules

### Never
- Put the secret key in a `VITE_` variable, frontend file, or this repository.
- Commit `.env.local` or any real `.env` file.
- Share credentials over chat, email, or a commit.
- Merge a table without RLS, GRANTs and tests for both gates in the same
  migration (architecture checklist item 14).
- Test against production data.

### Always
- Keep `.env.local` git-ignored. It is ignored **before** it is created.
- Use a separate **development** project.
- Rotate immediately if a secret is exposed. **Removing it from the working tree
  or from Git history is not sufficient** — assume it was captured.
- Enable MFA on the Supabase and GitHub accounts. The dashboard is a privileged
  surface protecting a real database.

---

## Automated enforcement

CI (`.github/workflows/ci.yml`) fails the build on:

| Check | What it catches |
| --- | --- |
| Tracked env files | Any real `.env` committed (`.env.example` is allowed — placeholders only) |
| Secret-shaped strings in tracked files | `sb_secret_…`, `service_role`, JWT-shaped strings. `docs/` is excluded: it discusses these names by design |
| **Git history scan** | A key committed and later deleted. Still compromised, still found |
| `npm run scan:dist` | Secret-shaped strings in the built bundle. The publishable key appearing there is expected and ignored |

The scanners report findings **without printing the value** — CI logs are not a
place to republish a leaked secret.

### What CI does not catch

The environment guard in `src/lib/supabaseClient.js` is a **runtime** error. The
build succeeds with no `.env.local` at all, because Vite does not execute
modules while bundling. It protects a developer starting the app; it will not
catch a misconfigured deployment. Worth remembering when deployment is
addressed.

---

## Known limitation: leaked-password protection

**Not available on the current Supabase plan** (confirmed 2026-11-06). Passwords
appearing in public breach corpora are accepted, provided they meet the 10
character minimum.

Architecture E.1 commits to enabling this. Until the plan allows it, or a
server-side equivalent exists, **this project does not meet E.1 in full** — a
fact worth stating plainly rather than letting the checklist imply otherwise.

The practical exposure is credential stuffing. Password length does not mitigate
it. Options and the production requirement are in `supabase-config.md`.

---

## Known limitation: email-membership inference on email change

**Reduced, not eliminated.** Recorded here because the wording that reduces it
could easily be mistaken for a fix.

### What the system does well

Sign-up, login and password reset are all designed so that **no response
distinguishes a registered address from an unregistered one**. `errorMessages.js`
collapses every credential failure into one string; `SignUpPage` ignores
`data.user.identities` entirely, even though it marks the duplicate case;
`CheckEmailPage` is phrased so that every line is true for both users. That is
architecture H.3 Family 3, and it holds.

### Where it does not hold

**Changing an email address to one that is already registered.** Supabase Auth
refuses with `422 email_exists` — verified in the `supabase/auth` source
(`internal/api/user.go`, read 2026-11-13), where the duplicate check runs before
the update and returns a distinct error code.

**We cannot suppress it.** The server refuses the change, so the form has to say
something or it appears broken. There is no third option in which the user is
told nothing and the product still works.

### What we do instead

One fixed message, approved as decision **D-F**:

> **"That address can't be used. Try a different one."**

It is true, it is actionable, and it does not state that an account exists.

### The residual exposure, stated plainly

**A signed-in user can still infer membership.** They type an address, read the
refusal, and conclude the address is probably registered. The message does not
confirm it — "can't be used" is also what a malformed or blocked address would
produce — but the inference is available and we are not pretending otherwise.

What limits it is **not** the wording:

| | |
| --- | --- |
| **Authentication required** | The attacker must hold a confirmed account. Anonymous enumeration, the cheap kind, is not possible |
| **One address per attempt** | No batch interface exists |
| **Rate limited** | The attempt goes through Supabase Auth's limits |
| **Self-identifying** | The attempts are attached to a real account and appear in the audit log |

**This is an accepted residual, not a closed issue.** Three things follow:

1. **No document, commit message or release note may claim that account
   enumeration is fully prevented.** The accurate claim is that the *sign-up,
   login and reset* flows do not disclose membership, and that email change
   leaves an authenticated, rate-limited inference.
2. If `email_exists` ever becomes reachable from an **unauthenticated** path,
   this stops being a residual and becomes a defect.
3. It is deliberately **not** on the production release gate below. The gate is
   for controls that must exist before launch; this is a limitation accepted
   with its reasons recorded. Writing it here rather than there is a judgement
   that it is tolerable — not an oversight, and reversible if you disagree.

---

## Production release gate

**Nothing here may be ticked by explanation.** An item closes when the control
exists and has been tested — not when the reason it is missing is well
understood. This list is the reason a limitation cannot quietly become a
footnote between now and launch.

| # | Requirement | Status | Closes when |
| --- | --- | --- | --- |
| **D12** | **Credential-stuffing / leaked-password protection** (architecture E.1) | 🔴 **OPEN — not satisfied** | Supabase's leaked-password check is enabled on a paid plan, **or** a server-side equivalent rejects breached passwords at the boundary. **Neither a longer minimum length nor a client-side breach check closes this**, and neither may be recorded as mitigation |
| **P1** | **Supabase Cloud parity verification** (architecture H.6.1) | ⬜ Not yet due — first runs before the first release | The parity check runs against the production project with an **empty diff** across migrations, roles, privileges and `auth.*` helpers |
| E.6 | Security headers — CSP, `frame-ancestors`, `Referrer-Policy` | ⬜ Deferred with hosting (checklist item 22, Milestone 14) | Headers are configured at the hosting layer and verified on the deployed site |
| H.3 | All four security test families pass against the production configuration | ⬜ Milestone 8 | Every family runs green, with the test report recorded |

**D12 is the one at risk of being lost**, because it is the only item here whose
blocker is commercial rather than technical — and those are the items that get
reclassified as acceptable on the day of a release. It stays red until the
control exists.

---

## If a key is exposed

1. **Rotate it in the Supabase dashboard immediately.** Do this first.
2. Remove it from the code and commit.
3. Assume the old value was captured. Git history is public and is scraped.
4. If it was the **secret** key: review the project's data and auth logs — that
   key bypasses every policy.
5. Record what happened and what changed as a result.

A publishable key does not need rotating on exposure; it is public by design.
What matters after exposing one is confirming conditions 1–5 above still hold.

---

## Sharing with another developer

They obtain the project URL and publishable key **themselves** from the Supabase
dashboard, or receive them through a password manager. Never through chat,
email, or a commit. They never receive the secret key.

See `onboarding-another-developer.md`.
