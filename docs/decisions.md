# Decision log

Decisions that shaped this project, with what prompted each and what it costs.
The authoritative statements live in `architecture.md`; this is the record of
*why*, and of what changed when evidence disagreed with a plan.

Decisions still open are at the bottom.

---

## Infrastructure

### D1 — Supabase Cloud, no local stack · **approved**, Milestone 2
All backend services run in Supabase Cloud; the frontend runs locally at
`localhost:5173`. **Docker is not a project dependency.**

*Costs accepted:* no reset button on a bad migration; shared mutable state
between developers; no offline work; free-tier projects pause after ~1 week
idle. Recorded in A.5.1.

*Superseded:* the original local Supabase CLI + Docker environment.

### D2 — Frontend deployment deferred · **approved**, Milestone 2
No hosting configured. Consequence: the CSP and framing headers in E.6 are
deferred with it, tracked as checklist item 22 and Milestone 14 — the easiest
item in the document to lose, since it belongs to a milestone that does not yet
exist.

### D3 — Public GitHub repository · **approved**, Milestone 2
Chosen by the user with the trade-off stated: the security design and the
not-yet-built list are public. No credentials are exposed. The consequence that
matters is that the publishable key's conditional safety (E.5) stops being
theoretical the moment Milestone 3 creates a table.

---

## Core authentication

### D4 — Scope: core auth only · **approved**, Milestone 1
Admin panel, role management, account deletion, MFA and social login deferred,
with extension points preserved (Section 0.2). No deferred feature requires a
change to `profiles`, the session model, or the service boundary.

### D5 — Tailwind CSS v4 · **approved**, Milestone 2
CSS-first configuration via `@theme`; no `tailwind.config.js`, no PostCSS, no
`content` array. Verified in the **production build**, because a v3/v4 mix works
in dev and silently drops styles from the bundle.

### D6 — PKCE flow, explicit client configuration · **approved**, Milestone 1
`flowType: 'pkce'`, `detectSessionInUrl`, `persistSession`, `autoRefreshToken`
all set explicitly rather than left to defaults, because C.9's transitions depend
on them and a silent library default change would break password recovery without
breaking a test.

*Known cost:* a confirmation link opened in a different browser cannot complete
the exchange. Handled as a recoverable error with resend, not as a bug (C.2).

---

## Account deletion

### D7 — Reauthentication through Supabase Auth, never through our code · **approved**, Milestone 1
The user reauthenticates via `signInWithPassword`; the Edge Function receives an
**empty body** and the bearer token only. It verifies with `getUser()`, takes the
user id from the verified `sub`, and accepts no identifier from the request.

*Superseded:* revision 1's design, which sent the password to an Edge Function.
Withdrawn — that would have put a password in code we wrote, its logs and its
error traces, for no benefit.

### D8 — Hard delete · **approved**, revision 3
Permanent, with cascade. No `deleted_at` column, so no policy has to remember to
exclude tombstoned rows. Soft delete remains an additive change if retention
requirements appear.

### D9 — Recency measured on `amr[].timestamp` · **approved**, revision 5 ⚠️ *reverses an earlier decision*

**Revision 4 specified `auth_time`. Supabase does not emit that claim.**

Verified 2026-11-06 (`token-claims.md`): across a refresh `iat` advanced while
`amr[].timestamp` held steady; a reauthentication moved it to now. That is exactly
the contract a recency window needs.

**Approved ordering:** (1) `amr[].timestamp`; (2) Admin API session inspection as
optional defence-in-depth; (3) a Custom Access Token hook — ranked last despite
being free, because it runs on **every token issue for every user**, and would
itself have to read `auth.sessions` to avoid advancing on refresh.

*Why revision 4's "fragile" label was wrong:* it was written without evidence.
The behaviour is now measured, and the shape appears in Supabase's published
Custom Access Token hook schema.

*New risk this introduces:* membership and moment now live in the same claim, and
`amr` becomes multi-entry under MFA. Five tests are mandated (H.3 Family 2a).

**Window: 5 minutes.**

---

## Security

### D10 — GRANTs and RLS as a pair · **approved**, Milestone 1
Both gates in every migration. A privilege never granted cannot be defeated by a
policy written wrong.

