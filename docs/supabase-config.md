# Supabase Cloud — dashboard configuration

Settings that live in the Supabase dashboard rather than in this repository, so
that a rebuilt or second project can be brought to the same state.

Each item is traced to the section of `architecture.md` that requires it. Apply
them to the **development** project.

> **Why this file exists.** Dashboard settings are invisible to code review and
> absent from a rebuilt environment. Writing them down is the only version
> control they get.

---

## Status

| | |
| --- | --- |
| Project | development (`zhlnyokrxppzsfahijiu`) |
| Verified against | `GET /auth/v1/settings`, 2026-11-06 |
| Applied by | User, 2026-11-06 |
| Verified | Partially — see "Verification results" below |

---

## Verification results (2026-11-06)

| Setting | How verified | Result |
| --- | --- | --- |
| Email confirmation required | `GET /auth/v1/settings` | ✅ `mailer_autoconfirm: false` |
| Sign-ups enabled | `GET /auth/v1/settings` | ✅ |
| Email-only provider | `GET /auth/v1/settings` | ✅ |
| Minimum password length 10 | Signup probe with a 6-char password | ✅ Rejected, `422 weak_password`, no account created |
| **Leaked-password protection** | Signup probe with `password123` | ⚠️ **Unavailable — paid plan only.** Accepted as a known limitation; see below |
| Site URL | — | Not exposed on any public endpoint. Exercised for real in Milestone 4 |
| Redirect allow-list | — | Same |
| Rate limits | — | Dashboard only; see table below |

### Accepted limitation: leaked-password protection unavailable

**Confirmed 2026-11-06: gated behind a paid Supabase plan. Not available on this
tier.** Verified by probe — a signup with `password123` is accepted.

Architecture E.1 states we will enable this control and identifies it as
preventing more real compromises than any complexity rule. That intent stands;
the mechanism is simply not purchasable at this tier right now.

**Status: accepted limitation for development, unresolved for production.**

#### What this actually means

Any password of 10+ characters is accepted, including ones appearing in public
breach corpora. The realistic attack is **credential stuffing**: an attacker
replays username/password pairs leaked from other services. Password length does
not help against it, because the password is already known.

#### Compensating controls — to decide (see architecture checklist)

| Option | Effect | Honest assessment |
| --- | --- | --- |
| Raise minimum length to 12+ | Helps against brute force | **Does nothing against credential stuffing.** A long breached password is still breached |
| Client-side breach check (HaveIBeenPwned k-anonymity API — free, no key, only a hash prefix leaves the browser) | Warns or blocks at signup | **User experience only, not a security boundary.** Trivially bypassed by calling the API directly. Still stops honest users reusing a known-breached password, which is most of the real risk |
| Server-side check in a password-validation hook | A genuine boundary | Hooks may themselves be plan-gated. Needs checking |
| Enable Pro before launch | The intended fix | A cost decision |
| Rate limiting + lockout | Blunts stuffing attempts | Already partly present; tighten in Milestone 8 |

**Nothing here is implemented yet.** Recorded so the decision is made
deliberately rather than inherited by silence.

#### Required before production

Either enable the Pro plan, or implement a server-side equivalent. **A
client-side check alone must not be described as satisfying architecture E.1**,
because it is not a boundary.

---

## Already correct by default

Confirmed from the live project; **no action needed**.

| Setting | Observed | Required | Why |
| --- | --- | --- | --- |
| `mailer_autoconfirm` | `false` | `false` | Email confirmation required before first login. `false` means Supabase does **not** auto-confirm, i.e. the user must click the link (architecture C.2, checklist item 5) |
| `disable_signup` | `false` | `false` | Registration must work (architecture C.1) |
| Providers enabled | `email` only | `email` only | Social login is deferred (architecture 0.2) |
| `passkeys_enabled` | `false` | `false` | Out of scope |

---

## To apply

These are **not** exposed on the public settings endpoint, so they cannot be
verified from code — they must be set and read back in the dashboard.

### 1. URL configuration

**Authentication → URL Configuration**

| Field | Value |
| --- | --- |
| Site URL | `http://localhost:5173` |
| Redirect URLs | `http://localhost:5173/auth/callback` |
| Redirect URLs | `http://localhost:5173/reset-password` |

**Why these exact paths.** Supabase refuses to redirect anywhere not on this
list, and falls back to the Site URL instead. A missing entry surfaces in
Milestone 4 as "email verification is broken" rather than as a configuration
error, which is an expensive way to lose an afternoon (architecture C.2).

**Keep the list tight.** Wildcards such as `http://localhost:5173/**` are
tempting and are how open redirects happen (architecture E.6). List the two
paths we actually use.

**Port 5173 is pinned.** `vite.config.js` sets `strictPort: true`, so Vite fails
loudly rather than silently moving to 5174 — which would break these redirects
while looking like an auth bug.

### 2. Password policy

**Authentication → Sign In / Providers → Email**, or **Auth → Policies**
depending on dashboard version.

