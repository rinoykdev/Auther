# Milestone 7 — Profile Management

> **Numbering.** Requested as "Milestone 6". In the approved roadmap
> (architecture §Roadmap) Milestone 6 is *protected routes, route guards and
> the loading-state rules* — **already built and tested** (`ProtectedRoute`,
> `PublicOnlyRoute`, `FullPageSpinner`, C.9 rule 1, covered by
> `AppRoutes.test.jsx`). Profile management is **Milestone 7**.
>
> This plan is filed under the approved number. Say the word and I will
> renumber the roadmap to close the gap instead — but I would rather not
> silently shift an approved document.

| | |
| --- | --- |
| Scope | Profile editing (display name), change password, change email |
| Depends on | Milestone 3 (applied ✅), Milestones 4–6 (built ✅) |
| Architecture | C.7, C.8.1, D.2, E.4, F screens 7 and 8 |
| Config fact | **Secure password change is ON** — confirmed in the dashboard by the user, 2026-11-13 |
| Status | **Plan only. No implementation.** |

> **Revision, 2026-11-13.** §3.4 was previously a conditional stub: *"whether
> secure password change is enabled is unverified — step 1 is to check."* It is
> enabled. The reauthentication flow is therefore **in scope and mandatory**,
> and §3.4 is now the longest section in this plan. Step 1 of §8 changes from
> *"is it on?"* to *"confirm the five adjacent facts it does not tell us"*
> (§10).

---

## 1. Scope

### In

1. **`/profile`** — view and edit `display_name`. Email shown **read-only**.
2. **`/settings/security`** — change password (with reauthentication), change email.
3. Error, loading, success and unsaved-change states for all of the above.

### Out, settled 2026-11-13

| | Why | Where |
| --- | --- | --- |
| **Every profile field except `display_name`** | Keeps the module reusable; every added column is a grant and a policy review | — |
| **Avatar — upload *and* URL field** | Storage buckets are a second access-control surface, not a form field. A paste-a-URL field is arbitrary external image loading from a shared column | M13 |
| **Sign out of all devices** | Deferred. Open decision 12 stays open | — |
| Account deletion | Its own milestone and its own test pass | M12 |
| Role editing | Nothing in the app may grant a role (D.7.1). `user_roles` has **no write grant at all** | M10 / out of band |
| MFA | | M13 |
| Dashboard redesign | **The dashboard remains the landing page.** M7 adds navigation to it, nothing more | — |

**`avatar_url` stays a column with no UI.** It keeps its `UPDATE` grant — the
grant is harmless without a code path that uses it, and removing it would mean
a migration this milestone is not supposed to need.

---

## 2. The three operations are not alike

This is the organising idea of the milestone. One is a database write; two are
Supabase Auth operations that never touch our tables.

| | Goes to | Our tables? | Reauthentication | Email sent |
| --- | --- | --- | --- | --- |
| **Display name** | PostgREST → `public.profiles` | ✅ yes | No | No |
| **Change password** | Supabase Auth `updateUser` | ❌ no | **Yes — conditionally. See §3.4** | **Yes, when the code is requested** |
| **Change email** | Supabase Auth `updateUser` | ❌ no | **No** — source-verified, §10 V4 | **Yes — to BOTH addresses** |

Consequences worth stating up front:

- **Only the first is governed by RLS.** Password and email changes are
  enforced by Supabase Auth; no policy we write can affect them. Testing them
  with pgTAP would prove nothing. **Reauthentication in particular touches
  nothing in our schema** — no table, no policy, no grant, no migration.
- **`profiles` has no `email` column and must not gain one** (D.2). The email
  on `/profile` is read from the **session**, not from a table. Mirroring it
  would turn any future broad-read policy into a directory of every registered
  address.

---

## 3. Frontend

### 3.1 Screens

| Screen | Route | Guard |
| --- | --- | --- |
| Profile | `/profile` | `ProtectedRoute` |
| Security Settings | `/settings/security` | `ProtectedRoute` |

Both are additive to `AppRoutes.jsx`. No guard changes. **No route is added for
reauthentication** — see §3.4.4. Navigation between dashboard, profile and
security is added; currently there is none, and the dashboard is a dead end
with only a sign-out button.

### 3.2 `/profile`

| Field | Behaviour |
| --- | --- |
| Display name | Editable. 1–80 chars, matching the `profiles_display_name_length` CHECK **exactly** |
| Email | **Read-only**, from the session. A link to Security Settings to change it |
| Avatar | Not rendered (§1) |

