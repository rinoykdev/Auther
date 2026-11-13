# Milestone 7 — final implementation checklist

Awaiting your approval. **Nothing in this file has been built.**

| | |
| --- | --- |
| Plan | `milestone-7-plan.md` (revised 2026-11-13) |
| Approved decisions | D-A, D-B, D-C, D-D, D-E — see `decisions.md` D24 |
| Open decision | **D-F** — `email_exists` wording on the change-email form |
| Blocked on | **V1** — the reauthentication email template (dashboard, yours) |
| 🔴 Still open | **D12 — no breached-password protection. M7 does not close it** |

> **D12, stated once and plainly.** Nothing in this milestone checks a password
> against a breach corpus. Length is the only rule. Reauthentication proves
> *who* is setting the password; it says nothing about *what* they set. M7 adds
> a **second** entry point for a breached password — the first being the reset
> flow. No acceptance criterion below may be read as mitigating this.

---

## 0 · Before any code

- [ ] **V1 · Reauthentication email template.** Dashboard → Authentication →
      Emails → Reauthentication. Confirm it exists, is enabled, and contains
      **`{{ .Token }}`** (the typed code) rather than `{{ .ConfirmationURL }}`.
      **Step 7 is blocked until this is answered** — not for the code, for the
      testing.
- [ ] **Email OTP expiry value.** Read it; it is also the reauthentication code's
      lifetime (V3). The UI states this number.
- [ ] **D-F approved.**
- [ ] **Schedule the aged session.** Sign in on a dedicated browser profile and
      leave it. It must be >24h old by step 9, or test 3 closes as ⬜ under D-E.
- [ ] Record V1 and the expiry value in `supabase-config.md`.

---

## 1 · API response handling

### 1.1 `authService.js` — add, do not modify

- [ ] **Leave `updatePassword({ password })` exactly as it is.** It is the
      **recovery** flow's call (`ResetPasswordPage`). Recovery is unaffected by
      secure password change because the recovery link mints a **fresh**
      session, which is inside the 24-hour window. Changing its signature would
      put a working, tested flow at risk for no reason.
- [ ] Add `requestReauthentication()` → `supabase.auth.reauthenticate()`.
- [ ] Add `changePassword({ password, nonce })`:

```js
export async function changePassword({ password, nonce }) {
  const { error } = await supabase.auth.updateUser(
    nonce ? { password, nonce } : { password },
  )
  if (!error) return { status: 'ok' }
  if (error.code === 'reauthentication_needed')
    return { status: 'reauthentication_required' }
  return { status: 'error', message: toUserMessage(error) }
}
```

- [ ] **`reauthentication_needed` never leaves this function as an error.** It
      is converted to a status here, in one place. A component that
      string-matches an error message breaks silently the day Supabase rewords
      it.
- [ ] **Do not send `nonce` when there isn't one.** Inside the 24-hour window
      GoTrue ignores it; sending one unconditionally would mean requesting an
      email nobody needs, against a rate-limited sender.
- [ ] Add `changeEmail({ email })` → `updateUser({ email })`. **No state
      machine** — V4 confirms from source that email change is not gated.

### 1.2 `profileService.js` — new

- [ ] `getProfile()` → `select('display_name, created_at').single()`
- [ ] `updateProfile({ displayName })` → `update({ display_name })` — **that
      column and no other.** Never spread a whole object: a future column
      written by accident is refused by the column grant as an opaque 403, not
      as a clear bug.
- [ ] Never send `id`, `created_at` or `updated_at`. **The correct response to
      a 403 on `updated_at` is to stop sending it, never to widen the grant.**

---

## 2 · The three-state UI flow

Lives entirely inside the change-password card on `/settings/security`.
**No route, no `navigate()`, no `location.state`** (D-C).

