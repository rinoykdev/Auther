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
| Scope | Profile editing, change password, change email |
| Depends on | Milestone 3 (applied ✅), Milestones 4–6 (built ✅) |
| Architecture | C.7, D.2, E.4, F screens 7 and 8 |
| Status | **Plan only. No implementation.** |

---

## 1. Scope

### In

1. **`/profile`** — view and edit `display_name`. Email shown **read-only**.
2. **`/settings/security`** — change password, change email.
3. Error, loading, success and unsaved-change states for all three.

### Out, deliberately

| | Why | Where |
| --- | --- | --- |
| Avatar **upload** | Needs Storage buckets plus their own policies — a second access-control surface, not a form field | M13 |
| Account deletion | Its own milestone and its own test pass; the most dangerous operation in the system | M12 |
| Role editing | Nothing in the app may grant a role (D.7.1). `user_roles` has **no write grant at all** | M10 / out of band |
| Sign out of all devices | Open decision 12, unanswered | — |
| MFA | | M13 |

**`avatar_url` is in scope as a column and out of scope as an upload.** The
column exists and carries an `UPDATE` grant. M7 may let a user paste a URL or
may leave the field inert — see §9 Q2. What it must not do is quietly add
Storage.

---

## 2. The three operations are not alike

This is the organising idea of the milestone. One is a database write; two are
Supabase Auth operations that never touch our tables.

| | Goes to | Our tables? | Re-auth | Confirmation email |
| --- | --- | --- | --- | --- |
| **Display name** | PostgREST → `public.profiles` | ✅ yes | No | No |
| **Change password** | Supabase Auth `updateUser` | ❌ no | **Yes, if secure password change is on** | No |
| **Change email** | Supabase Auth `updateUser` | ❌ no | Possibly | **Yes — to BOTH addresses** |

Consequences worth stating up front:

- **Only the first is governed by RLS.** Password and email changes are
  enforced by Supabase Auth; no policy we write can affect them. Testing them
  with pgTAP would prove nothing.
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

Both are additive to `AppRoutes.jsx`. No guard changes. Navigation between
dashboard, profile and security is added — currently there is none, and the
dashboard is a dead end with only a sign-out button.

### 3.2 `/profile`

| Field | Behaviour |
| --- | --- |
| Display name | Editable. 1–80 chars, matching the `profiles_display_name_length` CHECK **exactly** |
| Email | **Read-only**, from the session. A link to Security Settings to change it |
| Avatar | Per §9 Q2 |

States: loading · saving · saved · error · **unsaved changes** (prompt on
navigate away).

**Client validation must mirror the CHECK constraint, not approximate it.** A
client that allows 100 characters produces a 400 from PostgREST that reads as
a bug; one that allows 0 produces a constraint violation. The bound is 1–80 and
is already in the database — §5 asserts the two agree.

### 3.3 `/settings/security`

**Change password** — new password, confirm password. Min 10 (`MIN_PASSWORD_LENGTH`).

> 🔴 **D12 applies here.** Length is the only check. This screen and the reset
> screen are where a breached password enters the system. Do not let this
> milestone be read as closing it.

**Change email** — new address, then a clear statement that **both** the old
and new addresses receive a confirmation and the change takes effect only when
both are confirmed (C.7). The email to the **old** address is what protects a
user whose session has been stolen — the UI should say so, not bury it.

### 3.4 Reauthentication

C.7 commits to enabling Supabase's **secure password change**, which requires
recent authentication and supplies a nonce by email via `reauthenticate()`.

⚠️ **Whether that option is enabled on `zhlnyokrxppzsfahijiu` is unverified.**
Step 1 of implementation is to check, because it decides whether this milestone
contains a reauthentication screen or not. Do not build speculatively.

**If a recency check is needed, it reads `amr[].timestamp` from a verified
token — never `iat`, never `amr` membership, never a client-supplied value**
(C.8.1, D15). A token refresh advances `iat` and does **not** re-prove identity.

### 3.5 Service layer

All calls go in `authService.js` / a new `profileService.js`. Components never
touch `supabase.*` directly (B.3).

```
getProfile()                      -> select from profiles
updateProfile({ displayName })    -> update profiles  (display_name only)
changePassword({ password })      -> auth.updateUser
changeEmail({ email })            -> auth.updateUser
reauthenticate()                  -> auth.reauthenticate   (if required)
```

`updateProfile` sends **only** the columns it names. Sending a whole object
invites a future column to be written by accident — the column grant would
refuse it, but as an opaque 403 rather than a clear bug.

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

**If this milestone finds itself writing a migration, something has been
misunderstood** — most likely an attempt to store email or roles in `profiles`.
Stop and re-read D.2 and D.7.

### 4.2 Only if §9 Q1 adds columns

