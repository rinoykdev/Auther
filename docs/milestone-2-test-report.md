# Milestone 2 — test report

Format per `architecture.md` §H.5: what was tested, what passed, what failed,
and what remains untested.

| | |
| --- | --- |
| Milestone | 2 — Project setup |
| Date | 2026-11-06 |
| Backend | Supabase Cloud development project |
| Outcome | **Complete.** One accepted limitation and two carry-forward items (§4) |

---

## 1. What was tested

### Automated — run in CI on every push and pull request

| Suite | Count | Result |
| --- | --- | --- |
| Unit (`healthCheck`) | 4 | ✅ pass |
| Component (`LoginPage`) | 4 | ✅ pass |
| Routing (`AppRoutes`) | 4 | ✅ pass |
| End-to-end (Playwright) | 4 | ✅ pass |
| Lint (oxlint) | — | ✅ pass |
| Production build | — | ✅ pass |
| Secret scan — tracked files | — | ✅ pass |
| Secret scan — **full git history** | — | ✅ pass |
| Secret scan — built bundle | — | ✅ pass |

CI run #2: all steps green in both jobs.

### Manual — performed once, recorded here

| Check | Result |
| --- | --- |
| Env guard: missing variables | ✅ Named error with exact remedy |
| Env guard: dashboard URL pasted instead of API URL | ✅ Specific error |
| Env guard: valid values | ✅ Client constructs |
| Connectivity: `Unreachable` | ✅ `TypeError: Failed to fetch`, no status code |
| Connectivity: `Key rejected` | ✅ `401`, `{"message":"Invalid API key"}` |
| Connectivity: `Connected` | ✅ `200` from `/auth/v1/settings` |
| Login UI at 1920, 1600, 375 | ✅ Matches design; stacks on mobile |
| Existing routes after refactor | ✅ Unaffected |
| Browser console | ✅ No errors |

### The harness itself was tested

A test suite that has never failed is not known to work.

| Check | Result |
| --- | --- |
| Deliberately broken assertion | ✅ Suite failed (1 of 12), then restored |
| Planted secret in `dist/` | ✅ Scanner caught it, reported without printing the value |
| History scanner against a string that IS present | ✅ Detected — confirming the step can fail at all |

That last check mattered: `git log -p \| grep \| head` returns *head's* exit
status, so without `pipefail` the step could never fail. The script sets
`pipefail`; both branches were verified rather than assumed.

---

## 2. What failed, and was fixed

| Failure | Cause | Resolution |
| --- | --- | --- |
| `Invalid hook call` after installing packages | Stale Vite dep-optimizer cache gave react-router its own copy of React. Presents as a code error; isn't | `rm -rf node_modules/.vite`. Documented in `setup.md` |
| CI run #1 failed | The secret scanner flagged `scripts/scan-dist.mjs`, which *defines* the patterns it hunts | Excluded that file, with the reason recorded inline |
| Login UI: headline wrapped to 3 lines | `max-w-[16ch]` far too narrow at 44px | Widened |
| Login UI: black boxes around both images | Source JPEGs carry baked-in near-black backgrounds | `mix-blend-screen` plus masked edge fades |
| REST probe proved nothing | `/rest/v1/` root now requires a secret key; returned 401 before *and* after sign-out | Probed a table path instead (`404 PGRST205` = accepted) |

---

## 3. Token investigation (Step 7)

Full detail in `token-claims.md`. Summary:

| Finding | Status |
| --- | --- |
| `auth_time` claim | 🔴 **Absent.** Contradicts architecture §C.8.1 |
| `amr[].timestamp` across refresh | ✅ Unchanged while `iat` advanced |
| `amr[].timestamp` on reauthentication | ✅ Advances to now |
| `getUser()` after sign-out | ✅ Rejects — validates server-side session state |
| PostgREST after sign-out | ⚠️ **Still accepts the token until `exp`** |

The PostgREST result is inherent, not a misconfiguration: a stolen access token
works against the database for up to an hour after sign-out. RLS is what limits
the damage — another reason it must be correct before any table ships.

---

## 4. What failed and is NOT fixed

### 🟡 Leaked-password protection unavailable (accepted limitation)

A signup with `password123` is accepted. **Confirmed gated behind a paid
Supabase plan**, so it cannot be enabled on this tier.

Architecture E.1 commits to this control. The intent stands; the mechanism is
not purchasable here. Reclassified from a failure to an **accepted limitation
for development, unresolved for production**.

The real exposure is credential stuffing, which password length does not
address. Compensating options are set out in `supabase-config.md`; none is
implemented, and the decision is deliberately left open rather than inherited
by silence.

**Before production:** enable Pro, or implement a server-side equivalent. A
client-side check alone does not satisfy E.1, because it is not a boundary.

### 🟡 Architecture amendments outstanding

`token-claims.md` §5 lists four sections requiring revision (C.8.1, E.2, C.9,
H.3) because `auth_time` does not exist. Not urgent — account deletion is
Milestone 12 — but it should be settled before that milestone starts.

### 🟡 Disposable accounts awaiting deletion

`+m2test1` and `+m2probe2`. Deletion requires the secret key, which this project
deliberately does not hold.

---

## 5. What remains untested

Stated plainly, because an untested thing described as done is worse than one
described as pending.

| Area | Why |
| --- | --- |
| Site URL and redirect allow-list | Not exposed on any public endpoint. First exercised in Milestone 4 |
| Rate limits | Dashboard-only values; not recorded yet |
| Email delivery under load | Milestone 2 sent 2 emails. The built-in sender's limits bite in Milestone 4 |
| Email-dependent journeys (register → verify → login, reset) | No automated inbox; deliberately not introduced (plan §5.2) |
| RLS and GRANTs | No tables exist. Milestone 3 |
| pgTAP | No schema to test, and the hosted-database approach is an open decision |
| Auth flows | None implemented. Milestones 4–5 |
| The login screen's behaviour | It has none. Visual only |
| Production build in a deployed environment | Deployment deferred |
| Env guard in CI | It is a **runtime** check; the build succeeds without any `.env.local` |

---

## 6. Conclusion

Milestone 2's definition of done is met: the app builds, runs locally, connects
to Supabase Cloud, is version-controlled with green CI, has a proven test
harness, and the token investigation is complete and recorded.

**Two items carry forward as owner-action:** leaked-password protection, and the
architecture amendments arising from the `auth_time` finding.

Milestone 3 (database foundation: `profiles`, trigger, GRANTs and RLS in one
migration, with pgTAP for both gates) should not begin until the pgTAP-against-
hosted-database decision is made — plan §5.3, decision 5.
