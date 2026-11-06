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

## Still open

| # | Decision | Needed by | Notes |
| --- | --- | --- | --- |
| O1 | Custom SMTP provider | **Milestone 4** | The built-in sender is rate-limited; the limit bites when building registration and reset. Moved earlier by D1, which removed the local inbox |
| O2 | Compensating control for D12 | Before production; relevant at Milestone 4 | A client-side HaveIBeenPwned check would live in the signup form. UX only — must not be recorded as satisfying E.1 |
| O3 | Email-dependent E2E testing | Milestone 4 | No automated inbox exists; deliberately not introduced in Milestone 2 |
| O4 | Additional roles beyond `user` / `admin` | Milestone 10 | |
| O5 | Deployment target and the E.6 headers | Milestone 14 | Deferred by D2 |