A new column means **one** migration carrying the column, its grant and its
policy implications together (checklist item 14), plus pgTAP for both gates in
the same file. A column added without a column-level `UPDATE` grant is
invisible to the client and looks like a frontend bug.

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

### 6.1 Frontend (Vitest + RTL) — ~14 new

| | |
| --- | --- |
| Profile | loads and displays; email is read-only and has no input; save calls `updateProfile` with `display_name` **only**; rejects empty; rejects 81 chars; accepts 80; shows error on failure; warns on unsaved navigation |
| Security | password < 10 rejected; mismatch rejected; success calls `updateUser`; email change states both addresses must confirm; errors map through `toUserMessage` |

### 6.2 pgTAP — **likely none**

The gates already have coverage and M7 adds no objects. One **possible**
addition: assert the CHECK bound is exactly 1–80, so the frontend constant and
the constraint cannot drift apart.

### 6.3 Manual, against the cloud project

Only these prove the milestone:

1. Change display name → reload → persists → **dashboard reflects it**
2. Change password → sign out → old password **fails** → new password works
3. Change email → **both** addresses receive mail → change applies only after both confirmed
4. **Attempt to update another user's profile** with a crafted request → refused by RLS

**Test 4 is the only adversarial one and the only one that tests security.**
1–3 confirm the feature works; 4 confirms it cannot be abused. Needs a second
account, which §Open items already requires for requirement 7.

---

## 7. Acceptance criteria

**Functional**

- [ ] `/profile` and `/settings/security` reachable, both behind `ProtectedRoute`
- [ ] Display name persists and is visible on the dashboard after reload
- [ ] Email on `/profile` is read-only and read **from the session**
- [ ] Password change works; **old password stops working** (verified, not assumed)
- [ ] Email change sends to **both** addresses and applies only after both confirm
- [ ] Every error reaches the user through `toUserMessage` — no raw Supabase string

**Security**

- [ ] 🔑 A request to update **another** user's profile is **refused** — demonstrated, not argued
- [ ] No new grant, no widened grant, no new policy
- [ ] `profiles` gains **no** `email` column and **no** role column
- [ ] No code path writes `user_roles`
- [ ] Any recency check reads `amr[].timestamp` from a **verified** token
- [ ] `confirmPassword` never leaves the browser

**Process**

- [ ] All three CI jobs green
- [ ] Frontend suite ≥ 39 + new, all passing
- [ ] D12 still listed 🔴 OPEN — **this milestone does not close it**
- [ ] Architecture and decisions updated

---

## 8. Steps

| # | Step | Output |
| --- | --- | --- |
| 1 | **Verify** whether secure password change is enabled | Decides §3.4. Do first |
| 2 | Settle §9 questions | |
| 3 | `profileService.js` + tests | |
| 4 | `/profile` + tests | |
| 5 | `/settings/security` + tests | |
| 6 | Reauthentication screen **only if step 1 requires it** | |
| 7 | Navigation between dashboard / profile / security | |
| 8 | Manual cloud pass, including adversarial test 4 | Test report |
| 9 | Documentation | |

Step 1 before step 2 deliberately: a configuration fact decides a screen's
existence, and guessing it is how a milestone grows a feature nobody needed.

---

## 9. Open questions — needed before step 3

**Q1 · Any profile fields beyond `display_name` and `avatar_url`?**
Open decision 9, still unanswered. Free to answer now; a migration plus grant
plus policy review afterwards. Timezone, job title and phone are the usual
additions. *Recommendation: none — keep the module reusable.*

**Q2 · What does `avatar_url` do in M7?**
(a) hidden; (b) paste a URL; (c) wait for Storage in M13.
*Recommendation: (a).* A URL field invites arbitrary external image loading
from a column other users may eventually read — an SSRF-adjacent and
tracking-pixel surface for a feature nobody asked for.

**Q3 · Sign out of all devices?**
Open decision 12. `signOut({ scope: 'global' })` already does it — this is a
UI affordance. Note the Milestone 2 finding: PostgREST keeps accepting the
existing **access** token for up to an hour after sign-out. The button cannot
promise immediacy.

**Q4 · Is the dashboard still the landing page?**
It is currently a dead end. M7 adds the first real navigation and the
dashboard may become a profile summary instead. A UX call, not a security one.

---

## 10. Risks

| | |
| --- | --- |
| **Widening a grant to fix a 403** | The single most likely way this milestone damages Milestone 3's work. Acceptance criteria forbid it |
| **Adding `email` to `profiles`** | It would make `/profile` simpler and is explicitly rejected by D.2 |
| Secure-password-change state unknown | Mitigated by step 1 |
| FORCE RLS confusing verification | Mitigated by §5.1 |
| 🔴 D12 | **Not mitigated.** Change-password is a second entry point for a breached password. M7 does not close it and must not appear to |
