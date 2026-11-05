# Milestone 2: Project Setup — Implementation Plan (Revision 3, Supabase Cloud)

***Approved 2026-11-05.** Implementation in progress. Milestone 1 (architecture) is likewise approved; see `architecture.md` revision 4.*

*Revision 2 replaced the local-Supabase plan with a cloud-backed one, per your infrastructure decision. Docker is removed as a project dependency. Frontend deployment is deferred.*

*Revision 3 applies your three refinements: the token investigation is now a genuinely open investigation with no assumed outcome and no session-revocation implementation; the connectivity health check distinguishes three states precisely and creates no database objects; and test-account creation stays manual, with no email-testing service or automated email infrastructure in this milestone.*

### What changed in revision 3

| # | Your instruction | Where it landed |
| --- | --- | --- |
| 1 | Do not assume `getUser()` rejects a token immediately after sign-out; investigate real token, revocation and session-validation behaviour; record observations without assuming the outcome; implement no deletion or session-revocation logic | Step 7, rewritten — particularly 7.6 and the new "How this investigation is conducted" note; Section 1 "Explicitly not done" |
| 2 | Health check must distinguish network/URL errors, invalid key errors and success; no database objects created for it; document the expected response per state | Step 4, rewritten with a three-state table and an explicit no-schema-objects rule |
| 3 | Keep disposable account creation manual; no email-testing services or automated email infrastructure; custom SMTP stays a Milestone 4 decision | Section 2.1 decision 4, Step 8, and Section 5.2 |

---

## 0. The new architecture

| Layer | Decision |
| --- | --- |
| Frontend | React + Vite, running locally at `http://localhost:5173` |
| Styling | Tailwind CSS v4 *(now settled — the version question in revision 1 is closed)* |
| Backend | Supabase Cloud |
| Database | Hosted PostgreSQL on Supabase |
| Authentication | Supabase Cloud Auth |
| API | Supabase-generated REST API (PostgREST) |
| Storage | Supabase Cloud Storage *(available; not used in this milestone)* |
| Edge Functions | Supabase Cloud Edge Functions, when required *(none in this milestone)* |
| Version control | Git and GitHub |
| Deployment | **Deferred.** No Vercel, no production frontend deployment |

**Removed from the plan entirely:** Docker installation, Supabase CLI local stack, local PostgreSQL containers, local Supabase services, Docker-based testing. Docker is not a dependency of this project.

**What this changes in character.** The previous plan had a disposable local backend: break it, reset it, no consequences. Now every developer action touches a real hosted database over the network. That is simpler to set up and harder to be careless with, and it drives most of the new risks in Section 5 — particularly around email rate limits, shared mutable state, and how database tests run. I have not smoothed those over; they are the parts of this plan that need your attention.

---

## 1. Goal and definition of done

**Goal:** a React app running locally against a real Supabase Cloud development project, with version control, CI, a test harness, and a documented record of how Supabase's tokens actually behave. **No authentication flows are built.** Milestone 2 produces the ground the auth work stands on.

**Done when all of these are true:**

1. `npm run dev` serves a styled page at `http://localhost:5173`.
2. `npm run build` succeeds with no warnings we have not consciously accepted.
3. The locally running app connects to the Supabase Cloud **development** project, proven by a health check that returns a known result rather than an error.
4. Supabase Auth redirect URLs and allowed origins are configured for local development, and the configuration is documented.
5. A push to a branch opens a PR that runs lint, build and tests in GitHub Actions.
6. **The token-claim investigation (architecture C.8.1) is complete and recorded in `docs/`, using disposable accounts and with no complete JWT, password or secret written down.**
7. No secret is in the repository, and a CI check proves it.
8. `docs/setup.md` lets a second developer connect their own local environment to the same development project from a clean machine, without Docker.

**Explicitly not done in Milestone 2:** no tables, no RLS, no grants, no auth screens, no `AuthProvider`, no routes beyond placeholders, no Storage buckets, no Edge Functions, no deployment.