States: loading · saving · saved · error · **unsaved changes** (prompt on
navigate away).

**Client validation must mirror the CHECK constraint, not approximate it.** A
client that allows 100 characters produces a 400 from PostgREST that reads as
a bug; one that allows 0 produces a constraint violation. The bound is 1–80 and
is already in the database — §6 asserts the two agree.

### 3.3 `/settings/security`

Two independent cards on one page. Neither blocks the other.

**Change password** — new password, confirm password. Min 10
(`MIN_PASSWORD_LENGTH`). Submitting enters the flow in §3.4.

> 🔴 **D12 applies here.** Length is the only check. This screen and the reset
> screen are where a breached password enters the system. Reauthentication
> proves *who* is changing the password; it says nothing about *what* they are
> changing it to. Do not let this milestone be read as closing D12.

**Change email** — new address, then a clear statement that **both** the old
and new addresses receive a confirmation and the change takes effect only when
both are confirmed (C.7). The email to the **old** address is what protects a
user whose session has been stolen — the UI should say so, not bury it.

---

## 3.4 Reauthentication — the core of this revision

### 3.4.1 What the setting actually does

With **secure password change** ON, GoTrue refuses `updateUser({ password })`
unless the caller proves recent authentication, in one of two ways:

| | Condition | What the app must do |
| --- | --- | --- |
| **Fast path** | The **session** was created less than **24 hours** ago | Nothing. The call just succeeds |
| **Reauthentication path** | The session is **24 hours or older** | `reauthenticate()` → Supabase emails a one-time code → resubmit `updateUser({ password, nonce })` |

Three properties of that table decide the whole design:

1. **The threshold is the age of the *session*, not the age of the last
   authentication,** and it is **hardcoded at 24 hours** in GoTrue. It is not
   exposed in the dashboard, not in `config.toml`, and not settable by us.
2. **The nonce is ignored inside the fast path.** Sending one early is not a
   way to be safe; it is a wasted email against a rate-limited sender.
3. **Reauthentication does not create a new session.** Unlike C.8's
   password-re-sign-in design — which issues a fresh session and moves
   `amr[].timestamp` to now (measured, `token-claims.md` §3) — the nonce flow
   proves mailbox control *within the existing session*. The session's age is
   unchanged, so a **second** password change in the same sitting will ask for
   a **second** code. That is correct behaviour, and the UI must not present it
   as a failure.

### 3.4.2 How the app determines whether authentication is recent enough

**It does not. It asks, by attempting the change.**

This is a deliberate decision and the single most important design choice in
the milestone, so the reasoning is written out rather than assumed:

- **The token does not carry the answer.** The access token's claim set is
  known exactly — it was measured in Milestone 2 and written down in
  `token-claims.md` §1. There is **no session `created_at` claim**, and no
  claim that tracks it. The server's input to the decision is simply not
  visible to the browser.
- **The nearest proxy is not the same quantity.** The earliest
  `amr[].timestamp` approximates when the session began, and `token-claims.md`
  §2 proves it survives a token refresh while `iat` does not. But "when the
  user last authenticated" and "when GoTrue thinks this session was created"
  are different numbers that happen to coincide at sign-in. Building a gate on
  a proxy for someone else's variable means the gate drifts out of agreement
  with the server and nobody notices until a user is stuck.
- **A client-side check is not a control anyway.** The browser cannot verify
  the token's signature in any way that means anything — it holds the token it
  was given. A recency check in React is a *hint*, never a boundary. The
  boundary is GoTrue's, and GoTrue is going to apply it whatever we render.
- **Guessing wrong is worse in both directions.** Guess "recent" when the
  server disagrees and the user gets an unexplained error mid-submit. Guess
  "stale" when the server disagrees and the app sends a pointless email, burns
  the rate limit, and makes the user type a code that was never required.

**So: submit, and let the error tell us.** `reauthentication_needed` is not an
error to display — it is a **state transition**, and the service layer must
translate it into one rather than hand it to `toUserMessage`.

> ⚠️ If a later milestone ever does want a pre-emptive hint — to show the code
> step before submitting rather than after — the rule from C.8.1 and D15 still
> binds: read **`amr[].timestamp`**, never `iat`, never `amr` membership. It may
> only *add* a step the server would have demanded; it may never *skip* one.
> **Not in M7.** See §9 D-A.