Revision 5 strengthened the rationale with evidence: **PostgREST accepts a
revoked access token until it expires** — up to an hour after sign-out — and
during that window these two controls are the only thing standing between the
token and the data (E.2, H.3 Family 4).

### D11 — Publishable key safety is conditional · **approved**, Milestone 1
Safe in the browser **only while** RLS is on everywhere, policies are correct,
GRANTs are narrow, no `SECURITY DEFINER` path routes around them, and no secret
key is build-visible. If any one fails it is a public credential, not a nearly-safe
one.

### D12 — Leaked-password protection UNMET · **recorded**, revision 5 ⚠️ *an approved commitment that cannot be met*

E.1 commits to enabling Supabase's leaked-password check. **It is paid-plan only
and is not available on the current tier** (confirmed by probe: `password123` is
accepted).

*Why the obvious fix is not one:* the exposure is credential stuffing, where the
password is already known. **Raising the minimum length does not help** and must
not be recorded as mitigation.

*Why the obvious workaround is not one either:* Supabase's Password Verification
Attempt hook — the natural server-side route — is Teams/Enterprise only, a
*higher* tier than the feature itself. A client-side breach check is UX only and
trivially bypassed.

**Before production:** enable the paid plan, or implement a server-side
equivalent. Tracked in `security.md` and `supabase-config.md`.

**Status (reaffirmed, revision 6): OPEN on the production release gate.**
Credential-stuffing protection must not be recorded as satisfied — not by
documentation, not by a longer minimum length, not by a client-side check.
D12 closes only when a real boundary rejects breached passwords.

---

## Testing

### D13 — pgTAP against a pinned PostgreSQL service container in GitHub Actions · **approved**, revision 5

*What forced the decision:* H.5 makes the GRANT-and-RLS suite a required CI
check; H.1 assumed a disposable local database; D1 removed it.

*The clarification that made this possible:* A.5 removed Docker as a **developer
machine** dependency. Actions runners already have Docker, so a service container
reintroduces nothing for anyone working here.

*Rejected, with reasons:*

- **A second hosted project for CI** — idle by definition, so it pauses on the
  free tier after ~1 week and the required check fails for unrelated reasons. Also
  consumes the free tier's second slot and needs a secret key in CI.
- **The existing development project** — no isolation; concurrent PRs interleave
  against the database we develop against, producing failures that look real and
  do not reproduce.
- **Manual testing for now** — contradicts checklist item 14. These mistakes fail
  *silently*, and D10 establishes they are the sole mitigation for a real
  one-hour window.

*Binding conditions:* pinned exact image version; bootstrap SQL and migrations in
version control; Supabase roles, schemas and `auth.*` helpers recreated; GRANT and
RLS tests required to merge; a documented periodic parity test against the cloud
development project; **no Supabase secret key in GitHub Actions**; the development
database is never the per-PR target.

*Residual risk, not eliminated:* parity drift between the reconstruction and the
real platform. Constrained by pinning, detected by the parity test. Stated plainly
rather than buried — it is why the parity test is a condition and not a nicety.

### D14 — Tests never touch a real Supabase project · **approved**, Milestone 2
Environment variables are stubbed. A passing suite therefore does **not** prove
connectivity — the health check does that. Accepted deliberately: tests depending
on a shared cloud backend are slow, flaky, and mutate state others can see.

---

### D15 — Claims are consumed only from a verified token · **approved**, revision 6

The recent-authentication check reads its claims **exclusively** from the result
of a successful server-side verification. No authentication timestamp may be
accepted from a request body, header or query parameter, and no decode-only
parse may feed the check.

*Why this is a separate decision and not an implementation detail:* a decode and
a verification return the same-looking object, so the mistake is invisible at the
call site. E.2's finding makes the consequence concrete — a signed-but-revoked
token still parses perfectly.

*Test consequence:* H.3 Family 2a is split into **parsing tests** (cases 1–5,
constructed claim objects, no signature involved) and a **verification test**
(case 6, real HTTP calls with invalid, wrongly-signed and absent tokens). Neither
layer may substitute for the other; a full set of parsing tests proves nothing
about verification.