Also explicitly not done, and stated separately because the token investigation sits close to them: **no account-deletion logic, and no session-revocation or token-validation logic of any kind.** Step 7 observes and records how Supabase behaves. It does not build anything that acts on what it finds. The code that enforces the recent-authentication window is written in the account-deletion milestone, against the evidence this milestone produces.

**No email-testing service, mail API, inbox automation or programmatic mailbox** is introduced in this milestone. Test accounts are created and confirmed by hand.

---

## 2. Decisions and manual actions required from you

These are the things I cannot or should not do on your behalf. Items 1–4 block the start.

### 2.1 Decisions I need

| # | Decision | Why it matters | My recommendation |
| --- | --- | --- | --- |
| 1 | **Project separation.** One Supabase Cloud project for development now, with production created later — or both now? | You asked for a separate development project rather than testing against production. I agree. The only question is whether production exists yet | Create **development only** now. Production when deployment is actually on the table |
| 2 | **Region** for the project | Latency during development and, later, data-residency obligations. Changing it later means recreating the project | Nearest region to you, unless you have a residency requirement |
| 3 | **Plan tier** (free vs paid) | Free-tier projects **pause after about a week of inactivity** and must be manually restored, and the free tier limits how many active projects you may have. A paused project mid-milestone is an annoying surprise, not a disaster | Free is fine for Milestone 2. Re-evaluate before Milestone 4, when email volume starts mattering |
| 4 | **Email addresses for test accounts.** There is no local inbox any more — verification emails go to real mailboxes | Step 7 needs two or three confirmation emails. Nothing more | Plus-addressing on a mailbox you already control (`you+m2test1@…`), checked **by hand**. No mail service, no automation, no API. The question of what Milestone 4 needs stays in Milestone 4 (Section 5.2) |
| 5 | **How database tests will run** once tables exist in Milestone 3 | pgTAP previously ran against the local stack. Without Docker it must run against a hosted project, which means tests mutate a real database | Decide in Milestone 3, not now. I will present options with the trade-offs. Flagged here because it is a consequence of this decision, and I would rather you see it coming (Section 5.3) |
| 6 | **Architecture-document drift** (Section 6) | Several sections of the approved architecture document still describe local Supabase, Docker and Vercel | Let me issue revision 4 of the architecture document alongside this plan, so the approved blueprint and the actual infrastructure do not diverge |

### 2.2 Manual actions only you can take

| # | Action | Notes |
| --- | --- | --- |
| A | **Create the Supabase Cloud development project** | Name it so it is unmistakably the development project. I will not create or modify any Supabase project |
| B | **Copy the project URL and publishable key** into your local `.env.local`, from a file I provide as `.env.example` | Both are safe to hold locally. **Do not paste either into this chat** — I do not need them to write the code, and the publishable key being "safe for the browser" is not a reason to put it in a transcript |
| C | **Never copy the secret / service-role key anywhere near the frontend** | It belongs only in Edge Function secrets, later. If it is ever exposed, rotate it immediately |
| D | **Configure Auth redirect URLs** in the Supabase dashboard for local development | I will give you the exact values and the reason for each (Step 5). The Site URL and redirect allow-list are the two that break password reset in confusing ways if they are wrong |
| E | **Create the GitHub repository**, or tell me the name to use and create it yourself | I will not create repositories under your account |
| F | **Create disposable test accounts** when Step 7 runs, using the email strategy from decision 4 | Disposable means: created for the investigation, deleted afterwards, never reused as a real account |

---

## 3. Step-by-step plan

Each step lists what I do, what you do, and how we know it worked. Steps 1–3 need nothing from you beyond the repository.

### Step 1 — Repository skeleton and hygiene *(me)*

