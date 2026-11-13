# Authentication flow — test report

| | |
| --- | --- |
| Scope | Registration, email verification, login, logout, session handling, forgot/reset password, route guards |
| Roadmap milestones | 4, 5 and 6 |
| Commit | `6c1680c` |
| Date | 2026-11-13 |
| Supabase project | `zhlnyokrxppzsfahijiu` (development) |

---

## 1. How to read this report

Results are split into **three** categories, not two. The distinction that
matters is the third one.

| | Meaning |
| --- | --- |
| ✅ **Verified** | Observed directly, with the evidence named |
| ⬜ **Not yet exercised** | No claim made either way. Not a failure |
| ⚠️ **Assumed** | Believed true on documented behaviour, **not observed on this project** |

An ⚠️ row is the dangerous kind: it looks like a pass in a summary and is not
one. They are listed separately in §6 so they cannot be skimmed past.

---

## 2. Automated tests

| Suite | Result | Evidence |
| --- | --- | --- |
| Frontend unit/component (Vitest + RTL) | ✅ **39 passing**, 7 files | Local run, 2026-11-13 |
| Lint (oxlint) | ✅ Clean | Local run |
| Production build | ✅ Succeeds | Local run |
| pgTAP, database gates | ✅ **94 assertions green** | CI run at `206ea6f` |
| Secret scan | ✅ Clean | CI run at `206ea6f` |

**⚠️ CI has not been confirmed green at `6c1680c`.** Six commits have landed
since the last run I observed, including `025_default_privileges.sql`, which
takes the suite from 94 to **100** assertions. The database job is expected to
pass; it has not been seen to. **This is the first thing to check.**

---

## 3. Database migration — applied to Supabase Cloud

Applied 2026-11-13 by the project owner through the SQL editor. Nothing was
executed automatically.

| Step | Result |
| --- | --- |
| Pre-flight (`00_preflight.sql`) | ✅ No pre-existing `profiles`, `user_roles` or `app_role`; trigger privilege on `auth.users` confirmed |
| Default-ACL probe, **before** `04` | ✅ Captured |
| `04_default_privileges.sql` | ✅ Applied, no errors |
| Default-ACL probe, **after** `04` | ✅ Captured |
| `0001_profiles_and_roles.sql` | ✅ Applied, no errors, no rows returned |

### 3.1 The default-privilege result

The question was whether schema-scoped `ALTER DEFAULT PRIVILEGES` alone closes
the hole, given PostgreSQL's hardwired `EXECUTE TO PUBLIC` on functions. It was
settled by **measurement** — a throwaway table and function created, their real
ACLs read back, then rolled back.

| | before | after |
| --- | --- | --- |
| `public_may_execute` | `true` | ✅ `false` |
| `anon_may_execute` | `true` | ✅ `false` |
| `authenticated_may_execute` | `true` | ✅ `false` |
| `anon_may_select` | `true` | ✅ `false` |
| `authenticated_may_select` | `true` | ✅ `false` |

`public` now **fails closed**: a future migration that forgets its GRANTs
produces an unreachable table rather than a published one. Recorded as D21.

### 3.2 Open finding — the `supabase_admin` gap

`pg_default_acl` still holds entries owned by `supabase_admin` granting `anon`
and `authenticated` broadly (`anon=arwdDxtm` on tables, `anon=X` on functions).
`04` is role-scoped: run as `postgres`, it writes `postgres` entries only.

**Not currently an exposure.** `profiles` and `user_roles` were created by
`postgres`, carry explicit GRANTs, and the probe proves `postgres`-created
objects arrive closed. The gap would bite only if `supabase_admin` creates an
object in `public`.

⬜ `04_supabase_admin_gap.sql` was written to establish whether the entries are
global or schema-scoped, whether `postgres` may rewrite them, and whether
`supabase_admin` owns anything in `public` today. **Not yet run.**

⬜ `03_verify_one_shot.sql` — the 13-check post-migration verification — **has
not been run.** Check 13 is expected to FAIL with `3`, reflecting exactly the
above. Until this runs, "the migration applied without error" is established
but "the migration produced the intended privileges" is not.