### 3.4.3 What happens when reauthentication is required

A three-state machine inside the change-password card. No route change, no
navigation, no persisted state.

```
          [ idle ]
              |  submit (new password, confirmed)
              v
      updateUser({ password })
              |
      +-------+------------------------------+
      |                                      |
   success                        error.code === 'reauthentication_needed'
      |                                      |
      v                                      v
   [ done ]                        reauthenticate()   -> email sent
                                             |
                                             v
                                   [ awaiting code ]
                                             |  user types the 6-digit code
                                             v
                            updateUser({ password, nonce: code })
                                             |
                           +-----------------+---------------------+
                           |                                       |
                        success                   error.code === 'reauthentication_not_valid'
                           |                                       |
                           v                                       v
                        [ done ]                        stay in [ awaiting code ],
                                                        show the error, allow retry
                                                        and one resend (cooldown)
```

**The typed password is held in component state across the transition** and
never re-requested. Making the user retype it after fetching a code from their
inbox is where people give up and pick something weaker. It must **never** be
written to `localStorage`, `sessionStorage`, a URL, a query string, or a route
`state` object — which is also why `[ awaiting code ]` is a state and not a
route. Leaving `/settings/security` discards it; that is intended.

### 3.4.4 UI and error states

| State | Shown | Notes |
| --- | --- | --- |
| `idle` | Two password fields, submit | |
| `submitting` | Disabled form, spinner on the button | |
| `awaiting code` | **Both password fields collapse into a read-only summary.** One code field, submit, "Resend code" with a cooldown, "Cancel" | Explain *why*: "For your security, confirm it is you. We have emailed a code to `user@example.com`." |
| `verifying` | Disabled, spinner | |
| `done` | Success alert. Form resets to `idle`, emptied | **Must state that other devices are signed out** — §10 V2. Without the word "immediately" |
| `error` | `Alert tone="error"` above the active step | The step does not reset |

**Error mapping.** Two new codes go into `errorMessages.js`; the first is a
safety net that should never fire.

| Code | Handling |
| --- | --- |
| `reauthentication_needed` | **Not a message.** Consumed by the service layer as a state transition (§3.4.3). A mapped string exists only so that an unhandled escape reads sensibly instead of hitting the generic fallback |
| `reauthentication_not_valid` | *"That code is not right, or it has expired. Check the code, or request a new one."* |
| `same_password` | Already mapped ✅ |
| `weak_password` | Already mapped ✅ |
| `over_email_send_rate_limit` | Already mapped ✅ — and newly **reachable** here, because the code email uses the built-in rate-limited sender (O1) |

**Resend has a cooldown, for the same reason `CheckEmailPage` does.** The code
email comes from the same project-wide, rate-limited built-in sender. Four
impatient clicks exhaust the limit and the user then cannot receive the code
they are waiting for — which looks exactly like the product being broken.
Reuse the 60-second pattern already written.

**The copy must not blame the user.** Being asked for a code is the normal
consequence of having stayed signed in for a day. "Your session has expired" is
both wrong (it has not; it is still working) and alarming.

### 3.4.5 Rules this flow must not break

- No new route, no `navigate()`, no `location.state` carrying anything.
- The password never leaves component memory except in the `updateUser` call.
- The code is a **nonce**, not a credential: single-use, shown once, never stored.
- The change-email card is **independent** and stays that way — V4 confirms
  from source that email change is not gated.
- No `console.log` of the token, the code, or the password, in any state.

---

### 3.5 Service layer

All calls go in `authService.js` / a new `profileService.js`. Components never
touch `supabase.*` directly (B.3).

```
getProfile()                              -> select from profiles
updateProfile({ displayName })            -> update profiles  (display_name only)
changePassword({ password, nonce? })      -> auth.updateUser
requestReauthentication()                 -> auth.reauthenticate
changeEmail({ email })                    -> auth.updateUser
```

`updateProfile` sends **only** the columns it names. Sending a whole object
invites a future column to be written by accident — the column grant would
refuse it, but as an opaque 403 rather than a clear bug.

`changePassword` returns a **discriminated result**, not a raw error, so the
`reauthentication_needed` branch is a shape the component handles rather than a
string it matches:

```
{ status: 'ok' }
{ status: 'reauthentication_required' }
{ status: 'error', message }     // already through toUserMessage
```

**String-matching an error message in a component is how this flow breaks
silently** when Supabase rewords something. The code is matched once, in one
place, and converted to a shape.