- Scaffold the Vite React project (JavaScript, per architecture checklist item 4).
- `.gitignore` covering `node_modules`, `dist`, `.env.local`, `.env*.local`, `.vercel`. **`.env.local` is in `.gitignore` before the file ever exists** — the window in which a credentials file sits in an untracked-but-not-ignored state is exactly when it gets committed by an absent-minded `git add -A`.
- `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, placeholder values only, plus a comment stating that no secret key ever belongs in a `VITE_`-prefixed variable because Vite bundles those into public JavaScript.
- `README.md`: what the project is, how to run it, where the docs live, and a one-line statement that the backend is Supabase Cloud and no Docker is required.
- `docs/` seeded with the approved architecture document.
- Commit the lockfile.

**Verify:** `npm run dev` serves the default page at `localhost:5173`; `git status` and `git check-ignore -v .env.local` confirm the ignore rule is active.

### Step 2 — Tailwind CSS v4 *(me)*

- Install `tailwindcss` and `@tailwindcss/vite`; register the plugin in `vite.config.js`; `@import "tailwindcss";` at the top of `src/index.css`; define initial design tokens with `@theme`.
- **No `tailwind.config.js`, no `postcss.config.js`, no `content` array** — that is the v3 shape and does not apply (architecture B.4).
- I will read the official v4 installation page before installing rather than working from memory.

**Verify:** a utility-class-only element renders correctly in `npm run dev` **and** survives `npm run build`. The build check is the one that matters: a v3/v4 configuration mix typically works in dev and silently drops styles in the production bundle.

### Step 3 — Project structure and Supabase client *(me)*

- Create the folder skeleton from architecture B.2, **in-scope folders only**. No `features/admin/`, no `supabase/functions/` — empty folders that exist to look complete are a way of lying about progress.
- `src/lib/supabaseClient.js`: the single client, built from environment variables, with **`flowType: 'pkce'`**, `detectSessionInUrl: true`, `persistSession: true`, `autoRefreshToken: true` set **explicitly rather than left to defaults**, each with a one-line comment pointing at architecture Section C.9. These are load-bearing for the callback and recovery flows in Milestones 4 and 5, and a silent default change in a future library version is exactly the kind of thing that breaks password reset without breaking a test.
- A fail-fast check that throws a clear, named error at startup if either environment variable is missing. Against a cloud backend this matters more than it did locally: a missing variable otherwise surfaces as a confusing network or 401 error several screens into the app.
- Placeholder `HomePage`, `NotFoundPage`, `ForbiddenPage` and `AppRoutes.jsx` with React Router. **No guards, no auth logic.**

**Verify:** home page renders; an unknown URL renders 404; temporarily unsetting an environment variable produces the intended startup error rather than a vague failure.

### Step 4 — Connect to the Supabase Cloud development project *(you create it; me for everything in the repo)*

- You create the project (action A) and populate your own `.env.local` from `.env.example` (action B).
- I add a **connectivity health check** that resolves to exactly one of three named states.

**Rule: the health check creates nothing.** No table, no view, no function, no row, no bucket, no RPC — nothing exists in the database for the sole purpose of being pinged. A health check that requires a schema object is a schema object that must then be secured, migrated, documented and reasoned about in every later RLS review, which is a poor trade for a connectivity test. The check therefore targets an endpoint the project exposes **before any schema exists**, so it works on a brand-new project and keeps working when tables arrive.

**The three states, and why they are distinguishable.** They separate cleanly because they fail at different layers: the first never reaches Supabase, the second reaches it and is rejected at the gateway, the third reaches it and is answered.

| State | What it means | How it presents | Most likely cause |
| --- | --- | --- | --- |
| **1. Cannot reach the project** | The request never got a response from Supabase | A network-layer failure — DNS resolution failure, connection refused, timeout, or a CORS/`TypeError: Failed to fetch` in the browser. **No HTTP status code**, because no HTTP response arrived | `VITE_SUPABASE_URL` wrong, malformed or pointing at a project that does not exist; project paused (Section 5.1); no internet |
| **2. Reached the project, key rejected** | Supabase answered, and the answer was a refusal | An **HTTP response with an auth-failure status** (expected: `401`, possibly `403`) and a JSON error body naming an invalid or missing API key | `VITE_SUPABASE_PUBLISHABLE_KEY` wrong, truncated, from a different project, or absent |
| **3. Connected** | The client is correctly configured and talking to the right project | A **successful HTTP response** with the expected body shape | Nothing — this is the pass condition |

**Candidate endpoints, in preference order.** Both require only the publishable key and neither depends on schema:

1. **The Auth settings endpoint** (`/auth/v1/settings`) — returns the project's public auth configuration. It has the useful property of also confirming the Auth service specifically, which is the service everything in Milestones 4 and 5 depends on, and its body is independently informative (it reflects whether email confirmation is on, which cross-checks Step 5).
2. **The REST API root** (`/rest/v1/`) — returns the generated OpenAPI description. Works on an empty project; its body simply lists nothing.

**On exact status codes:** I have written the expected behaviour above as *expected*, not as established fact. The precise status code and body for a rejected key are implementation details of the Supabase gateway and can differ by endpoint and version. **Step 4 therefore includes deliberately producing each of the three states and recording what actually came back**, and `docs/setup.md` documents the observed responses — real status codes, real error shapes — not my predictions. If reality differs from the table above, the table gets corrected.

- I document all three states in `docs/setup.md`, with the observed response for each and the remedy.

**Verify:** all three states are produced on purpose and the check names each one correctly — state 3 with the real values; state 2 by corrupting the key in `.env.local`; state 1 by pointing the URL at a non-existent project. Correct values are restored afterwards, and the observed responses are written down.

### Step 5 — Supabase Auth configuration for local development *(you apply; me for the exact values and rationale)*

I will produce a short dashboard checklist, each item traced to its section of the architecture document. It will cover:

- **Site URL:** `http://localhost:5173`.
- **Redirect URL allow-list:** the local callback and reset paths — `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password`. Kept as specific as possible; a broad wildcard is an open redirect waiting to happen (architecture E.6). These are not used until Milestone 4, but configuring and recording them now means the first flow we build fails for real reasons rather than for setup reasons.
- **Allowed origins / CORS:** `http://localhost:5173` only.
- **Email confirmation required** before first login (architecture checklist item 5).
- **Password policy:** minimum length per checklist item 8, plus **leaked-password protection enabled**.
- **Auth rate limits:** reviewed and recorded, not left unexamined — see Section 5.4, because these now apply to a shared real project rather than to a throwaway local one.
- **Note recorded, not actioned:** Supabase's built-in email sender is rate-limited and intended for testing. Custom SMTP (architecture checklist item 10) is still open and now matters more (Section 5.2).