### D16 — The parity check is an operational procedure, not an aspiration · **approved**, revision 6

H.6 condition 5 required a parity test. Revision 6 defines it: five triggers
(pre-release, bootstrap change, new database objects, monthly, and an unexplained
pgTAP result change), four comparison categories (migrations, roles, privileges,
`auth.*` helper behaviour under fixed claim fixtures), an **empty diff** as the
only pass, and an ordered failure procedure whose third step is the load-bearing
one: **every pgTAP result covering a diverged object is unproven until the diff
is closed**.

*Credential rule unchanged:* the cloud half is run manually by the owner from a
local shell. **No Supabase credential enters GitHub Actions** (H.6 condition 6).

*Limit stated plainly:* it compares the objects we thought to compare, and
PostgREST's own behaviour is outside it. The API-level suite against the real
cloud project is the complement.

### D17 — Signup is four fields, and the confirm password never leaves the browser · **approved**, revision 7
Full name, email, password, confirm password. The confirm value is a typo guard
compared client-side and discarded; sending it would imply a server-side check
that does not exist. Full name populates `display_name` — the column keeps that
name because the value is editable afterwards, so it is chosen presentation, not
verified identity (D.2).

*Carries a cross-milestone risk:* the trigger reads the metadata key
`display_name` and Milestone 4's form must send it. A mismatch raises no error and
gives every user the fallback name.

### D18 — No application access before email verification, enforced by Supabase Auth alone · **approved**, revision 7
"Confirm email" is on, so `signUp` returns **no session**. No token means no
request reaches PostgREST or an Edge Function. `ProtectedRoute` is user experience;
RLS is a real boundary but not this one — it never meets an unconfirmed user.

*The trap recorded with it:* `user_metadata.email_verified` sits in a part of the
token the user can write through `updateUser`. Whether Supabase protects that key
is **unverified**, and the design does not depend on the answer: **no
authorization decision reads it.** A test asserts the claim grants nothing, which
holds whichever way the behaviour falls (C.1.1, H.3 Family 2).

### D19 — Every new user gets `user`; nothing in this application grants `admin` · **approved**, revision 7
The trigger writes the role as a **literal**, with no branch producing `admin` —
specifically no "first user" branch, which is how requirement 9 is usually lost.
The client role holds **no write privilege on `user_roles` at all**, so the
restriction holds at the grant gate, independently of any policy.

Admin is provisioned out of band: register normally, confirm the email, then one
explicit `insert` by the owner using database credentials the application does not
possess, recorded with `granted_by` (D.7.1). A feature that creates the first
admin must be reachable by someone who is not yet an admin — a
privilege-escalation path with a friendly label.

### R1 — `user_roles` moves into Milestone 3 · **APPROVED**, 2026-11-13 ✅

**Approved with a standing constraint:** role assignment stays restricted to
trusted processes, and normal users must never be able to modify their own
roles. Enforced at gate 1 — `authenticated` holds `SELECT` on `user_roles` and
no write privilege of any kind — so the attempt dies before any policy is
consulted. `045_default_role.sql` asserts no function body in `public` contains
the elevated role name as a literal. See D.7.1 for out-of-band provisioning.

Requirements 8–10 are security properties. **Requirement 9 — the first registered
user is not an admin — cannot be tested unless roles are a real object**: with an
implicit default there is nothing to assert against, and the property holds only
because no mechanism exists yet, which is true right up until someone adds one.

*Brought forward:* the table, the enum, its grants, its policy, and the
default-role half of the trigger. *Staying in Milestone 10:* `has_role`,
`RoleGuard`, the admin panel, and any third role.

*Secondary reason:* adding the table later means a backfill migration for every
existing user plus a change to a trigger that is by then in the live sign-up path.

*If declined:* requirement 8 is met by absence ("no admin row" means `user`),
requirement 9 becomes untestable, and §4.5 plus `045_default_role.sql` drop out of
the plan. Nothing else changes.

### D20 — pgTAP runs on the runner's own PostgreSQL, not a Supabase service container · **APPROVED WITH CONDITIONS**, 2026-11-13 ✅