---

## 4. Backend / database

### 4.1 Expected: **no migration**

Milestone 3 already provides everything:

| Need | Already present |
| --- | --- |
| Read own profile | `grant select on profiles to authenticated` + `profiles_select_own` |
| Update own name | `grant update (display_name, avatar_url)` + `profiles_update_own` with `WITH CHECK` |
| `updated_at` maintained | `set_profiles_updated_at` trigger |
| Length bound | `profiles_display_name_length` CHECK |

**Reauthentication adds nothing here.** It is entirely inside Supabase Auth.

**If this milestone finds itself writing a migration, something has been
misunderstood** — most likely an attempt to store email or roles in `profiles`.
Stop and re-read D.2 and D.7. With avatar and extra fields now out of scope
(§1), there is no remaining candidate for a legitimate schema change.

---

## 5. RLS implications

**No policy changes.** The existing three are sufficient and correct.

What M7 does is **exercise** them for the first time in a write path:

| Property | Enforced by | Test |
| --- | --- | --- |
| A user may read only their own profile | `profiles_select_own` | Already in pgTAP |
| A user may update only their own row | `profiles_update_own` `USING` | Already |
| A user may not reassign their row to another user | `WITH CHECK` | Already |
| A user may not write `id`, `created_at`, `updated_at` | **Column grant** (gate 1) | Already |
| A user may not write any role | **No write grant at all** on `user_roles` | Already |

The fourth row is the one M7 could accidentally undermine — by requesting a
broader grant to make a form "work". **The correct response to a 403 on
`updated_at` is to stop sending it**, not to widen the grant.

### 5.1 The trap

`profiles` is **FORCE** RLS. Verifying a write in the SQL editor as `postgres`
returns **zero rows** even when the write succeeded, because `auth.uid()` is
`NULL` there. Already documented in `verify/05_signup_smoke.sql`. Verify
profile writes **through the app**, or through a request carrying a real JWT.

---

## 6. Tests

### 6.1 Frontend (Vitest + RTL) — ~20 new

| Area | Tests |
| --- | --- |
| Profile | loads and displays; email is read-only and has no input; save calls `updateProfile` with `display_name` **only**; rejects empty; rejects 81 chars; accepts 80; shows error on failure; warns on unsaved navigation |
| Change email | validates the address; success states that **both** addresses must confirm; errors map through `toUserMessage` |
| Change password — **recent session** | password < 10 rejected; mismatch rejected; `updateUser` called **without** a nonce; success state; **`reauthenticate` is never called** |
| Change password — **stale session** | first `updateUser` returns `reauthentication_needed` → component enters `awaiting code` and `reauthenticate()` **is** called; the code field appears; the password fields are no longer editable; submitting the code calls `updateUser` with **the same password and the nonce**; a wrong code keeps the component in `awaiting code`; resend respects the cooldown; **cancel discards the password** |

**Both branches are fully testable in unit tests**, because the branch is
chosen by a mocked service response, not by the clock. This matters: see 6.3.

Two tests are about what must *not* happen, and are worth writing explicitly:

- the password is not sent to `reauthenticate()`;
- nothing in the flow writes to `localStorage` or `sessionStorage`.

### 6.2 pgTAP — **likely none**

The gates already have coverage and M7 adds no objects. One **possible**
addition: assert the CHECK bound is exactly 1–80, so the frontend constant and
the constraint cannot drift apart.

### 6.3 Manual, against the cloud project

Only these prove the milestone:

1. Change display name → reload → persists → **dashboard reflects it**
2. **Change password on a session less than 24 hours old** → no code requested
   → sign out → old password **fails** → new password works
3. **Change password on a session 24 hours or older** → code arrives by email →
   change succeeds → old password **fails**
4. **A wrong code** → refused, flow recoverable
5. Change email → **both** addresses receive mail → change applies only after
   both confirmed
6. **Attempt to update another user's profile** with a crafted request →
   refused by RLS

**Test 6 is the only adversarial one and the only one that tests security.**
1–5 confirm the feature works; 6 confirms it cannot be abused. It needs a
second account, which the open items already require for requirement 7.

