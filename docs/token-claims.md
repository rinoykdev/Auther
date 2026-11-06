# Token claim investigation — observed behaviour

Discharges the verification requirement in `architecture.md` §C.8.1, which the
account-deletion design depends on.

| | |
| --- | --- |
| Date | 2026-11-06 |
| Project | Supabase Cloud **development** project |
| Method | Public Auth REST API with the publishable key. No secret key used |
| Account | One disposable account, confirmed by a real email, **pending deletion** (see Cleanup) |
| supabase-js | 2.119.0 (observations made against the REST API directly) |

**Everything below is an observation.** Nothing was assumed, and the two places
where the architecture made a prediction are reported as tested, not confirmed.

**No complete JWT, password or secret appears in this file or in the repository.**
Claim values that identify a person or session are recorded as present/redacted;
timestamps are recorded as *relative* behaviour, which is the finding that
matters.

---

## 1. The claim set

Observed on an access token from a password sign-in:

| Claim | Type | Notes |
| --- | --- | --- |
| `iss` | string | `https://<ref>.supabase.co/auth/v1` |
| `sub` | string | user id (redacted) |
| `aud` | string | `authenticated` |
| `exp` | number | epoch; 1 hour after issue (`expires_in: 3600`) |
| `iat` | number | epoch |
| `email`, `phone` | string | redacted |
| `app_metadata` | object | keys: `provider`, `providers` |
| `user_metadata` | object | keys: `email`, `email_verified`, `phone_verified`, `sub` |
| `role` | string | `authenticated` — the database role PostgREST switches to |
| `aal` | string | `aal1` |
| `amr` | **array of objects** | `[{ "method": "password", "timestamp": <epoch> }]` |
| `session_id` | string | redacted |
| `is_anonymous` | boolean | `false` |

### 🔴 `auth_time` is ABSENT

**Supabase does not emit an `auth_time` claim.**

This contradicts `architecture.md` §C.8.1, which specifies measuring the
recent-authentication window against `auth_time` and treats anything else as a
documented fallback. That section needs amending; see §5.

The architecture's *reasoning* is unaffected — "how long ago did this user
authenticate?" is still the only correct question. What changes is which claim
answers it.

### `amr` carries a per-method timestamp

`amr` is an **array of objects**, each with `method` and `timestamp` — not an
array of strings. §C.8.1 flagged both shapes as possible; this is the one we
have.

---

## 2. Behaviour across a token refresh

The decisive test. If the authentication timestamp advances on refresh it is
useless as a recency signal.

| Claim | Before | After | Result |
| --- | --- | --- | --- |
| `iat` | 1793954232 | 1793954250 | **advanced** (+18s) |
| `exp` | 1793957832 | 1793957850 | **advanced** |
| `amr[].timestamp` | 1793954232 | 1793954232 | **unchanged** ✅ |
| `amr[].method` | `password` | `password` | unchanged |
| `aal` | `aal1` | `aal1` | unchanged |
| `session_id` | — | — | unchanged |
| `auth_time` | absent | absent | — |

**`iat` advanced while the `amr` timestamp held steady.** This is precisely the
property a recency window requires, and it demonstrates concretely why `iat` is
not a substitute: a background refresh moves `iat` without the user proving
anything.

At first sign-in `iat` and the `amr` timestamp were identical, which is exactly
how this mistake gets made — they only diverge after a refresh.

---

## 3. Behaviour on reauthentication

A second password sign-in, as §C.8 step 1 specifies.

| | |
| --- | --- |
| `amr` timestamp before | 1793954232 |
| `amr` timestamp after | 1793954265 |
| Moved forward | **yes**, by 33s (the real elapsed time) |
| `session_id` | **new session** |
| `aal` | `aal1` → `aal1` |

**Reauthentication moves the timestamp to now.** Combined with §2, the `amr`
timestamp advances only on genuine authentication.

---

## 4. What sign-out actually does

§C.8.1 required this be investigated openly. `architecture.md` H.3 Family 4
*predicted* that PostgREST would accept a signed-but-revoked token until `exp`
while a server-side `getUser()` would reject it.

Scope used: `global` (`POST /auth/v1/logout?scope=global`, HTTP 204).

| Check | Before sign-out | After sign-out |
| --- | --- | --- |
| `GET /auth/v1/user` (`getUser`) | `200` | **`403` rejected** |
| PostgREST (table probe) | `404 PGRST205` — token accepted | **`404 PGRST205` — token still accepted** |
| Refresh token | — | **`400` rejected** — "Refresh Token Not Found" |