```
[ idle ] --submit--> changePassword({ password })
                           |
            status 'ok' ---+--- status 'reauthentication_required'
                 |                          |
                 v                   requestReauthentication()
             [ done ]                       |
                                            v
                                   [ awaiting code ]
                                            |
                              changePassword({ password, nonce })
                                            |
                           'ok' ------------+------------ 'error'
                            |                                |
                            v                       stay in [ awaiting code ]
                        [ done ]
```

- [ ] One `useState` holding `'idle' | 'submitting' | 'awaiting_code' | 'verifying' | 'done'`.
- [ ] In `awaiting_code`: password fields become a **read-only summary**, one
      code field appears, plus *Resend* and *Cancel*.
- [ ] **Explain why, without blaming.** *"For your security, confirm it's you.
      We've emailed a code to `you@example.com`."* Not *"your session has
      expired"* — it has not, it is still working, and the wording alarms.
- [ ] *Resend* reuses the **60-second cooldown** pattern from `CheckEmailPage`.
      Same reason: the built-in sender is project-wide and rate-limited, and
      four impatient clicks lock the user out of the code they are waiting for.
- [ ] *Resend* copy says a **new code replaces the previous one** (V3 — there is
      one token slot per user; an earlier code silently stops working).
- [ ] The code field states the expiry read in §0.
- [ ] `done` state: success alert that **also says other devices are signed
      out** (V2) — and **does not say "immediately"**. Milestone 2 measured that
      an existing access token keeps working against PostgREST for up to an
      hour.
- [ ] A **second** password change in the same sitting will ask for a **second**
      code. Correct — reauthentication does not reset the session's age. The UI
      must not present it as a failure.
- [ ] The change-email card is independent and never enters this machine.

---

## 3 · Password-memory lifecycle (D-D)

The typed password crosses one state boundary. Where it lives is the whole of
this section.

- [ ] Held in **component `useState` only**, for the lifetime of the card.
- [ ] ❌ Never `localStorage`, ❌ never `sessionStorage`, ❌ never a URL or query
      string, ❌ never route `state`, ❌ never a ref that outlives the route,
      ❌ never a module-level variable.
- [ ] **Never sent to `requestReauthentication()`.** That call takes nothing.
- [ ] **Not re-requested after the code step.** Making someone retype a
      password after a trip to their inbox is where they give up and choose
      something weaker.
- [ ] `confirmPassword` is compared and discarded. It never reaches the network.
- [ ] *Cancel*, navigation away, and `done` each **clear both fields**.
- [ ] Unmount clears state — which is why `awaiting_code` is a state and not a
      route: a route would need the password to survive navigation, and every
      place to put it is forbidden above.
- [ ] No `console.log` of the password, the code, or the token, in any state.
- [ ] One test asserts **nothing was written to storage** during the whole flow.

---

## 4 · Error handling

### 4.1 `errorMessages.js` additions

- [ ] `reauthentication_not_valid` → *"That code is not right, or it has
      expired. Check the code, or request a new one."*
- [ ] `reauthentication_needed` → a sensible string **as a safety net only**.
      It should never render; §1.1 consumes it first. The entry exists so an
      unhandled escape reads sensibly instead of hitting the generic fallback.
- [ ] `email_exists` → per **D-F**, pending approval.
- [ ] Already mapped, no change: `same_password`, `weak_password`,
      `over_email_send_rate_limit` — the last is **newly reachable** here.

### 4.2 Rules

- [ ] Every displayed error goes through `toUserMessage`. No raw Supabase
      string reaches the screen.
- [ ] An error in `awaiting_code` **keeps the user in `awaiting_code`**. It does
      not reset the card and does not discard the typed password.
- [ ] `insufficient_aal` is **not** handled. MFA is M13; a mapped message for a
      state that cannot occur is dead code that looks like coverage.

---

## 5 · Tests

### 5.1 Unit — Vitest + RTL, ~20 new