**Verify:** settings read back as expected; a screenshot-free written record of the final configuration lands in `docs/supabase-config.md`, so a second developer or a rebuilt project can be brought to the same state.

### Step 6 — Git, GitHub and CI *(you create the repo; me for everything else)*

- Initial commit, push, branch protection on `main` suggested.
- GitHub Actions workflow running on every PR: install, lint, build, unit tests. **No Docker service containers** — the workflow runs on a plain Node runner.
- **A secret-scanning step that fails the build** if a key-shaped string or a `.env` file is committed (architecture E.5). I want this before any real key exists, not after.
- A **build-output check** that greps `dist/` for anything resembling a secret key. The publishable key *will* be in the bundle and that is expected and correct; the check is looking for the secret key and for stray `.env` content.

**Verify:** a throwaway PR shows all checks passing; a test commit containing a fake key-shaped string is caught and rejected, then reverted.

### Step 7 — Token-claim investigation *(me, using disposable accounts)* — **the substantive engineering task of this milestone**

This discharges the verification requirement in architecture Section C.8.1, which the approved deletion design depends on. It must happen before any code relies on these claims.

**Safety rules for this step, which I will follow without exception:**

- **No complete JWT is ever printed, logged, pasted into chat, or committed.** What gets recorded is the *claim names*, their *types*, and their *behaviour across events* — never full values, never the signature.
- Values that identify a person or a session (`sub`, `email`, `session_id`) are recorded as "present, UUID" or "present, redacted", not reproduced.
- Timestamps are recorded as **relative observations** ("unchanged across refresh", "advanced to now on reauthentication"), which is the finding we actually need, rather than as absolute values.
- **Disposable accounts only**, created for this investigation against the development project and deleted immediately afterwards. No password used here is reused anywhere. No password is written down.
- Nothing from this step enters Git except the redacted findings document.