> ⚠️ **Test 3 cannot be run on demand.** The 24-hour threshold is hardcoded in
> GoTrue and the session's age cannot be forged from the client. There is no
> dashboard setting, no API, and no supported way to age a session. The only
> way to reach that state is to **sign in, leave the browser profile alone, and
> come back the next day.**
>
> Plan for it rather than discover it: sign in on a dedicated browser profile
> **the day before** the M7 manual pass. If that is not done, test 3 stays
> unexercised — and it must then be recorded in the test report as
> ⬜ *not yet exercised*, in the same three-way split as
> `auth-flow-test-report.md`. **Not as a pass.** The unit tests in §6.1 cover
> the logic; they cannot confirm that GoTrue behaves as documented.

---

## 7. Acceptance criteria

**Functional**

- [ ] `/profile` and `/settings/security` reachable, both behind `ProtectedRoute`
- [ ] Display name persists and is visible on the dashboard after reload
- [ ] Email on `/profile` is read-only and read **from the session**
- [ ] Password change works on a recent session **without** requesting a code
- [ ] Password change on a stale session requests a code and completes with it
- [ ] **Old password stops working** afterwards (verified, not assumed)
- [ ] Email change sends to **both** addresses and applies only after both confirm
- [ ] Every error reaches the user through `toUserMessage` — no raw Supabase string

**Reauthentication**

- [ ] 🔑 `reauthentication_needed` is handled as a **state transition**, not rendered as an error text
- [ ] The branch is decided by the **server's response**, never by a client-side clock or token claim
- [ ] `reauthenticate()` is **never** called on the fast path
- [ ] The new password survives the code step **in memory only** — no storage, no URL, no route state
- [ ] Resend is rate-limited by a cooldown
- [ ] The code is never logged and never persisted
- [ ] The success state tells the user their **other devices are signed out** (V2), without the word "immediately"
- [ ] Resend copy makes clear that a **new code replaces the previous one** (V3)

**Security**

- [ ] 🔑 A request to update **another** user's profile is **refused** — demonstrated, not argued
- [ ] No new grant, no widened grant, no new policy, **no migration**
- [ ] `profiles` gains **no** `email` column and **no** role column
- [ ] No code path writes `user_roles`
- [ ] Any future recency hint reads `amr[].timestamp` from a verified token (none in M7)
- [ ] `confirmPassword` never leaves the browser

**Process**

- [ ] All three CI jobs green
- [ ] Frontend suite ≥ 39 + new, all passing
- [ ] D12 still listed 🔴 OPEN — **this milestone does not close it**
- [ ] §10 verification items each answered or explicitly recorded as unanswered
- [ ] Architecture, decisions and `supabase-config.md` updated

---

## 8. Steps

| # | Step | Output |
| --- | --- | --- |
| 1 | **V1 and the OTP expiry value** — the two dashboard facts still unread. V2, V3, V4, V6 are answered in §10 | Written answers in `supabase-config.md` |
| 2 | **Approve D-F** (D-A … D-E approved 2026-11-13) | |
| 3 | `profileService.js` + tests | |
| 4 | `/profile` + tests | |
| 5 | Change-email card + tests | |
| 6 | Change-password card, fast path only + tests | A working change on a recent session |
| 7 | **Reauthentication state machine** + tests for both branches | |
| 8 | Navigation between dashboard / profile / security | |
| 9 | Manual cloud pass, including the aged session (6.3 test 3) and adversarial test 6 | Test report |
| 10 | Documentation | |

**Steps 6 and 7 are separate on purpose.** The fast path is the whole feature
for a user who signed in this morning; shipping it first means the
reauthentication work is added to something already proven to work, and a bug
in step 7 cannot be confused with a bug in step 6.

Schedule the aged-session sign-in (§6.3) **at step 7**, so the session is
old enough by step 9.

---

## 9. Decisions

### Settled 2026-11-13 — closed

| | |
| --- | --- |
| ~~Q1 extra profile fields~~ | **Display name only.** Open decision 9 closed for M7 |
| ~~Q2 `avatar_url` behaviour~~ | **Deferred entirely** — no upload, no URL field. Column stays, UI does not |
| ~~Q3 sign out of all devices~~ | **Deferred.** Open decision 12 remains open — but see V2 below: a password change already does this as a side effect |
| ~~Q4 dashboard as landing page~~ | **Yes, unchanged.** M7 adds navigation only |
| ~~Is secure password change enabled?~~ | **Yes.** Confirmed in the dashboard, 2026-11-13 |

### Approved 2026-11-13 — binding on implementation