**What D13 approved:** a pinned `supabase/postgres` service container, chosen
so that extensions and base roles would match the platform.

**Why it does not work.** That image ships an `auth` schema owned by
`supabase_admin`. The connecting `postgres` role is neither a superuser nor a
member of it, so the bootstrap cannot create `auth.users`, and there is no way
to grant ourselves in from inside the container. Established over three CI runs
with diagnostics, not assumed.

**What replaces it:** PostgreSQL on the GitHub runner itself, with pgTAP
installed from the distribution packages. We are a real superuser there, so the
fixture is constructible. **Still no Docker**, which is if anything closer to
A.5 than the original.

*What this costs, stated plainly:* the base-role and extension fidelity the
Supabase image was chosen for. The reconstruction is now entirely ours.

*Why that is tolerable:* we were already recreating the roles, helpers and
grants by hand — the image supplied a starting point, not a guarantee. The real
control over this risk was never the image; it is **H.6.1's parity check**,
which compares roles, privileges and `auth.*` behaviour against the live
project. D20 moves that check from advisable to **load-bearing**, and the
pinned-version condition now applies to the runner's PostgreSQL and pgTAP
packages.

#### Approval conditions (2026-11-13)

1. **Runner-local PostgreSQL for CI** — accepted.
2. **PostgreSQL 16.15 pinning retained** — `PG_MAJOR: '16'` stays in the
   workflow. A major-version bump is a decision, not a dependency refresh.
3. **Supabase Cloud parity verification stays mandatory** — H.6.1 P1 (before
   production release) and P2 (whenever the bootstrap changes) are not
   waivable. D20 is the reason they are load-bearing rather than advisable.

#### Differences from the container decision D13 approved

| | D13 — `supabase/postgres` container | D20 — runner-local PostgreSQL |
| --- | --- | --- |
| Base roles | Shipped by the image | **Recreated by `02_roles.sql`** — ours, and only as faithful as we wrote them |
| `auth` schema and `auth.users` | Shipped by the image | **Recreated by `03_auth.sql`** with an ownership guard |
| `auth.uid()` / `jwt()` / `role()` | The platform's real implementations | **Our reimplementations** — behaviour matched under fixed claim fixtures by H.6.1 category 4, not by shared code |
| Extensions | The platform's set | pgtap + pgcrypto only, from distribution packages |
| Privilege level | `postgres`, not superuser, not a member of `supabase_admin` — **the blocker** | Real superuser; fixture constructible |
| Version pinning | Image tag | `PG_MAJOR: '16'` + distribution pgTAP (1.3.2 observed) |
| Docker | Yes | **No** — closer to A.5 |
| What catches divergence | The image, partially | **H.6.1 parity check, entirely** |

**The honest summary:** we traded a partial, free fidelity guarantee for a
complete, manual one. The parity check is now the only thing standing between
the CI reconstruction and the live project. If it is skipped, every pgTAP result
covering a diverged object is unproven (H.6.1 failure step 3).

**Open consequence:** the parity check will also establish whether the cloud
project's PostgreSQL major version matches the `PG_MAJOR: '16'` pin. If it does
not, condition 2 needs revisiting.

---

## Still open

| # | Decision | Needed by | Notes |
| --- | --- | --- | --- |
| O1 | Custom SMTP provider | **Milestone 4** | The built-in sender is rate-limited; the limit bites when building registration and reset. Moved earlier by D1, which removed the local inbox |
| O2 | Compensating control for D12 | Before production; relevant at Milestone 4 | A client-side HaveIBeenPwned check would live in the signup form. UX only — must not be recorded as satisfying E.1 |
| O3 | Email-dependent E2E testing | Milestone 4 | No automated inbox exists; deliberately not introduced in Milestone 2 |
| O4 | Additional roles beyond `user` / `admin` | Milestone 10 | Superseded in the near term by O8's closure — two roles only. Reopens only if Milestone 10 surfaces a genuine need |
| O5 | Deployment target and the E.6 headers | Milestone 14 | Deferred by D2 |
| O6 | Pinned `supabase/postgres` image version for CI | **Milestone 3, before the workflow is written** | H.6 condition 1 requires an exact version. Which version is a Milestone 3 decision, recorded here so it is chosen rather than defaulted |
| ~~O7~~ | ~~R1 — `user_roles` in Milestone 3?~~ | — | **CLOSED 2026-11-13 — approved.** See R1 |
| ~~O8~~ | ~~A third role beyond `user` / `admin`~~ | — | **CLOSED 2026-11-13 — two roles only: `user`, `admin`.** No third role required now. The enum stays extensible: adding a value later is `alter type ... add value`, which is cheap; **removing** one is not, which is why the set was kept minimal. Any addition still requires a policy review (checklist item 20) |