**The investigation:**

1. Create a disposable account against the **development** project; confirm it via the real email flow (decision 4).
2. Sign in with a password. Inspect the access token's claim set.
3. **Record which claims are present and their shapes:** `auth_time`, `amr`, `aal`, `session_id`, `iat`, `exp`, `sub`, `role`, `email`. For `amr` specifically: is it an array of strings, or an array of objects carrying `method` and `timestamp`? The deletion design's fallback ordering depends on this.
4. **Force a token refresh. Diff the claims.** Required property: `iat` and `exp` advance, and the authentication-time claim does **not**. This is the single most important observation in the milestone — it is what distinguishes `auth_time` from `iat` and is the error revision 2 of the architecture document contained.
5. **Reauthenticate** with a second password sign-in. Confirm the authentication-time claim moves to now.
6. **Investigate what sign-out actually does to a token** — as an open question, not a confirmation of an expected answer. Sign out, then exercise the previously valid access token and record, in each case, exactly what comes back:
   - the access token replayed against the **REST API**;
   - the access token passed to **`getUser()`**;
   - the **refresh token** used to request a new session;
   - the same checks again after a short interval, in case behaviour is time-dependent rather than immediate.

   The architecture document (H.3 Family 4) currently *predicts* that PostgREST accepts a signed token until `exp` while a server-side `getUser()` call rejects it, because the session is gone. **That prediction is exactly what this step tests, and I am not treating it as known.** `getUser()` may validate against server-side session state, or it may validate the signature and expiry only; sign-out may revoke the refresh token while leaving the access token valid until expiry, or may invalidate both; and the answer may depend on whether sign-out used local, global or others scope. Each of those possibilities has a different consequence for the deletion design, and guessing would undermine the point of doing this investigation at all.
7. **Select the implementation path** from C.8.1's ordered fallback list: `auth_time` if present and well-behaved; otherwise server-side session inspection via the Admin API; otherwise a custom access token hook; otherwise, last and documented as fragile, the timestamp inside `amr`.
7. **Record what `signOut` scope was used** for each observation, since Supabase offers local, global and others scopes and they are unlikely to behave identically. Where practical, observe more than one.
8. Delete the disposable accounts.

**How this investigation is conducted, and what it is not.** Every item above is a *recorded observation*. I write down what Supabase did, under what conditions, with the scope and timing noted — including results that contradict the architecture document, which are the most valuable ones. I do **not** write any code that acts on the findings: no token-validation helper, no session-revocation handling, no recent-authentication check, no deletion logic. Those belong to later milestones and will be built against this evidence. Where a finding is ambiguous or I could not establish something cleanly, `docs/token-claims.md` says so in those words rather than rounding to a tidy conclusion.

**A note specific to cloud:** these observations are now made against the real Supabase Cloud build, which is what we will actually run on. That is a genuine improvement over inspecting a local container that may lag the hosted version — the previous plan risked recording behaviour that did not match production.

**Verify:** `docs/token-claims.md` exists, states the observed behaviour and the evidence, names the chosen path with its reason, and contains no complete token, no password and no secret. **If the evidence contradicts the architecture document, I bring that to you as a finding rather than quietly adjusting the design.** That is the point of doing this before writing deletion code.

### Step 8 — Test harness *(me)*

- Vitest and React Testing Library configured, with one real test per layer so the harness itself is proven: a unit test and a component test.
- Playwright installed with a single smoke test (home page loads at `localhost:5173`). Full journeys come later.
- **pgTAP: deferred to Milestone 3**, because there are no tables yet *and* because running it without Docker needs a decision from you (decision 5, Section 5.3). I will not quietly wire up something that mutates a shared cloud database.
- **No email-dependent test automation**, and no mail service, inbox API or mailbox credential anywhere in the harness or in CI. The smoke test does not sign anything up. Journeys that need an email arrive in Milestone 4, with whatever approach is decided then.
- All of it in the CI workflow from Step 6, on a plain Node runner.