| | Decision |
| --- | --- |
| **D-A** ✅ | **Attempt the password update and react to the server response.** No client-side recency prediction |
| **D-B** ✅ | **"Require current password" stays OFF for M7.** Revisit in M8 |
| **D-C** ✅ | **Reauthentication stays in-place on `/settings/security`.** No route |
| **D-D** ✅ | **The typed password lives in component memory only.** Never storage, URL or route state |
| **D-E** ✅ | **M7 may close with the aged-session cloud test recorded as ⬜ unexercised,** provided the unit tests and the other acceptance criteria pass |

### Approved 2026-11-13 — D-F

**D-F · `email_exists` on the change-email form.** Source reading (V4) shows
that changing to an already-registered address returns `422 email_exists`. It
cannot be suppressed — the server refuses, so the form must say something or it
appears broken.

**Approved wording, to be used verbatim:**

> **That address can't be used. Try a different one.**

True, actionable, and it does not state that an account exists. **It does not
eliminate the inference** — a signed-in user can still read the refusal and
conclude the address is probably registered. That residual is recorded in
`security.md` as an accepted limitation, with the four things that limit it
(authentication required, one address per attempt, rate limited, attributable)
and an explicit instruction that **no document may claim account enumeration is
fully prevented**.

---

## 10. Supabase behaviour — verification results

> **Three tiers of confidence, kept apart deliberately.**
>
> | | Means |
> | --- | --- |
> | 🟢 **Observed** | Measured against this project. The standard set by `token-claims.md` |
> | 🔵 **Source-verified** | Read in the `supabase/auth` source. Stronger than documentation, **weaker than observation** — Supabase Cloud runs a pinned release, not `master`, and the running version was not confirmed |
> | ⚪ **Assumed** | Documentation or community discussion. Not evidence |
>
> Nothing below is promoted from ⚪ to 🔵 or 🟢 without the thing that earns it.
> The previous revision of this plan carried the 24-hour window as ⚪; it is now
> 🔵, and the difference is that the line of code has been read.

### V1 · Reauthentication email template — ⬜ **NOT VERIFIED. Needs you.**

**This one I cannot check** — it is dashboard state on your project, and it is
the single item that would make the whole flow dead-end silently.

> **Dashboard → Authentication → Emails → Reauthentication.** Please confirm:
>
> 1. The template **exists** and is not disabled.
> 2. Its body contains **`{{ .Token }}`** — the 6-digit code. Not
>    `{{ .TokenHash }}`, not `{{ .ConfirmationURL }}`. Reauthentication is a
>    **code to type**, not a link to click; a template built around a link
>    sends the user something they cannot use.
> 3. The subject line is recognisable as a security action.

Until that is answered, step 7 is blocked — not because the code cannot be
written, but because there is no way to test it.

### V2 · A password change **does** sign out the user's other sessions — 🔵 **source-verified**

`models.User.UpdatePassword` calls **`LogoutAllExceptMe(sessionID, userID)`**,
and `Logout(userID)` — *all* sessions — when there is no session. It also
clears every outstanding one-time token: confirmation, recovery, email-change,
phone-change and reauthentication.

**Three consequences, and the first changes the UI.**

1. **The copy must say so.** "You'll be signed out on your other devices."
   Otherwise the user's phone logs out an hour later with no explanation — the
   kind of unexplained event that reads as a compromise.
2. **It is not instant, and we must not imply that it is.** Milestone 2
   measured that **PostgREST keeps accepting an existing access token until it
   expires** — up to an hour — after sign-out. What is revoked immediately is
   the *refresh* token. So: *"Other devices will be signed out"*, never
   *"immediately"*.
3. **Q3 is partly answered by accident.** Sign-out-everywhere is deferred, yet
   a password change already performs it. That does not reopen Q3 — it means
   the *deferral* is narrower than it sounded, and open decision 12 should say
   so.

### V3 · The code's validity window = the **email OTP expiry** — 🔵 **source-verified**, value ⬜ unread

`verifyReauthentication` validates the nonce with `config.Mailer.OtpExp` — the
**same** expiry as every other email OTP on the project. There is no separate
reauthentication setting.

> **Dashboard → Authentication → Emails (or Providers → Email) → Email OTP
> Expiration.** Please read the value, so the copy can state a real number.

Two further source facts shape the UI:

- **There is one token slot per user** (`reauthentication_token`). A resend
  **overwrites** the previous code. If a user requests twice, only the newer
  code works — so the UI must not leave the earlier email looking equally
  valid.