---

## 4. End-to-end, observed

| Flow | Result | Evidence |
| --- | --- | --- |
| Register through the app | ✅ | Account created, Check Email screen shown |
| Confirmation email delivered and link worked | ✅ | Account confirmed |
| Session established after confirmation | ✅ | Dashboard reached |
| Trigger created the profile row | ✅ | `DISPLAY NAME` = "test user" |
| **Metadata key matches both sides** | ✅ | Not the `New user` fallback — so `display_name` survived form → `raw_user_meta_data` → trigger. Previously an unverified assumption |
| Default role assigned | ✅ | `ROLE` = `user` (requirement 8) |
| First user did **not** become admin | ✅ | First account on the project; `role` = `user` (requirement 9) |
| Email confirmation enabled | ✅ | `EMAIL CONFIRMED` = Yes |
| **Both gates exercised for a real user** | ✅ | Dashboard data arrived via PostgREST under the user's own JWT — GRANTs allowed the read, RLS returned their row |

The last row is the deepest result in this report: GRANTs and RLS were proven
against the live project by a real authenticated request, not only by pgTAP
against a reconstruction.

---

## 5. Not yet exercised

Nothing here has failed. Nothing here has been shown to work.

| # | Flow | Why it matters |
| --- | --- | --- |
| 1 | **Requirement 7** — unconfirmed user held out | The confirmation link was clicked *before* the dashboard was reached, so the "no access until verified" path was never walked. Requires a second disposable address: register, do **not** confirm, attempt `/`. Enforced solely by Supabase returning `session: null` (C.1.1) |
| 2 | Forgot → reset → sign in with the new password | The whole of roadmap Milestone 5 is unexercised against the cloud project. `ResetPasswordPage.test.jsx` covers the `PASSWORD_RECOVERY` gate in isolation only |
| 3 | Duplicate signup with a confirmed address | Requirement 2. Expected: no error, Check Email screen, **no email**, `auth.users` unchanged |
| 4 | Logout clearing access; session restored across refresh | |
| 5 | Cross-browser link failure (PKCE verifier) | C.2's accepted trade-off. The error text names expiry and reuse but **not** the wrong-browser case, which is the likelier cause |
| 6 | Parity check (H.6.1 Step 7) | Load-bearing since D20. Also establishes whether the cloud PostgreSQL major matches the `PG_MAJOR: '16'` pin |

---

## 6. ⚠️ Assumed, not observed

| Claim | Basis | How to settle it |
| --- | --- | --- |
| Duplicate signup creates no second account | Documented Supabase behaviour | §5 row 3 |
| `resend` with `type: 'signup'` is rejected for a confirmed account | Documented | Attempt it; the error is swallowed by design, so watch the inbox |
| CI is green at `6c1680c` | Six commits since the last observed run | Check Actions |

---

## 7. Known-open items carried forward

| | |
| --- | --- |
| 🔴 **D12** | Leaked-password protection unavailable on the free plan. **Credential-stuffing protection is NOT satisfied.** Most acute on the reset-password screen, where only length is checked |
| 🔵 **D22** | "This email already exists" declined, upholding requirement 3. The uniform response is a decision, not an omission |
| 🟡 Timing side channel | A duplicate signup skips password hashing and email dispatch and may return measurably faster. Unmeasured, untested. The remaining enumeration surface |
| 🟡 Branch protection | The three CI checks are **not** required on `main` |

---

## 8. Summary

The email/password authentication flow is **built, unit-tested and observed
working end to end for one real user** — registration, confirmation, session,
profile creation, default role, and both database gates under a live JWT.

It is **not yet fully verified**. Three gaps stand between the current state
and that claim: the post-migration verification has not been run, requirement 7
has never been exercised, and the entire password-reset flow is untested
against the cloud project.

None of these is known to be broken. All three are unknown, which is a
different thing, and this report exists so the difference is not lost.