**Verify:** `npm test` passes locally and in CI; a deliberately broken test fails the build, then is fixed.

### Step 9 — Documentation and handover *(me)*

- **`docs/setup.md`** — clean-machine reproduction, explicitly **without Docker**: clone, `npm install`, copy `.env.example` to `.env.local`, obtain the project URL and publishable key from the Supabase dashboard, `npm run dev`. Including the three connectivity failure states from Step 4.
- **`docs/onboarding-another-developer.md`** — how a second developer connects their own local frontend to the **same development project**: they get their own copy of the URL and publishable key through a secure channel (a password manager or the dashboard, never chat, never email, never a commit), they create their own `.env.local`, and they must never receive the secret key. Also what is *shared and mutable*: the database, the auth user list and the rate limits are common to everyone on the project, so one person's testing is visible to the others (Section 5.3).
- **`docs/security.md`** — the credential rules in one place: publishable key in the browser is expected and safe **only** when grants and RLS are correct (architecture E.5); secret key never leaves Edge Function secrets; never commit credentials; development project is separate from production; what to do if a key is exposed (rotate immediately — deleting it from Git history is not enough).
- **`docs/supabase-config.md`** — the dashboard configuration from Step 5, in writing.
- **Milestone 2 test report** in the format agreed in architecture H.5: what was tested, what passed, what failed, what remains untested.

---

## 4. What I will deliver for your review

1. The repository, with everything above.
2. `docs/token-claims.md` — the redacted evidence, and any discrepancy with the architecture document.
3. `docs/setup.md`, `docs/onboarding-another-developer.md`, `docs/security.md`, `docs/supabase-config.md`.
4. The Milestone 2 test report.
5. A short list of anything that surprised me, with a recommendation for each.

---

## 5. New requirements, costs, risks and security considerations introduced by Supabase Cloud

This section is new, and it is the part of the revision I would most want you to read. Moving the backend to the cloud removes a dependency and adds a set of constraints that were previously absent.

### 5.1 Costs and account limits

| Item | What to expect |
| --- | --- |
| **Free-tier project pausing** | Free projects **pause after roughly a week without activity** and need manual restoration from the dashboard. Mid-milestone this looks like "everything suddenly broke". Worth knowing before it happens |
| **Active project limit on the free tier** | The free tier caps how many projects can be active at once. A separate development project consumes one of those slots, which constrains the later "separate project for database tests" option in 5.3 |
| **Monthly active users, storage, egress, Edge Function invocations** | All metered. Nothing in Milestones 2–5 will come close, but automated E2E runs in CI can generate more auth activity than you would guess, so it is worth watching rather than assuming |
| **Backups** | Retention is limited on lower tiers. Not a Milestone 2 concern, but it becomes one the moment real user data exists |
| **Verification needed** | Exact current limits and tier boundaries should be read from Supabase's pricing page at the time we create the project rather than taken from this document. I will record what we actually see |

**My read:** free tier is appropriate for Milestone 2 and probably through Milestone 5. The pausing behaviour is the only thing likely to bite, and knowing about it reduces it to an annoyance.

### 5.2 Email: the most consequential practical change

Removing the local stack also removes the local mail inbox that shipped with it. Every verification and password-reset email now goes to a real mailbox through Supabase's built-in sender, which is **heavily rate-limited by design and explicitly intended for testing, not production**.

Consequences:

- **Milestone 2 impact: small.** Step 7 needs perhaps two or three confirmation emails.
- **Milestone 4 and 5 impact: significant.** Building and testing registration, verification and password reset means sending many emails in short bursts. The built-in sender's limits will be reached, and when they are, the failure looks like "verification is broken" rather than "you are rate-limited" — which is a genuinely expensive way to lose an afternoon.
- **Automated E2E tests would need a readable inbox.** Playwright previously read the local inbox. Against the cloud, email-dependent journeys would need either a mail-testing service with an API or a mailbox with programmatic access. **Neither is introduced in this milestone** — no mail service, no inbox API, no automated email infrastructure of any kind. Milestone 2's two or three confirmation emails are read by hand, and the question of what Milestone 4 needs is answered in Milestone 4.

**Recommendation, and its scope.** Custom SMTP (architecture checklist item 10) is **retained as a Milestone 4 decision**, as you directed. It is not decided now, and nothing in Milestone 2 depends on it. I am recording it here only so that it arrives as a scheduled decision at the start of Milestone 4 rather than as a surprise in the middle of it — the infrastructure change moved this from a pre-launch concern to a Milestone 4 one, and that is worth knowing in advance even though it is not actionable today.

For Milestone 2, plus-addressing on a mailbox you already control, checked manually, is sufficient and is all that will be used.

### 5.3 Shared, persistent, mutable state

The development backend is now a single shared resource rather than a per-developer disposable one.

| Consequence | Why it matters | Mitigation |
| --- | --- | --- |
| **No reset button** | `supabase stop` and start fresh is gone. A bad migration applied to the cloud development project is a real repair job | Migrations reviewed before they are applied; `docs/` records how to roll one back; keep the development project genuinely disposable by never putting anything precious in it |
| **Test data accumulates** | Disposable accounts, half-confirmed users and orphaned rows pile up in a real `auth.users` | Step 7 deletes its accounts. From Milestone 3, a documented cleanup routine |
| **Developers collide** | Two people testing at once share a database, a user list and a rate-limit budget. One person's brute-force test is another person's mysterious lockout | Documented in `docs/onboarding-another-developer.md`. If it becomes a real problem, a project per developer is the answer |
| **No offline development** | The backend is a network dependency. No internet, no dev | Accepted. Worth knowing before a flight |
| **Database tests mutate a real database** | pgTAP ran against a throwaway local Postgres. Now it needs a hosted one, and the architecture's grant-and-RLS suite (E.4, H.3) is a **required CI check** that would run against a shared project on every PR | **Decision 5, deferred to Milestone 3.** The options are: a second Supabase project used only for tests; a dedicated test schema with strict cleanup; or accepting that tests run against the development project with the collision risk. I will present the trade-offs properly when tables exist, rather than guess now |

I want to be plain about the last one: the architecture's security test strategy assumed a disposable database. That assumption no longer holds, and it needs a real answer in Milestone 3. It does not block Milestone 2.

### 5.4 Security considerations

Most of the architecture's security design is unchanged — grants and RLS were always the boundary, and they still are. What changes is the blast radius of a mistake, because the database is now reachable from the internet rather than bound to a container on your machine.

| Consideration | Status under the new architecture |
| --- | --- |
| **Publishable key in the browser** | Expected and correct. It **will** appear in the built bundle; that is by design. But the architecture's conditional guarantee (E.5) now carries real weight: the key is safe **only** when RLS is on for every table, grants are narrow, and no `SECURITY DEFINER` path bypasses them. With a local database, a gap was reachable from your laptop. With a cloud project, it is reachable from anywhere |
| **Secret / service-role key** | Never in frontend code, never in a `VITE_` variable, never in the repository, never in this chat. Only in Edge Function secrets, and not until the deletion milestone |
| **`.env.local`** | Git-ignored before it exists (Step 1). Never committed, never shared by email or chat |
| **Credential sharing between developers** | Through a password manager or each developer reading the dashboard themselves. Never a commit, never a message |
| **Development vs production separation** | A separate development project, as you specified. Nothing is tested against production data. When production exists, its keys are never present on a development machine |
| **An exposed table is exposed to the internet** | Reinforces the architecture's rule (checklist item 14): no table is merged without RLS, grants and tests for both gates in the same migration. This was good practice before; it is now the thing standing between a mistake and a public database |
| **Auth rate limits** | Now a shared, real resource. The brute-force tests in architecture H.3 could trip project-wide limits and affect other developers. Those tests need to be written with that in mind — flagged for Milestone 8 |
| **Network exposure in general** | HTTPS throughout, which Supabase provides. Note that CSP and framing headers (architecture E.6) were to be configured at the hosting layer — with deployment deferred, **those headers are now deferred too** and must not be forgotten when deployment is reconsidered (Section 6, item 4) |
| **Dashboard access** | The Supabase dashboard is now a privileged surface protecting a real database. Worth MFA on the Supabase account itself |