- **The window starts when the code is sent**, not when the form is opened.

### V4 · Email change is **NOT** gated by reauthentication — 🔵 **source-verified**

The reauthentication check sits inside `if params.Password != nil`. An email
change is unaffected. **The change-email card therefore needs no state
machine** (§3.4.5 stands), and §2's "Unverified" row is now answered: **No**.

Two other gates do apply to it, neither relevant today but both worth knowing:

| Gate | Effect | Relevant now? |
| --- | --- | --- |
| **MFA / AAL2** | With MFA enabled, changing email *or* password from an `aal1` session returns `insufficient_aal` | No — MFA is M13. **It will matter then**, and it affects both cards |
| **`email_exists`** | Changing to a registered address returns `422` | **Yes** — see D-F |

### V6 · The window is measured from session **creation** — 🔵 **source-verified**

```go
// we require reauthentication if the user hasn't signed in recently in the current session
if session == nil || now.After(session.CreatedAt.Add(24*time.Hour)) {
```

`session.CreatedAt`. Not `refreshed_at`, not `updated_at`, not any token claim.
The `24*time.Hour` is a literal in the handler — **not configuration**, which
is what "hardcoded" meant in the previous revision and is now read rather than
assumed.

**This closes the worry behind V6.** A refresh-based window would never expire
for an active user and would have made the stale branch nearly unreachable. It
is creation-based, so **every session reaches it after a day**, and the stale
branch is the common case for returning users — not an edge case.

Note also `session == nil` → reauthentication required. Not reachable from our
flow, which always holds a session, but it is why the service layer must handle
the branch rather than treat it as impossible.

### What is still ⚪ assumed

| | |
| --- | --- |
| **The release running on Supabase Cloud matches `master`** | The one assumption underneath every 🔵 above. The handler's shape has been stable for years, but "stable for years" is not "verified today" |
| Whether Supabase Cloud sends a **password-changed notification** email | The source has a `password_changed_notification` template; whether it is enabled on hosted projects is unknown. If it is, the user receives mail we did not plan for |
| The exact wording of the hosted reauthentication template | V1 |

**Sources.** Reference documentation:
[updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser) ·
[reauthenticate](https://supabase.com/docs/reference/javascript/auth-reauthentication) ·
[Password security](https://supabase.com/docs/guides/auth/password-security).
Source, read 2026-11-13 at `supabase/auth@master`:
[`internal/api/user.go`](https://github.com/supabase/auth/blob/master/internal/api/user.go) ·
[`internal/api/reauthenticate.go`](https://github.com/supabase/auth/blob/master/internal/api/reauthenticate.go) ·
[`internal/models/user.go`](https://github.com/supabase/auth/blob/master/internal/models/user.go).
Community discussion, **not** treated as evidence:
[#32972](https://github.com/orgs/supabase/discussions/32972) ·
[#34323](https://github.com/orgs/supabase/discussions/34323) ·
[#34956](https://github.com/orgs/supabase/discussions/34956).

---

## 11. Risks

| | |
| --- | --- |
| **Widening a grant to fix a 403** | The single most likely way this milestone damages Milestone 3's work. Acceptance criteria forbid it |
| **Rendering `reauthentication_needed` as an error** | The most likely way the reauthentication flow ships broken: it looks like a handled error, so nothing crashes and nobody notices the user simply cannot change their password |
| **The stale branch never being exercised** | It is the branch most users will hit, and the hardest to reach deliberately. Mitigated by §6.3's scheduling note and D-E |
| **Rate-limiting the user out of their own password change** | The code email shares the project-wide built-in sender (O1). Mitigated by the cooldown; genuinely fixed only by custom SMTP |
| **Silent sign-out on the user's other devices** | V2: a password change calls `LogoutAllExceptMe`. Unannounced, it reads to the user as a compromise. Mitigated only by copy, which is why the `done` state is an acceptance criterion |
| **A second code invalidating the first** | V3: one token slot per user. A user who requests twice and then types the first code is refused with no explanation unless the resend says so |
| **Adding `email` to `profiles`** | It would make `/profile` simpler and is explicitly rejected by D.2 |
| FORCE RLS confusing verification | Mitigated by §5.1 |
| 🔴 **D12** | **Not mitigated, and reauthentication does not touch it.** Proving *who* is setting a password says nothing about *what* they are setting it to. M7 adds a second entry point for a breached password and must not appear to close D12 |