### 🟢 The prediction holds — and the error message explains why

`getUser()` rejects with:

> `Session from session_id claim in JWT does not exist`

So `getUser()` validates the `session_id` claim against **server-side session
state**, not merely the signature. That is the mechanism the deletion design
relies on, and it is now observed rather than hoped for.

Meanwhile **PostgREST continues to accept the token** — it validates the
signature and `exp`, and knows nothing about revoked sessions. A stolen access
token keeps working against the database for up to an hour after sign-out.

**Consequences:**

1. §C.8 step 3.2's rule — *verify with `getUser()`, never merely decode* — is
   not a stylistic preference. A decode-only check would accept a token from a
   signed-out session; `getUser()` would not.
2. The REST API's one-hour exposure window after sign-out is **inherent**, not a
   misconfiguration. Row Level Security is what limits the damage, which is
   another reason RLS must be right before any table ships.
3. H.3 Family 4's test case should assert this *difference* explicitly.

### Note on method

An earlier probe of `/rest/v1/` returned `401` both before and after sign-out
and proved nothing. The REST **root** now requires a secret key
(`"Only secret API keys can be used for this endpoint"`). Probing a *table*
path instead distinguishes correctly: `404 PGRST205` means PostgREST accepted
the token and reached schema lookup.

---

## 5. Implementation path — needs a decision

§C.8.1 gave an ordered fallback list. Re-evaluated against the evidence:

| Option | Status |
| --- | --- |
| 1. `auth_time` | ❌ **Unavailable.** Supabase does not emit it |
| 2. Server-side session inspection (Admin API / `auth.sessions`) | ✅ Available. Needs the secret key and one extra server call per deletion |
| 3. Custom access token hook injecting a trustworthy claim | ✅ Available. More moving parts |
| 4. `amr[].timestamp` | ✅ Available, and **verified to behave correctly** (§2, §3) |

### Recommendation

**Use option 4 as the primary signal, with a test that fails loudly if its shape
changes.** The reasoning:

- §C.8.1 ranked it last and called it "known-fragile". That judgement was made
  *without evidence*. The evidence now shows it holds steady across refresh and
  advances only on real authentication — the exact contract required.
- Option 2 is more authoritative, since server-side state cannot be stale. But
  it costs a secret-key call on an operation performed once per account, and it
  couples the deletion function to an internal table or admin endpoint whose
  shape is no more guaranteed than `amr`'s.
- The real protection is not the claim. It is that the Edge Function **verifies
  the token with `getUser()` first** (§4), reads the user id only from the
  verified `sub`, and accepts no identifier from the request.

**This is a recommendation, not a decision.** §C.8.1's ordering was approved;
changing it is yours to approve. It is not urgent — account deletion is
Milestone 12 — but it should be settled before that milestone starts.

### Required amendments to `architecture.md`

1. **§C.8.1** — `auth_time` is unavailable. Rewrite around the `amr` timestamp,
   keeping the `amr`-method / `amr`-timestamp distinction explicit: `amr`'s
   *presence* still proves nothing about recency, only its *timestamp* does.
2. **§E.2** — the claim list should show `amr` as array-of-objects and drop
   `auth_time`.
3. **§C.9** — transition table rows referencing "authentication time" should
   name the `amr` timestamp.
4. **§H.3 Family 4** — the PostgREST-vs-`getUser` difference is now confirmed;
   restate it as observed, and keep the test.

The architectural rule is **unchanged and still binding**: the window is
measured against a verified timestamp of the authentication event, and `amr`'s
presence alone is never accepted as proof that authentication was recent.

---

## 6. Cleanup — complete (2026-11-06)

| Account | Status |
| --- | --- |
| `+m2test1` | Deleted by the user; **verified** |
| `+m2probe2` | Deleted by the user; **verified** |
| `+m2test2`, `+m2test3` | Never created |

**Verification method.** A sign-in was attempted with the *correct* password for
each. Both returned `Invalid login credentials`, which for a known-good password
can only mean the account no longer exists.

That identical response is also account-enumeration resistance working as
architecture E.6 specifies: the API does not distinguish "no such user" from
"wrong password". Useful to have observed — it is one of the H.3 Family 3 cases.

The throwaway passwords were held only in a scratchpad file outside this
repository, which has been overwritten and deleted along with the investigation
scripts. No password was ever printed, committed, or reused.