### 5.5 What got simpler

To be fair to the decision, three real improvements:

1. **No Docker.** A heavy dependency, a common source of setup failure, and a barrier for any future collaborator — removed.
2. **Observations match reality.** The token investigation in Step 7 now runs against the same Supabase build the application will actually use, rather than a local container that may differ in version. For a milestone whose central task is recording exact token behaviour, that is a meaningful gain in trustworthiness.
3. **Onboarding is shorter.** Clone, install, two environment variables, run.

---

## 6. Knock-on effects on the approved architecture document

The architecture document was approved describing local Supabase, Docker and Vercel. These sections now contradict the infrastructure decision, and I would rather fix them than leave the approved blueprint disagreeing with the actual project:

| Section | Current text | Needs to become |
| --- | --- | --- |
| Header line and A.2 | Stack list names Vercel as a supporting service | Vercel marked deferred |
| **A.5 Environments** | "local development (Supabase CLI running a local copy)… plus production (hosted Supabase plus Vercel)" | Cloud development project plus a later production project; deployment deferred |
| B.2 | `supabase/config.toml` described as local settings | Repurposed for CLI linkage to the hosted project, or removed until needed |
| E.2 and E.6 | CSP and security headers "in Vercel" | Deferred with deployment, and explicitly tracked so they are not lost |
| E.5 table | Keys live in "`.env.local`, Vercel env vars" | `.env.local` only, for now |
| **H.1** | Integration tests against "local Supabase stack"; E2E using "the local email inbox that ships with the Supabase CLI" | Cloud development project; email strategy per Section 5.2 |
| H.5 | "Vercel preview deployments used for manual checks" | Local verification until deployment is reconsidered |
| Roadmap, Milestone 2 row | Mentions local CLI and Vercel link | Matches this plan |
| **Checklist item 11** | "local Supabase (CLI) plus one production project… requires Docker" | Replaced by the cloud decision; Docker removed |

**Proposed:** I issue revision 4 of the architecture document making exactly these changes and nothing else, so the approved design and the infrastructure stay in step. This is decision 6 in Section 2.1 — say the word and it goes out with, or before, the Milestone 2 work.

---

## 7. Two things I want to flag before you approve

1. **Email will constrain Milestone 4, not launch.** Section 5.2. Removing the local inbox moved the custom-SMTP decision forward in the timeline. Per your direction it stays a Milestone 4 decision and nothing is built for it now; I raise it only so it is on the calendar rather than discovered mid-milestone.

2. **Database testing needs an answer in Milestone 3.** Section 5.3. The architecture makes the grant-and-RLS suite a required CI check, and that strategy assumed a disposable local database. I have deliberately **not** improvised a solution in this plan; I will bring you real options when there are tables to test.

3. **Step 7 may contradict the architecture document, and that is the point.** The sign-out and token-validation behaviour predicted in H.3 Family 4 is a prediction. If the observations disagree with it, I bring you the finding and we correct the document — I will not reshape the evidence to fit the design, and I will not build anything on the finding in this milestone.

---

**Awaiting your approval of this revised plan. I will not begin implementation until you give it. I will not create or modify any Supabase project, create any GitHub repository, create any tables, configure any authentication flow, implement any account-deletion or session-revocation logic, introduce any email-testing infrastructure, or write application code before then — and when implementation starts, the account-level actions in Section 2.2 remain yours, performed from exact instructions I will hand you.**