### D21 — default privileges are narrowed globally, and the result is measured · **recorded**, 2026-11-13

`04_default_privileges.sql` originally carried only `IN SCHEMA public` entries.
Two problems, found during pre-migration review:

**1. The per-role revokes were close to inert.** `anon` and `authenticated` are
not granted `EXECUTE` on new functions as themselves — they receive it through
**`PUBLIC`**, and every role is implicitly a member of `PUBLIC`. That membership
cannot be revoked. `revoke all on functions from anon, authenticated` therefore
leaves both still able to execute. The load-bearing statement is
`revoke execute on functions from public`; the per-role lines are kept only to
undo Supabase's own shipped entries.

**2. Schema scope is not global scope.** `pg_default_acl` rows are keyed by
`(defaclrole, defaclnamespace, defaclobjtype)`, `defaclnamespace = 0` meaning
every schema. A new object's ACL is built from the hardwired default, then the
global entry, then the schema-specific one — so a schema-scoped revoke *should*
win inside `public`. **We do not rely on that**, and in any case it covers only
`public`: a function created in any other schema still receives the hardwired
`EXECUTE TO PUBLIC`.

*Resolution:* both layers. Global entries first, `public`-scoped entries second.
Both say REVOKE, so there is no ordering conflict to resolve either way.

*Deliberately excluded — TYPES.* PostgreSQL also default-grants `USAGE` on new
types to `PUBLIC`. Revoking it would break `select role from user_roles` for
`authenticated`, since reading a `public.app_role` column requires `USAGE` on
the type. Type `USAGE` conveys no access to data.

*Role scope.* Without `FOR ROLE`, entries apply only to objects created by the
role that ran the file. Pre-flight query 4 prints `current_user` and
`session_user` so this is confirmed rather than assumed.

**The method matters more than the fix.** The outcome is now *measured*, not
argued: `025_default_privileges.sql` (CI) and `verify/02_default_acl_probe.sql`
(cloud, by hand) each create a throwaway table and function and read back their
real ACLs. A **NULL `proacl` is the failure signal** — it means no entry was
recorded, so the hardwired `EXECUTE TO PUBLIC` stands. Same trap D-era `050`
was rewritten to catch.

### D22 — "This email already exists" was considered and declined · **decided**, 2026-11-13

Raised as a product request: show an explicit "an account with this email
already exists" on the signup form. **Declined**, upholding requirement 3.

*It is cheap to build.* `signUp` returns `data.user.identities === []` for an
address with a confirmed account — no extra request, no database change, no
Supabase configuration change. The absence of this message is therefore a
decision, **not** an unimplemented feature, and the uniform response is not an
oversight to be tidied away.

*Why declined.* It turns the signup form into a membership oracle: addresses
can be tested one at a time, by script, to learn which are registered. That
yields a harvestable customer list and feeds credential stuffing — the D12 gap
that remains open. Reversing this would mean adding a CAPTCHA to the
production release gate to keep the oracle from being automated.

*The UX cost is real and is paid elsewhere.* Check Your Email states that no
new email is sent to an already-registered address, and offers sign-in and
password reset unconditionally. That covers the stuck user without confirming
which case they are in.

*What would reopen this:* a support burden showing users genuinely stuck at
registration, or a decision that enumeration is acceptable for this
deployment. Either is a legitimate reversal — it needs a CAPTCHA alongside it,
and this entry amended rather than ignored.

*Not a defect:* Google, Slack and Shopify all disclose this deliberately. The
choice here is for Auther, not a judgement that disclosure is always wrong.