| Setting | Value | Why |
| --- | --- | --- |
| Minimum password length | **10** | Architecture checklist item 8. Length beats forced complexity |
| Required characters | **none** | Complexity rules push people toward `Password1!` and a sticky note |
| Leaked password protection | **enabled** | Rejects passwords found in known breach corpora. Prevents more real compromises than any complexity rule (architecture E.1) |
| **Secure password change** | **ON** | Observed in the dashboard by the user, 2026-11-13. A password change from a session older than 24 hours requires an emailed reauthentication code (architecture C.7). Governs Milestone 7 §3.4 |

> Leaked-password protection may require a paid plan on some tiers. If it is
> unavailable, record that here and revisit before launch — do not silently skip
> it.

> **Secure password change is ON, and the 24-hour window is not configurable.**
> GoTrue decides reauthentication from the age of the *session*, not from the
> age of the last authentication, and that threshold is hardcoded. Nothing in
> this project can shorten it, lengthen it, or read it from a token. See
> `milestone-7-plan.md` §3.4.
>
> Not to be confused with **require current password**, a *separate* setting
> that asks for the existing password instead of an emailed code. Its state on
> this project is **unverified** — Milestone 7 step 1 checks it.

#### Secure password change — behaviour read from the GoTrue source, 2026-11-13

Read in `supabase/auth@master`. **Source-verified, not observed on this
project** — Supabase Cloud runs a pinned release and the running version was
not confirmed. Stronger than documentation; weaker than measurement.

| | Finding | Where |
| --- | --- | --- |
| **The window** | `now.After(session.CreatedAt.Add(24*time.Hour))` — the age of the **session**, not of the last authentication. `24*time.Hour` is a literal, not configuration | `internal/api/user.go` |
| **Scope of the gate** | Inside `if params.Password != nil`. **Email change is NOT gated** | `internal/api/user.go` |
| **Other sessions** | A password change calls `LogoutAllExceptMe` and clears every outstanding one-time token. **The user's other devices are signed out** | `internal/models/user.go` |
| **Code lifetime** | Validated against `config.Mailer.OtpExp` — the **same Email OTP Expiration** setting as every other email OTP. There is no separate reauthentication expiry | `internal/api/reauthenticate.go` |
| **One code at a time** | A single `reauthentication_token` column per user. A resend **overwrites** the previous code | `internal/models/user.go` |
| **Recovery flow unaffected** | A recovery link mints a fresh session, so `ResetPasswordPage` stays inside the fast path | — |

**Still unread — both need the dashboard:**

| | |
| --- | --- |
| ⬜ **Reauthentication email template** | Authentication → Emails → Reauthentication. Must exist, be enabled, and contain **`{{ .Token }}`** — a code to type, not `{{ .ConfirmationURL }}` |
| ⬜ **Email OTP Expiration value** | It is also the reauthentication code's lifetime. The UI needs the number |

> **Note on the other-sessions behaviour.** It is not instant. Milestone 2
> measured that PostgREST keeps accepting an existing **access** token until it
> expires — up to an hour. What is revoked at once is the refresh token.

### 3. Rate limits

**Authentication → Rate Limits**

No change required now. **Record the current values in the table below**, because
Milestone 8's brute-force tests run against this shared project and could trip
project-wide limits that affect anyone else using it (architecture E.6, plan
§5.4).

| Limit | Current value |
| --- | --- |
| Sign-ups per hour | *(record)* |
| Emails per hour | *(record)* |
| Token refreshes | *(record)* |
| OTP / verification | *(record)* |

### 4. Email sending — note only, no action

The built-in sender is **rate-limited and intended for testing**. Milestone 2
needs two or three emails, which is fine.

Custom SMTP (architecture checklist item 10) stays a **Milestone 4 decision**.
Recording it here so it arrives as a scheduled decision rather than a surprise:
building registration and password reset means sending many emails in short
bursts, and hitting the limit looks like "verification is broken" rather than
"you are rate-limited".

---

## Not configured, and deliberately so — including CI access

**No Supabase credential of any kind belongs in GitHub Actions.** The approved
pgTAP strategy (architecture H.6) runs database tests against a disposable
PostgreSQL service container, precisely so that no secret key has to exist in a
public repository's CI. If a future change appears to need one, that is the
signal to re-read H.6 rather than to add the secret.

## Not configured, and deliberately so

| Thing | Why not |
| --- | --- |
| Google / GitHub providers | Social login deferred (architecture 0.2) |
| MFA | Deferred; the JWT already carries `aal` so it slots in later |
| Custom SMTP | Milestone 4 decision |
| Production URLs | Deployment deferred (checklist item 22) |
| Database tables, RLS, GRANTs | Milestone 3 |

---

## After applying

1. Restart the dev server and confirm the home page still reports **Connected**.
2. Re-run `GET /auth/v1/settings` and confirm the four defaults above are
   unchanged.
3. Fill in the rate-limit table and tick the status line at the top.

Nothing in Milestone 2 exercises the redirect URLs — the login screen is visual
only and does not authenticate. They are configured now so that the first real
flow in Milestone 4 fails for genuine reasons rather than setup ones.