**Profile**
- [ ] loads and displays the profile
- [ ] email is read-only, rendered from the session, has no input
- [ ] save calls `updateProfile` with `display_name` **and nothing else**
- [ ] rejects empty · rejects 81 chars · accepts 80
- [ ] error state on failure
- [ ] warns on navigating away with unsaved changes

**Change email**
- [ ] invalid address rejected client-side
- [ ] success states that **both** addresses must confirm
- [ ] `email_exists` maps per D-F
- [ ] ❗ **`requestReauthentication` is never called** (V4)

**Change password — fast path**
- [ ] < 10 chars rejected · mismatch rejected
- [ ] `changePassword` called **without a nonce**
- [ ] ❗ **`requestReauthentication` is never called**
- [ ] success → `done`, fields cleared

**Change password — reauthentication path**
- [ ] `reauthentication_required` → `requestReauthentication()` called once
- [ ] the code field appears; the password fields are no longer editable
- [ ] submitting the code calls `changePassword` with **the same password** and
      the nonce
- [ ] a wrong code keeps the component in `awaiting_code` and shows the error
- [ ] resend respects the cooldown
- [ ] **cancel discards the password**
- [ ] ❗ **nothing is written to `localStorage` or `sessionStorage`**

Both branches are chosen by a **mocked service response**, not by a clock —
which is why they are fully testable while §5.2 test 3 is not.

### 5.2 Manual, against the cloud project

- [ ] 1 · display name persists, dashboard reflects it after reload
- [ ] 2 · password change on a **fresh** session — no code requested; old
      password then fails, new one works
- [ ] 3 · password change on a session **>24h old** — code arrives, change
      succeeds ⬜ *may close unexercised under D-E*
- [ ] 4 · a **wrong** code is refused and the flow recovers
- [ ] 5 · email change → **both** addresses receive mail → applies only after both
- [ ] 6 · 🔑 **a crafted request to update another user's profile is REFUSED**
- [ ] 7 · after a password change, a **second browser** is signed out (V2)

**Test 6 is the only adversarial one and the only one that tests security.**
1–5 and 7 confirm the feature works; 6 confirms it cannot be abused. It needs
the second account the open items already require.

> **Test 3 cannot be forced.** The 24-hour threshold is a literal in GoTrue
> (V6) and session age cannot be faked from a client. If the aged session was
> not scheduled in §0, record it ⬜ **not yet exercised** in the test report —
> in the same three-way split as `auth-flow-test-report.md`, **never as a
> pass**.

### 5.3 pgTAP

- [ ] **None expected.** M7 creates no database object. One optional addition:
      assert the display-name CHECK is exactly 1–80, so the frontend constant
      and the constraint cannot drift apart.

---

## 6 · Done means

- [ ] All of §1–§5 ticked, or explicitly recorded as ⬜ with a reason
- [ ] Three CI jobs green · frontend suite ≥ 39 + new, all passing
- [ ] **No migration. No new grant. No widened grant. No new policy.**
- [ ] `profiles` has gained **no** `email` column and **no** role column
- [ ] 🔴 **D12 still listed OPEN.** No document, commit message or release note
      claims breached-password protection
- [ ] `architecture.md`, `decisions.md`, `supabase-config.md` and the test
      report updated

---

## Build order

| Step | | Why here |
| --- | --- | --- |
| 1 | §0 verification | V1 blocks testing, not coding — but discovering a link-based template at step 7 wastes step 7 |
| 2 | `profileService` + tests | Smallest, no auth interaction |
| 3 | `/profile` + tests | |
| 4 | Change-email card + tests | Independent of everything in §2 |
| 5 | **Change-password, fast path only** + tests | A complete working feature for anyone who signed in today |
| 6 | **Reauthentication state machine** + tests | Added to something already proven, so a bug here cannot be confused with a bug there |
| 7 | Navigation dashboard ↔ profile ↔ security | |
| 8 | Manual pass §5.2 | Needs the aged session from §0 |
| 9 | Documentation | |

Steps 5 and 6 are split deliberately.
