# Authentication System: Milestone 1 Architecture and Planning (Revised)

*Stack: React + Vite (running locally), Supabase Cloud (Auth, hosted PostgreSQL, REST API, Storage, Edge Functions), Tailwind CSS v4, Git/GitHub. Deployment deferred. Status: planning only. No code, tables, SQL or dependencies have been created.*

*Revision 4. Supersedes revisions 1 to 3 following your reviews. The structure, explanations and technical detail of earlier revisions are preserved; the changes are listed immediately below.*

**Status: Milestone 1 approved.** This document is the agreed baseline for implementation.

## What changed in this revision

| # | Your instruction | Where it landed |
| --- | --- | --- |
| 1 | Keep the initial build focused on core authentication; defer admin panel, role management, account deletion, MFA and social login, but stay extensible | New Section 0 (scope), revised Sections B, D, F, G, and the roadmap |
| 2 | Account deletion: reauthenticate through Supabase Auth, never send a password to an Edge Function | Section C.8 and Section G.3 rewritten around a reauthentication-then-verify design |
| 3 | `profiles` must not expose `auth.users`; future admin features use authorized server-side operations | Sections D.2, D.7, E.3 and G.3 |
| 4 | Include PostgreSQL grants and privileges alongside RLS | New Section E.4, "The two gates" |
| 5 | The publishable key is safe for frontend use only when permissions and RLS are correct | Section E.5, restated as a conditional guarantee |
| 6 | Use the current recommended Tailwind installation for the chosen version | Section B.4 and checklist item 2 |
| 7 | Document the callback, PKCE, email verification and recovery with exact session transitions | Section C.2 and new Section C.9, "Session state transition reference" |
| 8 | Add explicit tests for cross-user access, privilege escalation, account enumeration and unauthorized API requests | Section H.3, expanded into four named test families |
| 9 | Keep the existing structure and technical detail | Original section lettering, tables and rationale retained throughout |

### Added in revision 3

| # | Your instruction | Where it landed |
| --- | --- | --- |
| 10 | Distinguish `amr` (which method) from `auth_time` (when); enforce the window from verified claims; never treat `amr` alone as proof of recency | New Section C.8.1, plus corrected wording in the glossary, C.4, C.8, C.9, E.2, E.6, G.3 and H.3 |
| 11 | Use a 5-minute reauthentication window as the initial proposal, to be verified against real Supabase token and session behaviour | Section C.8.1, with an explicit Milestone 2 verification task and a recorded fallback if the claim is absent |
| 12 | Use permanent (hard) deletion as the initial approach, absent retention requirements | Section C.8, Section D.2 and checklist item 19, now confirmed |

### Added in revision 4 — infrastructure only

Revision 4 makes **only** the infrastructure changes identified in Section 6 of the Milestone 2 plan: Supabase Cloud replaces the local Supabase/Docker stack, and frontend deployment is deferred. **No security design, flow, policy, claim, test or decision is altered.** If a passage below is not about where things run, it is unchanged from revision 3.

| Section | Change |
| --- | --- |
| Header, A.2 | Stack line now names Supabase Cloud; Vercel marked deferred |
| A.5 Environments | Cloud development project; local Supabase CLI, Docker and Vercel removed |
| B.2 | `supabase/config.toml` note corrected; no local stack |
| B.4 | Tailwind v4 confirmed as decided |
| E.2, E.6 | CSP and security headers deferred with deployment, and explicitly tracked so they are not lost |
| E.5 | Key locations: `.env.local` only, for now |
| H.1 | Integration and database tests against the cloud development project; local email inbox removed; email strategy deferred to Milestone 4 |
| H.5 | Vercel preview deployments replaced by local verification |
| Roadmap | Milestone 2 row matches the approved plan; a deployment milestone added at the end |
| Checklist item 11 | Replaced by the cloud decision; Docker removed as a dependency |

---

## How to read this document

This is the blueprint for the project. Nothing in it is built yet, and nothing in it should be assumed to work until we test it in a later milestone. Where I make a recommendation, I explain why. Where a decision is yours to make, it is collected in the checklist at the end.

**Guiding principle:** use what Supabase already provides (sign-up, login, sessions, email verification, password reset) and write custom code only where Supabase genuinely cannot do the job. Every line of custom security code is a line that can contain a bug.

**Second guiding principle, added in this revision:** build the smallest correct core first. Features that are deferred are not deleted from the design — their extension points are specified so that adding them later is an addition, not a rewrite.

**Terms used throughout (plain-language glossary):**

- **Authentication (AuthN):** proving who you are (logging in).
- **Authorization (AuthZ):** deciding what you are allowed to do once we know who you are.
- **JWT (JSON Web Token):** a signed digital ID card. It contains your user ID and an expiry time. The server can verify the signature, so it does not need to ask the database "who is this?" on every request.
- **Session:** the period during which you stay logged in. In Supabase it is a pair of tokens: a short-lived access token (the JWT) and a long-lived refresh token.
- **RLS (Row Level Security):** a PostgreSQL feature where the database itself enforces rules such as "a user may only read their own row".
- **GRANT / privilege:** the older, coarser PostgreSQL permission system that decides whether a role may touch a table or column *at all*. RLS runs only after a grant has already allowed the operation. Both matter; see Section E.4.
- **Edge Function:** a small piece of server-side code hosted by Supabase. We use it only when something must run with secrets that cannot live in the browser.
- **Reauthentication:** proving you are still the account owner, right now, before a dangerous action — by signing in again through Supabase Auth, not by handing a password to our own code.
- **`amr` (Authentication Methods References):** a JWT claim listing *how* the user authenticated — password, OTP, OAuth provider, MFA factor. It answers "by what means?", not "how long ago?".
- **`auth_time`:** a JWT claim giving the time at which the user actually authenticated, as seconds since the Unix epoch. It answers "when?". It is the claim a recent-authentication window is measured against.
- **Recent-authentication window:** the maximum age of a user's last real authentication that we will accept before allowing a dangerous action. Proposed: 5 minutes for account deletion.

---

## 0. Scope of the initial implementation

This section is new in revision 2 and governs everything that follows.

### 0.1 In scope (the core authentication module)

1. Registration with email and password.
2. Email verification, required before first login.
3. Login and logout.
4. Session management: restore on load, silent refresh, cross-tab synchronisation, expiry handling.
5. Forgot password and password reset.
6. Change password and change email for a logged-in user.
7. A `profiles` table with self-service read and update, protected by grants and RLS.
8. Protected routes and the loading/redirect behaviour around them.

### 0.2 Deferred, with extension points preserved

| Deferred feature | Why it is safe to defer | Extension point kept in this design |
| --- | --- | --- |
| Admin panel | No admin users exist yet in a core-auth build; the panel is a consumer of roles, not a prerequisite | Route namespace `/admin`, folder `features/admin/`, Forbidden (403) page specified in Section F |
| Role management (`user_roles`, role assignment, `RoleGuard`) | Nothing in core auth branches on role | Full table and policy design retained in Section D.7 as a ready-to-apply addition; `AuthProvider` exposes a `roles` value that is an empty array until the feature lands |
| Account deletion | It is the single most dangerous operation in the system and deserves its own milestone with its own test pass | Complete design retained in Sections C.8 and G.3; `accountService.js` is specified but not implemented |
| Multi-factor authentication (MFA) | Supabase supports it natively; adding it later changes configuration and one screen, not the architecture | The JWT already carries `aal`, `amr` and (subject to verification) `auth_time`; Section C.9 and the reauthentication design read those claims, so an MFA step slots in without changing the session model |
| Social login (Google, GitHub) | Adds provider configuration and callback cases before the core flow is proven | The callback page in Section C.2 is written to handle any PKCE code exchange, not only email confirmation; `authService` gets one extra method |
| Audit log table, avatar file storage, organisations/teams | Not needed to authenticate anyone | Noted in Section D.8 |

### 0.3 What "extensible" concretely means here

- No deferred feature requires a change to the `profiles` table, the session model, or the service-layer boundary.
- Every deferred feature is additive: a new table plus policies, a new route, a new service method, or a new Edge Function.
- No deferred feature is quietly half-built. We do not ship an empty admin route or an unused roles table, because an unused table with imperfect policies is an attack surface with no benefit.

---

## A. System Architecture

### A.1 What are we building and why

A reusable authentication module: a self-contained part of a React app that handles identity (who the user is) and sessions (are they still logged in). It is reusable because it depends on a small, well-defined interface rather than on any particular app's pages or data. Authorization beyond "is this the owner of this row" is deferred (Section 0.2) but the module's interface is shaped to accept it.

### A.2 The big picture

There are four actors:

1. **The browser (React app).** Shows screens, collects input, holds the current session in memory and storage. It is **untrusted**: anyone can open developer tools and change anything in it.
2. **Supabase Auth (GoTrue service).** A ready-made service that creates users, hashes and checks passwords, sends verification and reset emails, and issues and refreshes tokens. It is also where **all password verification happens** — including reauthentication before sensitive actions.
3. **PostgreSQL database.** Stores user records (managed by Supabase Auth in a private `auth` schema) and our own tables (in the `public` schema). It enforces grants first, then RLS.
4. **Edge Functions (only when needed).** Trusted server-side code. In the initial implementation there are **none**. The first one arrives with account deletion, in a later milestone.

Supporting services: **Supabase's email sending** (for verification and reset emails) and **GitHub** (code). All Supabase services run in the cloud; the React app runs locally at `http://localhost:5173` during development. **Frontend hosting is deferred** — no deployment target is chosen in the current plan.

### A.3 How they communicate

```
  Browser (React + supabase-js)
     |
     |-- 1. Auth calls (signUp, signIn, signOut, reset, reauthenticate) --> Supabase Auth
     |        <-- returns session (access token JWT + refresh token)
     |        passwords go ONLY here, over HTTPS, and never anywhere else
     |
     |-- 2. Data calls (read/update profile)  --> Supabase REST API (PostgREST)
     |        sends the JWT in the Authorization header
     |        PostgREST connects to PostgreSQL as the `authenticated` role
     |        PostgreSQL checks GRANTs, then applies RLS using the user ID in the JWT
     |
     |-- 3. Privileged calls (deferred; account deletion only) --> Edge Function
              function verifies the JWT server-side, checks authentication recency,
              then uses the secret key to act on THAT CALLER ONLY
```

Key ideas:

- The React app never talks to PostgreSQL directly. It talks to Supabase over HTTPS using the **supabase-js** library, which wraps those APIs.
- The JWT is the thread connecting everything. Auth issues it, the browser carries it, and the database reads it to decide which rows the caller may touch.
- Because the browser is untrusted, **security is enforced in the database (grants plus RLS), not in React**. React can hide a button; only the database can actually stop a request.
- **A password never travels to code we wrote.** It goes from the browser to Supabase Auth and nowhere else. This is a hard rule from revision 2 onward and it is what Section C.8 is built around.

### A.4 Frontend vs backend responsibilities

| Concern | Frontend (React) | Backend (Supabase) |
| --- | --- | --- |
| Forms and validation | Immediate feedback (format, length, match) for good UX | Final validation (password policy, unique email) |
| Passwords | Sends over HTTPS to Supabase Auth only; never stores, logs, or forwards them | Hashes and verifies them |
| Sessions | Stores them via supabase-js, reacts to changes | Issues, signs, refreshes and revokes tokens |
| Route protection | Redirects and hides UI (convenience only) | Grants and RLS block unauthorized data (real protection) |
| Reauthentication | Collects the password and calls Supabase Auth; reads the resulting session | Verifies the password and stamps a fresh authentication time into the new JWT |
| Emails | Tells the user to check their inbox | Generates links, sends emails |
| Roles *(deferred)* | Will show or hide UI | Will store roles and enforce them in RLS |
| Account deletion *(deferred)* | Confirmation UI, triggers Supabase reauthentication | Edge Function verifies the token and performs the deletion |

### A.5 Environments

**Backend runs in Supabase Cloud. The frontend runs locally.** There is no local Supabase stack and **Docker is not a dependency of this project**.

- **Development:** a dedicated **Supabase Cloud development project**, with the React app served from `http://localhost:5173` against it. This project is treated as disposable — nothing precious goes in it — but it is a real hosted database, so it is not resettable the way a container was. Section A.5.1 records what that costs us.
- **Production:** a separate Supabase Cloud project, created when deployment is actually on the table. **Nothing is ever tested against production data.**
- **Frontend deployment:** deferred. To be decided separately once the application works locally.

Database changes are tracked as versioned **migration files** in Git so the schema is reproducible. Grants are part of those migrations, not manual dashboard clicks (Section E.4).

#### A.5.1 Consequences of a cloud development backend

These follow from the infrastructure decision and are recorded here so later milestones are not surprised by them:

- **No reset button.** A bad migration against the cloud development project is a repair job, not a `stop` and `start`.
- **Shared, mutable state.** The database, the auth user list and the rate limits are common to everyone working on the project. One person's testing is visible to the others.
- **No offline development.** The backend is a network dependency.
- **Email has no local inbox.** Verification and reset emails go to real mailboxes through Supabase's built-in sender, which is rate-limited and intended for testing. This constrains Milestone 4 rather than launch (checklist item 10).
- **Database tests need a hosted target.** The pgTAP strategy in H.1 assumed a disposable local database. How it runs against a cloud project is an open decision for Milestone 3.
- **An exposed table is exposed to the internet.** The security design is unchanged, but the blast radius of a mistake is larger. This is why the rule in checklist item 14 — no table without RLS, grants and tests in the same migration — is not negotiable.

### A.6 Dependencies for this milestone

None. This milestone is planning only.

---

## B. Project Structure

### B.1 Principle: organize by feature, not by file type

Instead of one giant `components/` folder, everything about authentication lives in one `features/auth/` folder. To reuse the module in another app, you copy that folder, plus a few shared files, and configure environment variables.

### B.2 Proposed layout

Folders marked *(deferred)* are shown so the shape of the final system is clear. They are **not created** in the initial implementation.

```
project-root/
  .env.example              # lists required variables, with NO real values
  .gitignore                # ignores .env.local, node_modules, build output
  package.json
  vite.config.js            # includes the Tailwind v4 plugin (see B.4)
  README.md
  docs/                     # architecture, decisions, setup notes
  supabase/
    config.toml             # CLI linkage to the hosted project (no local stack)
    migrations/             # versioned SQL: tables, GRANTs, RLS, triggers
    functions/
      delete-account/       # (deferred) Edge Function
    tests/                  # pgTAP database/RLS/grant tests
  src/
    main.jsx                # app entry point
    App.jsx
    index.css               # @import "tailwindcss"; + @theme tokens
    lib/
      supabaseClient.js     # the ONE place the Supabase client is created
    features/
      auth/                 # the reusable module
        index.js            # public API: what other code may import
        context/
          AuthProvider.jsx  # holds session, user, status; listens for changes
        hooks/
          useAuth.js        # access auth state anywhere
          useRole.js        # (deferred) stub-free; added with roles
        services/
          authService.js    # wraps every supabase.auth call
          profileService.js # wraps profile reads/updates
          accountService.js # (deferred) account deletion call
        components/
          ProtectedRoute.jsx
          PublicOnlyRoute.jsx
          RoleGuard.jsx     # (deferred)
          AuthForm pieces (fields, buttons, alerts)
        pages/
          SignUpPage.jsx
          LoginPage.jsx
          CheckEmailPage.jsx
          AuthCallbackPage.jsx
          ForgotPasswordPage.jsx
          ResetPasswordPage.jsx
          ProfilePage.jsx
          SecuritySettingsPage.jsx
        utils/
          validators.js     # email and password rules
          errorMessages.js  # maps Supabase errors to friendly text
      admin/                # (deferred) role management
    components/
      ui/                   # generic Button, Input, Spinner, Alert
      layout/               # page shell, navbar
    routes/
      AppRoutes.jsx         # central route table
    pages/
      HomePage.jsx
      NotFoundPage.jsx
      ForbiddenPage.jsx     # built now; used by RoleGuard later
    test/                   # shared test setup
  e2e/                      # end-to-end browser tests
```

### B.3 Why this structure

- **`services/` is a thin wrapper around Supabase.** Pages never call `supabase.auth` directly. If we later change providers or upgrade the library, only the services change. It is also the single choke point where we can assert "no password is passed to anything except `supabase.auth`".
- **`lib/supabaseClient.js` is a single source.** One client, one configuration, one place to audit — including the `flowType: 'pkce'` setting that Section C.9 depends on.
- **`index.js` defines a public API** for the module, so host apps import from `features/auth` and not from its internals. This is what makes the deferred features additive: adding roles adds an export, it does not change existing ones.
- **`ui/` holds generic components** that know nothing about authentication, so they can be reused everywhere.
- **`supabase/` lives in the repo** so database structure, privileges, security rules and functions are version-controlled together with the code.

### B.4 Build tool and Tailwind installation

I recommend **Vite** to create the React project. It is the current standard for single-page React apps, is fast, and serves the app at `http://localhost:5173` in development. Hosting is deferred, so no build target is assumed.

**Tailwind CSS: use the installation method that matches the version we choose, not a remembered one.** Revision 1 assumed a `tailwind.config.js` and a PostCSS step, which is the Tailwind v3 shape. That is no longer the recommended setup for the current major version.

- **Decided: Tailwind CSS v4 with the official Vite plugin.** The current setup is: install `tailwindcss` and `@tailwindcss/vite`, register the plugin in `vite.config.js`, and put a single `@import "tailwindcss";` at the top of `src/index.css`. There is **no `tailwind.config.js`, no `postcss.config.js` and no `content` array** by default — template scanning is automatic, and design tokens (colours, fonts, spacing) are declared in CSS with the `@theme` directive. A JavaScript config can still be loaded explicitly if we ever need one.
- **If we choose Tailwind v3 instead** (for example to match an existing project), the v3 instructions apply in full: `tailwindcss`, `postcss` and `autoprefixer` as dev dependencies, a generated `tailwind.config.js` with a `content` array, a `postcss.config.js`, and the three `@tailwind` directives in the stylesheet.
- **Action for Milestone 2:** before installing, we read the official Tailwind installation page for the version selected and follow it exactly. We do not carry forward the structure assumed in this document if the official guidance has moved on. The version choice is checklist item 2.

This matters beyond tidiness: a v3-shaped config in a v4 install produces styles that silently do not apply, which is exactly the kind of "it looks fine locally" failure we want to avoid before we start building forms.

---

## C. Authentication Flows

For each flow: what the user sees, what React does, what Supabase does, and what can go wrong. Section C.9 then gives the precise session-state transitions for the flows that involve a redirect.

### C.1 Registration

1. User opens **Sign Up** and enters email, password and (optionally) display name.
2. React validates format and password rules for instant feedback.
3. React calls `signUp` (via `authService`), passing the email, password, display name and the `emailRedirectTo` URL where the confirmation link should land.
4. Supabase Auth creates the user in `auth.users` with the status **unconfirmed**, hashes the password, and sends a confirmation email.
5. A database trigger (planned, not yet created) automatically creates a matching row in our `profiles` table.
6. React shows the **Check Your Email** screen, with a "Resend email" button and a cooldown timer.

*Edge cases:* email already registered (we must not reveal whether an account exists — see Sections E.6 and H.3); weak password; network failure; user closes the tab before confirming; email goes to spam.

*Note on enumeration:* with "Confirm email" enabled, Supabase's `signUp` response for an already-registered address is deliberately shaped to look like a new registration (an obfuscated user object, no session). Our UI must not add information back by behaving differently. This is tested explicitly in H.3.

### C.2 Email verification and the auth callback

The exact token mechanics depend on which link style we configure, and we should decide this deliberately rather than inherit a default. Both options are documented; recommendation follows.

**Option A — PKCE code link (recommended default).**

1. User clicks the link in the email, which points at Supabase's `/auth/v1/verify` endpoint.
2. Supabase validates the one-time token, marks the user confirmed, and redirects the browser to our **Auth Callback** route with `?code=<authorization_code>` in the query string.
3. The callback page exchanges that code for a session. With `detectSessionInUrl: true` (the default) supabase-js does this automatically on load; we can also call `exchangeCodeForSession` explicitly for clearer error handling. The exchange requires the **code verifier** that supabase-js stored in this browser when the sign-up call was made.
4. supabase-js persists the session, strips the code from the URL, and emits the auth events listed in C.9.
5. The app shows "Email confirmed" and redirects to the intended destination.

**Known limitation of Option A:** the code verifier lives in the browser that initiated sign-up. If the user opens the email on their phone after registering on a laptop, the exchange fails with a verifier error. This is not a bug to debug later; it is inherent to PKCE and must be designed for. Mitigations: a clear, non-alarming error on the callback page with a one-click "resend verification email" action, and the option below.

**Option B — token hash link (`verifyOtp`), for cross-device verification.** With a customised email template that emits `{{ .TokenHash }}`, the link points at our own callback route carrying `token_hash` and `type`. The page calls `verifyOtp({ token_hash, type: 'signup' })`, which establishes a session with **no verifier requirement**, so it works in any browser. The cost is that we own the email template.

**Recommendation:** start with Option A for sign-up confirmation, because it is the default and the fewest moving parts, and treat the cross-device case as a handled error with resend. Revisit Option B if real users hit it often. This is checklist item 7.

Because we turn on **"Confirm email"** in Supabase settings, users cannot log in until this step is done.

*Edge cases:* link expired; link already used (tokens are single-use); link opened in a different browser (see above); redirect URL not on Supabase's allow-list — a classic setup mistake that produces a redirect to the site URL instead of the callback, and one we will verify in Milestone 2 rather than discover later. A further case specific to email: some corporate mail scanners and link-preview bots **follow links automatically**, consuming the one-time token before the human clicks. The callback must therefore treat "token already used" as a recoverable state with a resend option, not a dead end.

### C.3 Login

1. User enters email and password.
2. React calls `signInWithPassword`.
3. Supabase verifies the credentials and returns a session: an access token (JWT, expires in about an hour by default) and a refresh token.
4. supabase-js stores the session and our `AuthProvider` updates its state.
5. The user is redirected to the page they originally wanted (or the dashboard).

*Edge cases:* wrong credentials (one generic message, never "email not found"); unverified email (offer to resend); too many attempts (rate limited); expired session mid-use.

### C.4 Session management

- On app load, `AuthProvider` asks supabase-js for the stored session and shows a loading state until it has an answer. This prevents the "flash of the login page" for logged-in users. The states are `loading` → `authenticated` | `anonymous`, and no route decision is made while `loading`.
- It subscribes to `onAuthStateChange`, so the UI automatically reacts to login, logout, token refresh and password recovery events, including in other browser tabs.
- supabase-js silently refreshes the access token before it expires using the refresh token. Refresh tokens are single-use and rotated.
- If a refresh fails (revoked, expired, reuse detected), the user is signed out and sent to Login.
- **Important:** a token refresh produces a new JWT but does **not** re-prove the user's identity. `iat` and `exp` move forward; the *authentication* time does not, because no authentication occurred. The claim that records when the user actually authenticated (`auth_time`, subject to the verification in C.8.1) is what a sensitive action must read. This distinction is the foundation of the reauthentication design in C.8.

### C.5 Forgot password and reset password

1. User opens **Forgot Password** and enters their email.
2. React calls `resetPasswordForEmail` with the `redirectTo` URL of our Reset Password page.
3. The UI always shows the same message: "If an account exists for this email, we've sent a link." This prevents attackers from discovering which emails are registered.
4. User clicks the emailed link; Supabase validates it and redirects to our Reset Password route, carrying a `code` (PKCE) that supabase-js exchanges for a **recovery session**.
5. The app detects the `PASSWORD_RECOVERY` event, shows the "new password" form, and calls `updateUser` with the new password.
6. Success message, then redirect to Login (or straight into the app).

**Critical detail, made explicit in this revision:** the recovery session is a **real, full session**. After the exchange, the holder of that link is signed in. The Reset Password page therefore must not be reachable as "just another protected page" — it must require that a `PASSWORD_RECOVERY` event was observed in this page load, and it must not be possible to navigate away into the app and operate as the user without completing the reset. Exact transitions are in C.9.

*Edge cases:* expired or reused link; user visits the Reset page directly without a link (must be blocked); new password same as old; weak password; link consumed by a mail scanner (same mitigation as C.2).

### C.6 Logout

1. User clicks **Log out**.
2. React calls `signOut`.
3. The session is cleared locally and the refresh token is revoked on the server. Other tabs react via `onAuthStateChange`.
4. User lands on the public Login or Home page. Any cached user data in React state is cleared.

*Note:* Supabase also supports signing out of all devices (global scope). Whether to expose it is checklist item 12.

### C.7 Profile and credential changes (in scope)

- **Profile update:** logged-in user edits display name and similar fields. Saved to `profiles`, protected by column grants and RLS.
- **Change password:** requires an active session; calls `updateUser`. If Supabase's "secure password change" option is enabled, the user must have authenticated recently, and `reauthenticate()` supplies a nonce by email when they have not. We will enable this option; it is the same recency principle as C.8, provided natively.
- **Change email:** calls `updateUser`; by default Supabase sends a confirmation to both the old and the new address, and the change takes effect only when both are confirmed. We keep that default — the email to the old address is what protects a user whose session is stolen.

### C.8 Account deletion (deferred; design corrected in this revision)

Revision 1 proposed that the user re-enter their password and that React send it to an Edge Function. **That design is withdrawn.** It would mean a password travelling to code we wrote, being parsed by our function, and being available to our logs and error traces — for no benefit, because Supabase Auth can verify the password itself and tell us, cryptographically, that it did.

**Corrected design, in three steps.**

**Step 1 — Reauthenticate through Supabase Auth, in the browser.**
The Delete Account screen asks for the typed confirmation phrase and the current password. React calls **`supabase.auth.signInWithPassword`** with the signed-in user's own email and the typed password. This is an ordinary Supabase Auth call: the password goes to Supabase and nowhere else.

- If the password is wrong, the call fails and we show an error. Nothing else happens.
- If it is correct, Supabase returns a **fresh session** issued by a genuine authentication event, so the authentication time carried by the new access token is *now*. The claim that records this, and what we do if it is absent, is specified in C.8.1.
- If MFA is ever enabled, this same step naturally gains the second factor and the new token's `aal` rises to `aal2`. The design does not change.

*(Where Supabase's `reauthenticate()` nonce flow fits: that call sends a one-time code by email and is the right tool when we want proof of mailbox control rather than proof of password. It is the mechanism behind "secure password change" in C.7. For deletion, password reauthentication is the better match because the mailbox may be the very thing an attacker controls. We can require both later without changing the architecture.)*

**Step 2 — Call the Edge Function with the fresh token, and nothing else.**
React invokes the `delete-account` function. The request body is **empty** — no password, no email, no user ID. The only thing that travels is the `Authorization: Bearer <access_token>` header that supabase-js attaches.

**Step 3 — The Edge Function verifies, then deletes only the caller.**
Running server-side with the secret key, the function:

1. Reads the bearer token from the header. A missing or malformed header is a `401`.
2. **Verifies the token with Supabase Auth** — by calling `auth.getUser(jwt)`, which validates the signature and that the session still exists server-side, rather than merely decoding the token. A decode-only check would accept a token from a session that was already signed out.
3. Takes the user ID **from the verified token's `sub` claim**. It never reads a user ID from the body, the query string, or any header the client controls. There is no code path in which a user ID supplied by the caller reaches the delete call — this is the property that makes "delete someone else's account" structurally impossible rather than merely blocked.
4. **Checks authentication recency:** reads the **authentication time** from the verified token (`auth_time`, or the fallback established in C.8.1) and rejects the request with `401` and a `reauthentication_required` code if it is older than the configured window — proposed: **5 minutes**. This is what forces Step 1 to have actually happened, and it is why a long-lived stolen token, or a token merely refreshed in the background, cannot delete an account. **`amr` is not used for this check** (C.8.1).
5. **Optionally checks `amr` and `aal` for method and strength**, not for recency: `amr` tells us the caller authenticated by password rather than, say, resuming a social session, and `aal` tells us whether MFA was satisfied. Once MFA exists we require `aal2` for enrolled users.
6. Calls `auth.admin.deleteUser(userIdFromToken)`. Cascading foreign keys remove the profile and any future role rows.
7. Returns a success response. React then calls `signOut` and sends the user to a public page.

**Why each guard exists**

| Guard | Attack it stops |
| --- | --- |
| Password verified by Supabase Auth, never by us | Password exposure in our function's memory, logs, error reporting or request traces |
| Token verified server-side via `getUser`, not decoded | A forged or already-revoked token being accepted |
| User ID read only from the verified `sub` | One user deleting another by sending a different ID |
| Recency window measured on the **authentication time** claim, verified server-side | A stolen or borrowed session deleting the account hours later; a background refresh silently counting as "recent" |
| `amr` checked for **method**, never for recency | Accepting a token that merely *lists* a password method from an authentication that happened days ago |
| Empty request body | Any injection path through parameters we never read |
| Origin allow-list and CORS restricted to our app | A hostile site calling the function from a victim's browser |
| Rate limit per user | Automated abuse of the endpoint |

**Hard rule going forward:** no Edge Function in this project accepts a password, and no Edge Function accepts an identifier for the subject of a privileged action. If a future feature seems to need one, that is the signal to re-read this section.

**Deletion semantics: permanent (hard) delete.** Confirmed as the initial approach, on the basis that there are no retention requirements. `auth.admin.deleteUser` removes the row from `auth.users`, and the `ON DELETE CASCADE` foreign keys remove the profile and any future role rows in the same transaction. There is no `deleted_at` column, no tombstone row and no recovery path: once the function returns success, the account is gone. Two consequences we accept deliberately — a user who deletes by mistake must register again from scratch, and the confirmation UI therefore has to be unambiguous (typed phrase plus reauthentication, Section F screen 13). If a retention or legal requirement ever appears, soft delete is an additive change: a nullable `deleted_at` on `profiles`, a policy excluding deleted rows, and a scheduled purge — the Edge Function's verification logic in C.8 is unaffected either way.

### C.8.1 The recent-authentication window: `amr` vs `auth_time`

Revision 2 used `amr` as the recency signal. **That was wrong, and this section corrects it.** The two claims answer different questions and conflating them produces a check that looks strict and is not.

| Claim | Question it answers | Shape | Correct use here |
| --- | --- | --- | --- |
| `amr` | **How** did this user authenticate? | A list of authentication methods — password, OTP, an OAuth provider, an MFA factor | Deciding whether the *method* is acceptable for this action (for example: require a password, not a resumed social session) |
| `auth_time` | **When** did this user authenticate? | A single numeric timestamp, seconds since the Unix epoch | Measuring the recent-authentication window |
| `aal` | How **strong** was the authentication? | `aal1` / `aal2` | Requiring MFA for enrolled users |
| `iat` | When was this **token** issued? | Numeric timestamp | **Never** used for recency — a background refresh moves it without the user proving anything |

**Why `amr` alone must never be treated as proof of recency.** `amr` is a list of methods. A token that lists `password` is telling us the session originated from a password sign-in — it is not telling us that happened recently. A session authenticated by password a week ago and silently refreshed every hour since still carries `password` in `amr`. A check that reads `amr` and concludes "the user authenticated with a password, so they have reauthenticated" accepts exactly the stolen-session case the check exists to stop.

A further trap: some implementations, Supabase's included, attach a per-method `timestamp` to entries inside the `amr` structure. That timestamp is *tempting* and is not the same guarantee as a dedicated `auth_time` claim — its presence, shape and update semantics are implementation details that can change between versions, and reasoning about "the newest timestamp in the list" is fragile. We therefore specify the check against `auth_time`, and treat anything else as a documented fallback rather than the design.

**The rule we implement.** The Edge Function:

1. verifies the token server-side (C.8 Step 3.2) — **every claim below is read only from the verified token**, never from a client-supplied copy and never from an unverified decode;
2. reads the authentication time from `auth_time`;
3. computes `now - auth_time` and rejects with `401 reauthentication_required` if it exceeds the window;
4. separately reads `amr` to confirm the authentication *method* is one we accept for deletion, and `aal` to confirm strength;
5. rejects if `auth_time` is absent, malformed, or in the future (clock skew beyond a small tolerance is treated as a failure, not rounded away).

**The window: 5 minutes, as an initial design proposal.** Long enough that a user who reauthenticates, reads the warning text and types the confirmation phrase does not get bounced; short enough that a token lifted from storage is almost always stale. It is a constant in one place, not scattered through the function.

**What must be verified in Milestone 2, before any of this is built.** This design asserts things about Supabase's tokens that we have not yet observed, and I am not willing to have them assumed:

- **Does the access token actually contain `auth_time`?** Supabase's JWT claim set is documented, but claim availability varies by version and configuration. We will mint a real token locally, decode it, and record the full claim set in `docs/`.
- **What happens to that claim across a refresh?** We will capture a token, wait for or force a refresh, and compare. The required property is that the authentication-time claim does **not** advance on refresh. If it does advance, it is useless for this purpose and we fall back immediately.
- **What happens to it on reauthentication?** A second `signInWithPassword` must move it to now.
- **Exact shape of `amr`** — array of strings, or array of objects with `method` and `timestamp` — recorded so the method check is written against reality.

**Fallback if `auth_time` is not present or does not behave as required**, in order of preference:

1. **Server-side session inspection.** The function, already holding the secret key, reads the session referenced by the token's `session_id` through the Admin API and uses the authoritative server-side authentication timestamp. This is strictly better than any client-carried claim — it cannot be stale or forged — at the cost of one extra server call per deletion, which is irrelevant for an operation performed once per account.
2. **A custom access token hook** that injects a trustworthy `auth_time` claim at token-issue time, server-side.
3. **The timestamp inside `amr`**, used only if neither of the above is available, documented as a known-fragile dependency with a test that fails loudly if its shape changes.

Whichever path the evidence selects, the architectural rule is unchanged and binding: **the window is measured against a verified timestamp of the authentication event itself, and `amr` is never, on its own, accepted as proof that authentication was recent.**

### C.9 Session state transition reference

This section is new in revision 2. It is the precise answer to "what is the session at each moment", because every redirect-based flow is a place where it is easy to be wrong about whether the user is signed in.

**Client configuration assumed throughout:** `flowType: 'pkce'`, `detectSessionInUrl: true`, `persistSession: true`, `autoRefreshToken: true`, all set in `lib/supabaseClient.js`.

**The events supabase-js emits.** `INITIAL_SESSION` (once, on client start, carrying the restored session or `null`), `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`, `PASSWORD_RECOVERY`.

**Transition table.**

| Flow | Before | What moves the state | Event(s) emitted | After |
| --- | --- | --- | --- | --- |
| App cold start, no stored session | none | client reads storage | `INITIAL_SESSION` (session `null`) | anonymous |
| App cold start, valid stored session | none | client reads storage, refreshes if near expiry | `INITIAL_SESSION` (session present), then possibly `TOKEN_REFRESHED` | authenticated |
| Sign-up submitted (confirmation required) | anonymous | `signUp`; code verifier written to this browser's storage | *(none — no session is created)* | still anonymous; user is unconfirmed |
| Email confirmation link clicked | anonymous in that browser | Supabase verifies token, marks user confirmed, redirects to `/auth/callback?code=…` | *(none yet)* | still anonymous; a code is in the URL |
| Callback page loads | anonymous, code in URL | `detectSessionInUrl` (or explicit `exchangeCodeForSession`) swaps code + stored verifier for tokens; URL is cleaned | `INITIAL_SESSION`, then `SIGNED_IN` | **authenticated** |
| Callback loads in a *different* browser | anonymous, code in URL | exchange fails — no verifier present | `INITIAL_SESSION` (`null`) only | anonymous; show recoverable error + resend |
| Callback loads with a used or expired code | anonymous | exchange rejected by Supabase | `INITIAL_SESSION` (`null`) only | anonymous; show recoverable error + resend |
| Login | anonymous | `signInWithPassword` | `SIGNED_IN` | authenticated; **authentication time = now**; `amr` records the method |
| Background token refresh | authenticated | refresh token rotated | `TOKEN_REFRESHED` | authenticated; `iat`/`exp` advance; **authentication time unchanged**; `amr` unchanged |
| Reauthentication before a sensitive action | authenticated | `signInWithPassword` again | `SIGNED_IN` | authenticated; **authentication time = now** — this is the transition the window in C.8.1 measures |
| Forgot-password link clicked | usually anonymous | Supabase validates token, redirects to `/reset-password?code=…` | *(none yet)* | anonymous; code in URL |
| Reset page loads | anonymous, code in URL | code exchanged for a **full session** | `INITIAL_SESSION`, then `PASSWORD_RECOVERY` | **authenticated** — and this is the dangerous moment; see rule below |
| New password submitted | authenticated (recovery) | `updateUser({ password })` | `USER_UPDATED` | authenticated, ordinary session |
| Reset page opened directly, no code | anonymous | nothing | `INITIAL_SESSION` (`null`) | anonymous; render "invalid or expired link", never the password form |
| Logout | authenticated | `signOut` | `SIGNED_OUT` (also in other tabs) | anonymous |
| Refresh fails / token revoked | authenticated | refresh rejected | `SIGNED_OUT` | anonymous; redirect to Login |
| Another tab logs in or out | either | storage event | `SIGNED_IN` / `SIGNED_OUT` | mirrors the other tab |

**Four rules that fall out of this table and must be implemented deliberately:**

1. **Route decisions wait for `INITIAL_SESSION`.** `AuthProvider` starts in `loading` and no guard redirects until the first event arrives. Otherwise a logged-in user is bounced to Login on every refresh.
2. **The Reset Password page is gated on the `PASSWORD_RECOVERY` event, not on having a session.** Because the recovery exchange creates a real session, "is the user signed in?" is the wrong question. The page records that the event fired during this page load and renders the password form only then. If the user navigates away without completing the reset, the app treats that session as ordinary — which is acceptable, because it was obtained by proving mailbox control — but the reset form itself is never reachable without the event.
3. **`TOKEN_REFRESHED` is not proof of identity.** Any code deciding "has this user authenticated recently?" reads the **authentication-time** claim from the verified token — never `iat`, never the token's freshness, and never `amr`, which records the method and not the moment. This is the server-side check in C.8 Step 3.4, specified in full in C.8.1.
4. **`getSession()` reads local storage; `getUser()` asks the server.** The client may use `getSession()` for rendering. Anything that matters is verified server-side. No security decision anywhere in this system is made from a client-side session read.

---

## D. Database Architecture (design only)

*No tables are created in this milestone.*

### D.1 What Supabase already gives us

Supabase Auth maintains its own `auth.users` table (email, hashed password, confirmation status, last sign-in, metadata). We **do not modify it**, we do not store passwords anywhere ourselves, and we do not read it from the client. It lives in a protected schema that the generated REST API does not expose, and we will not do anything to change that (see D.6).

### D.2 Our tables in the initial implementation

**`profiles`**: one row per user; holds application-facing user data.

| Field | Purpose |
| --- | --- |
| `id` (UUID, primary key) | Same value as `auth.users.id`; foreign key with ON DELETE CASCADE |
| `display_name` | Name shown in the UI |
| `avatar_url` | Optional; image storage is deferred |
| `created_at`, `updated_at` | Timestamps (updated automatically by a trigger) |

We keep the profile separate from `auth.users` because we should not change Supabase's internal table, and because the profile is the safe place to attach app-specific fields that the client may read and edit.

**What `profiles` must never contain — stated explicitly in this revision:**

- **No copy of the email address, and no other column mirrored from `auth.users`**, unless we have decided deliberately that the value is public to whoever can read that row. A convenience copy of `email` turns any "users can read all profiles" policy into a directory of every registered address, which is an account-enumeration hole (H.3) created by a schema decision rather than a policy bug.
- **No role, permission or entitlement column.** See D.7.
- **No view, security-definer function, or foreign table that selects from `auth.users` and is readable by `anon` or `authenticated`.** A view owned by a superuser bypasses the protection of the `auth` schema, and Postgres will happily hand its contents to the client. If we ever need auth fields on the client, the answer is Section D.6, not a view.

**No soft-delete column.** Deletion is permanent (Section C.8), so `profiles` carries no `deleted_at` and no policy has to remember to exclude tombstoned rows — a class of leak avoided by not having the column. If retention requirements ever appear, adding `deleted_at` plus an exclusion predicate is an additive migration.

**Initial policy for `profiles` reads:** own row only. If the application later needs users to see each other's display names, we add a policy for exactly the columns that are genuinely public — which is possible precisely because the table holds no auth-derived data.

### D.3 Relationships

```
auth.users (managed by Supabase)
   |-- 1 to 1  --> public.profiles   (profiles.id = auth.users.id)
   |-- 1 to many --> public.user_roles (deferred; user_roles.user_id)
```

Deleting a user in `auth.users` automatically deletes their profile (cascade), which is how account deletion stays clean when that milestone arrives.

### D.4 Database automation planned

- **Trigger on new user:** when a row appears in `auth.users`, create the matching `profiles` row. This runs server-side as a `SECURITY DEFINER` function so it cannot be skipped by a malicious client. Two details we will get right in the migration: a fixed `search_path` on the function (an unqualified `search_path` in a definer function is a known privilege-escalation vector), and the function being owned by a role that has exactly the privileges it needs and no more.
- **Trigger for `updated_at`.**
- **Helper function for roles** (`has_role`): deferred with the roles feature; designed in D.7.

### D.5 Why the client never reads `auth.users`

PostgREST exposes only the schemas we expose, and `auth` is not one of them. That protection is only as good as our discipline about not tunnelling around it. The three tunnels we will not dig: a view over `auth.users`, a `SECURITY DEFINER` function that returns auth rows to `authenticated`, and a trigger that copies auth columns into a client-readable table. All three appear in blog posts as convenient tricks. All three are how a user list leaks.

### D.6 How future admin features will read authentication data

This is the answer to "but the admin panel needs to see email addresses and last sign-in".

When that milestone arrives, admin reads of authentication data will go through an **authorized server-side operation**: an Edge Function (or a Postgres function invoked with proper authorization, if it proves to be a better fit) that

1. verifies the caller's JWT server-side, exactly as in C.8 Step 3.2;
2. checks that the caller holds the `admin` role, by querying the roles table with privileged credentials rather than trusting any claim the client could influence;
3. only then uses the secret key to call the Admin API (`auth.admin.listUsers`) or to read `auth` tables;
4. returns **only the fields the admin screen actually needs**, never a raw dump of auth rows;
5. is rate-limited and logs who asked for what.

The key property: the capability to read authentication data exists **only** inside code that has already proved the caller is an admin. There is no table, view or policy that could be made to leak it by a mistake in an RLS predicate, because the data is never reachable from the client's database role at all.

### D.7 Role design (deferred; design retained in full)

Not built in the initial implementation. Recorded here so the later addition is mechanical.

**`user_roles`**: which roles each user has.

| Field | Purpose |
| --- | --- |
| `user_id` (UUID) | Foreign key to `auth.users.id`, ON DELETE CASCADE |
| `role` (enum such as `user`, `admin`) | The role granted |
| `granted_by`, `granted_at` | Who assigned it and when (accountability) |
| Primary key | (`user_id`, `role`) so a role is not granted twice |

**Why a separate roles table and not a `role` column on `profiles`?** Users are allowed to update their own profile. If the role lived there, we would depend on getting column-level rules perfect to stop a user from promoting themselves to admin. A separate table that users can read but never write is simpler and safer — and with column grants (E.4) the client's database role will not even hold `UPDATE` on a roles table, so an RLS mistake alone cannot cause escalation.

**Roles must also never be stored in user-editable metadata** (such as `user_metadata`), which the client can modify through `updateUser`. If we ever want a role claim inside the JWT for performance, the mechanism is a custom access token hook that reads the roles table server-side — never `user_metadata`.

**Planned privileges and policies when added:** `authenticated` gets `SELECT` only, and only on its own rows; no `INSERT`, `UPDATE` or `DELETE` grant exists for the client role at all. Writes happen through the authorized server-side path in D.6.

**First admin** is created manually once, through a documented step, because letting the app create its first admin would itself be a security hole.

**Roadmap position:** roles arrive with the admin milestone, after the core authentication flows have a passing test suite.

### D.8 Deliberately deferred (to keep it simple)

Audit log table, avatar file storage, multi-factor authentication, social login, organisations or teams. The design leaves room for all of them: each is a new table plus grants plus policies, or a configuration change, not a restructuring.

---

## E. Security Architecture

### E.1 Authentication

- Passwords are handled by Supabase Auth: hashed with a strong algorithm, never stored or readable in plain text, never touched by our own database tables, and — as of this revision — **never sent to any code we wrote**, including Edge Functions.
- We enable **email confirmation** so every account is tied to an address the owner controls.
- We set a **minimum password policy** (length matters more than complexity) in Supabase settings, mirrored by frontend validation for UX. We will also enable Supabase's **leaked-password check**, which rejects passwords found in known breach corpora; it is a configuration toggle and it prevents more real compromises than any complexity rule.
- Login errors are deliberately vague.
- Supabase applies **rate limits** on auth endpoints. We will review and tighten them, and consider CAPTCHA (Supabase supports it) if abuse appears.

### E.2 JWTs and sessions

- The **access token** (JWT) is short-lived. Even if stolen, it expires soon.
- The **refresh token** is single-use and rotated; reuse detection helps spot theft.
- Inside the JWT: user ID (`sub`), the database role claim (`authenticated`), `iat`, `exp`, email, `session_id`, `aal` (assurance level), `amr` (**which methods** were used) and, subject to the verification in C.8.1, `auth_time` (**when** authentication happened). The database trusts the token because it is cryptographically signed.
- **These three are not interchangeable.** `auth_time` answers "how long ago?" and is the only claim a recent-authentication window may be measured against. `amr` answers "by what means?" and is used to require a password rather than a resumed session. `iat` answers "when was this token minted?" and is never a recency signal, because a background refresh moves it without the user proving anything. Treating `amr` as a recency signal — as revision 2 did — accepts a week-old session that was merely refreshed.
- Important rule: in React, `getSession()` reads what is stored in the browser, which can be tampered with. For security decisions, anything sensitive is verified server-side, and when we need certainty in the client we use `getUser()`, which asks the server.
- **Token storage:** supabase-js stores sessions in browser storage by default. This is standard for single-page apps, but it means **Cross-Site Scripting (XSS)** is the main threat. Mitigations: never inject raw HTML (React escapes output by default), avoid risky libraries, keep dependencies patched, and add security headers (a Content Security Policy) at the hosting layer when the frontend is deployed — **deferred with deployment, and tracked as an open item so it is not forgotten** (E.6). A cookie-based server-rendered approach is an alternative we are **not** choosing, to avoid complexity — a decision we revisit if the app's risk profile changes.

### E.3 Authorization: RLS

- **RLS ON for every table in the `public` schema**, with no exceptions. A table with RLS off is readable and writable by anyone holding the publishable key *if the client role has been granted access to it* — which is why E.4 matters too.
- **Default deny:** with RLS on and no policy, nobody gets access. We add the minimum policies needed.
- Policies in the initial implementation:
  - `profiles`: a user may `SELECT` and `UPDATE` **only their own row** (`(select auth.uid()) = id`). No client `INSERT` (the trigger does it) and no client `DELETE` (cascade handles it).
- Policies when roles are added (D.7):
  - `user_roles`: a user may `SELECT` **only their own roles**. Nobody may `INSERT`, `UPDATE` or `DELETE` from the client.
  - `profiles`: an additional admin read path, if and only if we conclude the admin screen cannot be served by the server-side path in D.6.
- Policy-writing conventions we will follow: wrap `auth.uid()` as `(select auth.uid())` so the planner treats it as a constant rather than re-evaluating per row; write **separate policies per command** (`FOR SELECT`, `FOR UPDATE`) rather than one `FOR ALL`, so each is readable and testable in isolation; always pair an `UPDATE` policy's `USING` clause with a `WITH CHECK` clause, because without `WITH CHECK` a user could update their row into a state that no longer satisfies the policy.
- Frontend checks (`ProtectedRoute`, and later `RoleGuard`) are for user experience only. They are never the security boundary.

### E.4 Authorization: PostgreSQL grants and privileges — the two gates

New in this revision. RLS is the gate everyone talks about; grants are the gate underneath it, and a request must pass **both**.

**How a client request actually reaches a row.** A browser request carries the JWT to PostgREST. PostgREST connects to Postgres and switches to the database role named in the token's `role` claim — `anon` for a logged-out caller, `authenticated` for a logged-in one. Postgres then asks, in this order:

1. **Does this role have `USAGE` on the schema?** No → error, nothing else is evaluated.
2. **Does this role have the table privilege (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) — and, for `SELECT`/`UPDATE`, on the specific columns?** No → error.
3. **Does RLS permit these particular rows?** No → zero rows (or a violation on write).

Step 3 is the one we design policies for. Steps 1 and 2 are the ones that get forgotten — and they are strictly stronger, because a privilege that was never granted cannot be defeated by a policy that was written wrong.

**What this buys us concretely.** If `authenticated` holds no `UPDATE` privilege on a roles table, then no RLS mistake, no policy typo, and no clever `PATCH` request can escalate a privilege, because the attempt dies at gate 2. Defence in depth here is not theoretical; it is the difference between one mistake being survivable and one mistake being a breach.

**The privilege plan, written into migrations alongside the policies:**

| Object | `anon` | `authenticated` | Notes |
| --- | --- | --- | --- |
| schema `public` | `USAGE` | `USAGE` | Required for anything to be reachable |
| `public.profiles` | none | `SELECT`; `UPDATE` **on `display_name`, `avatar_url` only** | No `INSERT` (trigger), no `DELETE` (cascade). Column-level `UPDATE` means `id`, `created_at` and any future sensitive column cannot be written even by a correct-looking request |
| `public.user_roles` *(deferred)* | none | `SELECT` only | No write privilege exists for the client role at all |
| schema `auth`, all its tables | none | none | Unchanged from Supabase's defaults; we add nothing |
| Future tables | none by default | granted explicitly, per table | See the default-privileges rule below |

**Rules we will follow:**

- **Revoke first, grant narrowly.** New tables start with privileges revoked from `anon` and `authenticated`, and receive only the specific grants they need.
- **Fix `ALTER DEFAULT PRIVILEGES`.** Supabase's default setup grants broad privileges on newly created objects in `public` to `anon` and `authenticated`. We will review this and, where it is wider than we want, alter the defaults so that a future migration which forgets its grants fails closed rather than opening a table to everyone. This is a Milestone 2 task with a pgTAP test attached.
- **Grants live in migrations, in Git**, reviewed like any other code. Never configured by hand in the dashboard, where they are invisible to review and absent from a rebuilt environment.
- **`SECURITY DEFINER` functions are exceptional**, and each one gets: a fixed `search_path`, the narrowest possible owner, `EXECUTE` revoked from `public` and granted only to the roles that need it, and its own test.
- **Every table carries both.** The checklist for adding a table is: enable RLS, write per-command policies, set grants, write pgTAP tests for both gates. A table is not "done" with only one.

**A test exists for each gate separately** (H.3), so we learn which gate is holding — a test that passes only because of RLS would silently start failing open if the grant plan changed.

### E.5 Secure credential handling

| Key | Where it lives | Safe in browser? |
| --- | --- | --- |
| Project URL | `.env.local` (git-ignored). Host environment variables when deployment happens | Yes (public) |
| Publishable key (formerly "anon" key) | `.env.local` (git-ignored). Host environment variables when deployment happens | **Conditionally — see below** |
| Secret key (formerly "service role" key) | **Only** Supabase Edge Function secrets or server environment | **Never.** It bypasses RLS entirely |

**The conditional guarantee, stated precisely.** The publishable key is designed to be shipped in frontend code and *is* safe there — **but only because, and only for as long as, the database refuses to serve data to the role that key maps to.** The key itself grants nothing; it identifies the project and selects the `anon` (or, with a user's JWT, `authenticated`) database role. Its safety is a *consequence* of our configuration, not a property of the key.

It is safe **only when all of the following hold:**

1. **RLS is enabled on every table in every client-exposed schema** — including tables added later, including tables someone created in the dashboard, including join and lookup tables.
2. **Each such table has policies that permit only what we intend**, written per command, with `WITH CHECK` on writes.
3. **Grants are correct** (E.4): `anon` and `authenticated` hold only the table and column privileges they need.
4. **No `SECURITY DEFINER` function, view, or exposed schema provides a path around 1–3** — in particular, nothing that selects from `auth.users`.
5. **No secret key is present in any client bundle or environment variable visible to the build.**

If any one of these is false, the publishable key is not "safe but with a small problem" — it is a public credential that reads or writes whatever the gap allows. This is why E.4's two-gate plan and H.3's test families exist, and why checklist item 14 asks you to approve the rule that **no table ships without its RLS, grants and tests in the same migration**.

**Key naming note for Milestone 2:** Supabase is migrating from the `anon` / `service_role` JWT-style keys to `sb_publishable_…` and `sb_secret_…` API keys. We will use whichever scheme the project is created with, use the publishable/secret terminology in code and docs regardless, and — importantly — never let a rename blur which key is which. The variable holding the secret key will be named so that its presence in a frontend file is obvious at a glance.

**Other handling rules:**

- In Vite, variables prefixed with `VITE_` are bundled into the public JavaScript. We therefore only ever prefix the URL and the publishable key, never the secret key.
- `.env.local` is in `.gitignore`. We commit only `.env.example` with placeholder values.
- If a secret is ever committed, we **rotate it immediately**; deleting it from Git history is not enough.
- We will not paste real secrets into AI assistant prompts or chat, including this one.

### E.6 Other protections

- **Redirect URL allow-list** in Supabase so auth emails cannot send users to attacker sites. Wildcards are kept as tight as possible; a broad pattern is an open redirect waiting to happen.
- **HTTPS only.** Supabase Cloud serves all backend traffic over HTTPS. The frontend runs on `http://localhost:5173` in development, which is expected; HTTPS for the frontend arrives with hosting.
- **Security headers — deferred with deployment, and explicitly tracked.** Content Security Policy, `X-Frame-Options`/`frame-ancestors` to prevent clickjacking of auth screens, and `Referrer-Policy` so tokens in URLs are never leaked in referrers. These were to be configured at the hosting layer; since hosting is deferred, so are they. **This is the single easiest item in this document to lose**, because it belongs to a milestone that does not exist yet. It is listed as checklist item 22 for that reason.
- **Custom SMTP for production emails:** Supabase's built-in sender is heavily rate-limited and intended for testing, so production needs a proper provider. Flagged for your decision.
- **Account enumeration protection:** identical responses and identical timing-insensitive messaging on password reset, and sign-up responses that do not distinguish a new address from an existing one. Tested in H.3.
- **Edge Function safety (when one exists):** verify the JWT server-side, act only on the caller's own account, never read a subject identifier from the request, restrict allowed origins, rate-limit per user.
- **Sensitive actions require recent authentication**, proved through Supabase Auth and checked server-side against a verified authentication-time claim within a defined window — 5 minutes for deletion, proposed and to be verified (C.8.1).
- **Dependency hygiene:** commit the lockfile, run `npm audit` before each release, and keep supabase-js current.

### E.7 Threats we will explicitly test

Cross-user data access, privilege escalation, account enumeration, unauthorized API requests, expired and tampered tokens, replayed reset links, browser-storage tampering, secret-key exposure in the build, open redirects, and brute-force attempts. Each has named tests in H.3.

---

## F. Frontend Screens

Every screen must handle these common states: **idle**, **submitting** (button disabled, spinner), **success**, **error** (friendly message, field-level where possible), and **loading** where data is fetched. Forms must be keyboard-accessible with labelled fields and error text announced to screen readers.

Screens marked *(deferred)* are specified but not built in the initial implementation.

| # | Screen | Route | Access | Key components | States and interactions |
| --- | --- | --- | --- | --- | --- |
| 1 | Sign Up | `/signup` | Public only | Email, password (show/hide, strength hint), confirm password, display name, submit, link to Login | Validation errors, email already used (generic wording — see H.3), submitting, success leads to Check Email |
| 2 | Check Your Email | `/check-email` | Public | Message, "Resend email" button, cooldown timer, "Change email" link | Resend sent, resend rate-limited, resend failed |
| 3 | Auth Callback | `/auth/callback` | Public | Spinner, result message | Exchanging code, success → redirect; link expired/used → resend offer; **opened in a different browser → specific, non-alarming message plus resend** (C.2) |
| 4 | Login | `/login` | Public only | Email, password, show/hide, "Forgot password?" link, submit, link to Sign Up | Wrong credentials (generic), unverified email (with resend), rate-limited, success redirects to the originally requested page |
| 5 | Forgot Password | `/forgot-password` | Public | Email field, submit, back to Login | Always the same "if an account exists" message |
| 6 | Reset Password | `/reset-password` | **`PASSWORD_RECOVERY` event observed in this page load** (C.9 rule 2) | New password, confirm, submit | Invalid or expired link, weak password, success then redirect to Login |
| 7 | Profile | `/profile` | Logged in | Display name field, email (read-only), save button, avatar placeholder | Loading profile, unsaved changes, save success, save error |
| 8 | Security Settings | `/settings/security` | Logged in | Change password form, change email form, sign out of all devices (optional) | Reauthentication prompt, confirmation email notice, errors |
| 9 | Dashboard / Home (placeholder) | `/` or `/dashboard` | Logged in | Navbar with user menu and logout, welcome text | Demonstrates protected content |
| 10 | Forbidden (403) | `/forbidden` | Logged in | Explanation, link home | Built now; first used by `RoleGuard` when roles land |
| 11 | Not Found (404) | `*` | Any | Message, link home | None |
| 12 | App loading screen | n/a | Internal | Full-screen spinner | Shown while the session is being restored, to avoid flashing the wrong page (C.9 rule 1) |
| 13 | Delete Account *(deferred)* | Section of Security Settings or `/settings/delete` | Logged in | Warning text, typed confirmation phrase, password field **that submits to Supabase Auth reauthentication, not to our server** | Confirmation incomplete (button disabled), reauthenticating, wrong password, deleting, success → sign out and redirect, failure |
| 14 | Admin Panel *(deferred)* | `/admin` | Role: admin | User list, role assignment controls | Loading, empty, forbidden, role-change success or error. Data arrives from the authorized server-side operation in D.6, never from a client query over `auth.users` |

**Shared components:** Button, TextInput, PasswordInput, Alert (error, success, info), Spinner, FormField (label, input, error text), Navbar with UserMenu, PageLayout, ProtectedRoute, PublicOnlyRoute, ConfirmDialog. `RoleGuard` is deferred.

**Route guard behaviour:**

- **ProtectedRoute:** while auth state is `loading`, show the spinner — never redirect; if there is no session, redirect to Login and remember the intended page; otherwise render the page.
- **PublicOnlyRoute** (Login, Sign Up): logged-in users are redirected to the dashboard; again, only after `loading` resolves.
- **Reset Password** is *not* a ProtectedRoute. It has its own gate, described in C.9 rule 2.
- **RoleGuard** *(deferred)*: if the user lacks the required role, render the Forbidden page.

---

## G. API Architecture

Three layers, and the rule of thumb is to **use the highest, simplest layer that can safely do the job**.

### G.1 Layer 1: Supabase Auth APIs (via supabase-js)

Built in. No server code from us. **Every password in the system passes through this layer and no other.**

| Operation | Method (conceptual) | In initial scope? |
| --- | --- | --- |
| Register | `auth.signUp` | Yes |
| Resend verification | `auth.resend` | Yes |
| Verify email / exchange code | `auth.exchangeCodeForSession` on the callback page, or `auth.verifyOtp` for token-hash links | Yes |
| Login | `auth.signInWithPassword` | Yes |
| **Reauthenticate before a sensitive action** | `auth.signInWithPassword` (password proof) or `auth.reauthenticate` (email nonce) | Yes — used by password change; reused by deletion later |
| Logout | `auth.signOut` | Yes |
| Read session | `auth.getSession` (UI only) and `auth.getUser` (verified) | Yes |
| Listen for changes | `auth.onAuthStateChange` | Yes |
| Forgot password | `auth.resetPasswordForEmail` | Yes |
| Set new password / change password | `auth.updateUser` | Yes |
| Change email | `auth.updateUser` (confirmation to both addresses) | Yes |
| Social sign-in | `auth.signInWithOAuth` | Deferred |
| MFA enrol/challenge/verify | `auth.mfa.*` | Deferred |

### G.2 Layer 2: Generated REST API (PostgREST), protected by grants and RLS

Supabase automatically exposes the tables in our `public` schema to the `anon` and `authenticated` database roles — **to the extent that those roles have been granted privileges**. We use it with plain supabase-js queries.

| Operation | Table | Protected by |
| --- | --- | --- |
| Read own profile | `profiles` | Grant: `SELECT` to `authenticated`. RLS: own row only |
| Update own profile | `profiles` | Grant: `UPDATE` on `display_name`, `avatar_url` only. RLS: own row, with `WITH CHECK` |
| Create profile | — | No client path; a `SECURITY DEFINER` trigger does it |
| Delete profile | — | No client path; cascade from `auth.users` |
| Read own roles *(deferred)* | `user_roles` | Grant: `SELECT` only. RLS: own rows only |
| Admin: list users with auth details *(deferred)* | — | **Not this layer.** See G.3 and D.6 |

No custom backend is needed here, but this layer is only as safe as the grants and policies behind it, which is why both get dedicated tests.

### G.3 Layer 3: Edge Functions (custom server code), minimal

Used only where a privileged key is required or where an action cannot be expressed safely as a grant-and-RLS-protected query. **There are none in the initial implementation.**

| Operation | Why it needs a function | Milestone |
| --- | --- | --- |
| **Delete account** | Deleting from `auth.users` requires the secret key, which can never be in the browser. The function verifies the caller's JWT, enforces the recent-authentication window from the verified `auth_time` claim (C.8.1), and deletes **only the `sub` in that verified token**. It accepts no password and no user ID (C.8) | Deferred |
| **Admin: read authentication data** | `auth.users` is not reachable from the client and must not be made reachable. The function verifies the JWT, confirms the admin role using privileged credentials, calls the Admin API, and returns only the needed fields (D.6) | Deferred |
| **Admin: assign or revoke roles** | The client role holds no write privilege on `user_roles` by design, so writes must happen server-side, where an audit entry can be written in the same transaction | Deferred |
| Custom email logic, webhooks | Not needed | Deferred |

**Invariants for every Edge Function in this project:**

1. It verifies the bearer token with Supabase Auth; it never merely decodes it.
2. It derives the acting user from the verified `sub` claim only.
3. For privileged actions on the caller's own account, it enforces a recent-authentication window measured against the verified authentication-time claim (`auth_time`), and uses `amr` only to check the authentication *method* (C.8.1).
4. For privileged actions on *other* records, it checks the caller's authorization server-side, with privileged credentials, before touching anything.
5. It never accepts a password, a secret, or a subject identifier from the request.
6. It restricts allowed origins and rate-limits per user.
7. It returns the minimum data necessary, with errors that do not leak whether a record exists.

Note on languages: Edge Functions run on Deno and are usually written in TypeScript. We will keep them very small and well commented. This is the one place where "JavaScript initially" may need a small exception, flagged in the checklist.

### G.4 Decision rule

1. Can Supabase Auth do it? Use Auth APIs. **Anything involving a password stops here.**
2. Is it reading or writing our own data as the logged-in user? Use REST plus grants plus RLS.
3. Does it need the secret key, or authorization that the client role must not be able to perform? Use an Edge Function, under the invariants in G.3.

---

## H. Testing Strategy

Principle: **nothing is considered working until a test or a documented manual check proves it.** Each milestone ends with a test report, and we do not move on if critical tests fail.

### H.1 Test layers

| Layer | Tool (proposed) | What it covers |
| --- | --- | --- |
| Unit tests | Vitest | Validators, error-message mapping, helper functions |
| Component tests | Vitest and React Testing Library | Forms show errors, buttons disable while submitting, guards redirect correctly, the Reset page refuses to render without `PASSWORD_RECOVERY` (Supabase mocked) |
| Database, grant and RLS tests | pgTAP, run against a hosted project | Both gates in E.4: that privileges are what we think, and that policies block and allow what we expect, with real database roles. **How these run without a local database is an open decision for Milestone 3** (A.5.1) |
| Integration tests | Supabase Cloud development project | Real sign-up, login and profile calls against the hosted development project |
| API-level security tests | Scripted HTTP requests (no browser) | Section H.3's unauthorized-request family: raw calls to PostgREST and Edge Functions with forged, missing, expired and borrowed tokens |
| End-to-end tests | Playwright | Full journeys in a real browser against the locally served app. **Journeys requiring an email have no automated inbox** — the local one is gone with the local stack. How email-dependent journeys are tested is decided in Milestone 4, alongside custom SMTP (checklist item 10); until then they are manual |
| Manual and exploratory | Checklist | Mobile layouts, spam-folder behaviour, multi-tab behaviour, cross-device email links |

A note on why the API-level layer is listed separately: browser tests exercise the app as the app behaves. The attacks in H.3 are made by callers who are not using our app at all. Those tests must be written at the HTTP level, with hand-made requests, or they are not testing the thing they claim to test.

### H.2 Functional tests (happy paths)

Register then verify then login; forgot then reset then login with the new password; edit profile and see it persist after reload; change password and confirm the old one fails; change email and confirm both addresses receive mail; logout clears access; session restores across a page refresh without flashing the login screen; a second tab reflects logout.

*(Deferred features carry their own happy-path tests into their milestones: deletion removes user and profile and blocks login afterwards; an admin sees the panel and a normal user does not.)*

### H.3 Security tests

Four named families, each with concrete cases and an explicit pass condition. These are not a checklist of ideas; each line is a test that must exist and run in CI.

**Family 1 — Cross-user access (can A touch B's data?)**

| Case | Method | Pass condition |
| --- | --- | --- |
| A reads B's profile by ID | `select` on `profiles` filtered to B's id, with A's token | Zero rows. Not an error — zero rows, so we also assert A's own row *is* returned, proving the query shape was valid |
| A updates B's profile | `update` on `profiles` where id = B, with A's token | Zero rows affected; B's row unchanged when re-read with the secret key |
| A lists all profiles | `select` with no filter, with A's token | Exactly one row: A's own |
| Anonymous reads any profile | Same queries with the publishable key and no user token | Zero rows on all tables |
| Anonymous writes any table | `insert`/`update`/`delete` attempts | Rejected |
| A reads B's profile through a nested/embedded query | PostgREST resource embedding from any related table | Zero rows — embedding does not bypass RLS, and we prove it rather than assume it |
| A reads auth data | Attempt to query `auth.users`, and any view or RPC that might expose it | Rejected / not found. Repeated as a schema test: no view or function in `public` references `auth.users` |
| *(with roles)* A reads B's roles | `select` on `user_roles` for B | Zero rows |

**Family 2 — Privilege escalation (can a user gain power they were not given?)**

| Case | Method | Pass condition |
| --- | --- | --- |
| Self-promotion via profile write | `update profiles set` a role-ish column | Fails — and the stronger assertion: **no such column exists** (D.2) |
| Self-promotion via `user_metadata` | `auth.updateUser({ data: { role: 'admin' } })`, then use the resulting token against every protected resource | The call may succeed (it is the user's own metadata) but **grants nothing**: every authorization check still refuses. Asserted explicitly, because this is the single most common Supabase mistake |
| Forged role claim in the JWT | Hand-craft a token with `role: 'service_role'` and an invalid signature | Rejected at signature verification |
| Direct write to the roles table *(with roles)* | `insert`/`update`/`delete` on `user_roles` with a user token | Rejected **at the grant gate** — asserted by checking `has_table_privilege` for `authenticated` returns false, independently of any policy |
| Grant-gate regression | pgTAP assertion of the full privilege matrix in E.4 for `anon` and `authenticated` | Matches exactly; any new grant that appears without being added to the test fails the build |
| RLS-enabled regression | Query `pg_tables` for any table in `public` with `rowsecurity = false` | Empty result. This one test catches every future table that forgets RLS |
| `SECURITY DEFINER` audit | Enumerate definer functions; assert each has a fixed `search_path` and no `EXECUTE` grant to `public` | Passes for every function |
| Admin endpoint called by a normal user *(with roles)* | Call the admin Edge Function with a valid non-admin token | `403`, and no data in the body |
| Column-grant enforcement | `update profiles set id = <other uuid>` or `set created_at = …` | Rejected at the column-privilege gate |

**Family 3 — Account enumeration (can an outsider learn which emails are registered?)**

| Case | Method | Pass condition |
| --- | --- | --- |
| Password reset, existing vs unknown email | Two `resetPasswordForEmail` calls | Identical HTTP status, identical body, identical UI message |
| Sign-up, existing vs new email | Two `signUp` calls | Response shape does not distinguish them; our UI renders the same Check-Email screen either way |
| Login, unknown email vs wrong password | Two `signInWithPassword` calls | Identical error code and identical user-facing message |
| Resend verification, existing vs unknown | Two `auth.resend` calls | Identical response and message |
| Timing | Repeated measurement across each pair above | No systematic, reliably exploitable difference. We record the numbers in the test report rather than asserting a threshold we cannot defend; a large, consistent gap is a finding to fix |
| Profile table as a directory | Attempt to read any email address from `profiles` with any token | No email column exists to read (D.2) |
| Error-message review | Manual pass over `errorMessages.js` | No mapped message distinguishes "no such account" from "wrong credentials" |

**Family 4 — Unauthorized API requests (what happens to callers who are not our app?)**

| Case | Method | Pass condition |
| --- | --- | --- |
| No token at all | Raw HTTP to PostgREST with only the publishable key | Anonymous treatment: zero rows everywhere, no writes |
| Malformed token | `Authorization: Bearer garbage` | `401`, no data |
| Tampered payload, valid structure | Decode a real token, change `sub` to another user, re-encode without a valid signature | `401` — signature verification fails before any row is considered |
| Expired token | Token past `exp` | `401`; a refresh is required |
| Token from a signed-out session | Sign out, then replay the previously valid access token against PostgREST **and** against an Edge Function | PostgREST may accept it until `exp` (it validates the signature, not server state) — we assert this is true and that it is survivable because the window is short, while the Edge Function **rejects it**, because it calls `getUser` and sees the session is gone. Documenting this difference is the point of the test |
| Replayed verification link | Use the same confirmation link twice | Second use fails; callback shows the recoverable error and offers resend |
| Replayed reset link | Use the same recovery link twice | Second use fails; page shows "invalid or expired", never the password form |
| Reset page without a link | Navigate directly to `/reset-password` while signed in as an ordinary user | Password form is **not** rendered (C.9 rule 2) |
| Redirect outside the allow-list | `emailRedirectTo` pointing at an external domain | Supabase refuses; the user is sent to the site URL instead |
| *(deferred)* Delete-account without a token | Call the function with no `Authorization` header | `401`, nothing deleted |
| *(deferred)* Delete-account with another user's ID in the body | Valid token for A, body containing B's ID | A is deleted (the body is ignored entirely) or the call is rejected — **B is untouched**. We assert B still exists |
| *(deferred)* Delete-account without recent reauthentication | Valid token whose verified `auth_time` is older than the window | `401` with `reauthentication_required`; nothing deleted |
| *(deferred)* **Refresh does not reset the window** | Authenticate, wait past the window, force a token refresh, then call delete with the fresh token | `401 reauthentication_required`. This is the test that would have caught the revision-2 error, and it is the single most important case in this family |
| *(deferred)* **`amr` alone is not accepted as recency** | Token whose `amr` lists `password` but whose `auth_time` is outside the window | `401`. Asserts the method check and the recency check are independent |
| *(deferred)* Reauthentication reopens the window | Authenticate, wait past the window, reauthenticate, call delete | Succeeds |
| *(deferred)* Missing or malformed `auth_time` | Token constructed without the claim | `401` — fails closed, never defaults to "recent" |
| *(deferred)* Future-dated `auth_time` | Claim set beyond tolerance ahead of server time | `401` |
| *(deferred)* Delete-account from a foreign origin | Request with a disallowed `Origin` header | Rejected by CORS and by the function |
| Cross-origin calls generally | Any browser-based call from an origin not on the allow-list | Blocked |

**Supporting checks (retained from revision 1):**

- **Secrets:** scan the production build output and Git history to confirm no secret key and no `.env` file is exposed. Runs in CI, not just once.
- **XSS basics:** user-controlled fields (display name) render as text, never as HTML; a display name containing a script tag is stored and displayed harmlessly.
- **Dependencies:** `npm audit` before each release.
- **Headers:** the deployed site sends the expected CSP and framing headers.

### H.4 Edge cases

Email already registered; weak or mismatched passwords; very long inputs and unusual characters (including emoji and right-to-left text) in display names; double-clicking submit; expired or reused links; verification link opened on a different device or in a different browser (C.2); mail scanners consuming one-time links; session expiring while a form is open; logging out in one tab while another is open; two tabs refreshing a token simultaneously; offline or failing network; slow connection; rate limit reached; email bounces; clock skew between client and server. *(Deferred: deleting an account while logged in elsewhere; first-admin bootstrap.)*

### H.5 Process

- Tests run locally with every change and automatically through GitHub Actions on every pull request.
- The pgTAP grant-and-RLS suite and the API-level security suite are **required checks** — a pull request that fails them cannot merge, because these are the tests that fail silently in production if we skip them.
- Manual checks are performed against the locally served app pointed at the cloud development project. Preview-deployment checks return if and when hosting is introduced.
- Each milestone ends with: what was tested, what passed, what failed, and what remains untested.

---

## Proposed Milestone Roadmap (revised)

Reordered so that the core authentication module is complete and tested before any deferred feature begins.

| Milestone | Scope |
| --- | --- |
| 1 | Architecture and planning (this document) |
| 2 | Project setup: Vite and React, Tailwind v4, feature-based structure, Supabase client with explicit PKCE configuration, Supabase Cloud development project, environment variables, Git/GitHub and CI, test harness, token-claim investigation, setup and security documentation. **No Docker, no local Supabase, no deployment** |
| 3 | Database foundation: `profiles`, the new-user trigger, **grants and RLS together in one migration**, and the pgTAP suite for both gates |
| 4 | Registration, email verification, login, logout, session handling, and the exact callback/PKCE behaviour in C.9 |
| 5 | Forgot and reset password, including the `PASSWORD_RECOVERY` gate |
| 6 | Protected routes, route guards, and the loading-state rules |
| 7 | Profile management, change password, change email |
| 8 | **Core hardening and full security test pass** (all four families in H.3), then deployment checklist. *The reusable core authentication module is complete and proven here.* |
| 9 | Packaging the module for reuse in other apps |
| — | *Deferred features begin only after Milestone 8 passes:* |
| 10 | Roles and role-based authorization |
| 11 | Admin panel, including the authorized server-side read path in D.6 |
| 12 | Account deletion (reauthentication plus Edge Function, per C.8) |
| 13 | Optional: MFA, social login, audit log, avatar storage |
| 14 | **Frontend deployment** — hosting choice, production Supabase project, environment variables, and the security headers deferred from E.6 |

Database work moved ahead of the auth flows (now Milestone 3) because grants and RLS are the thing everything else depends on, and because a policy bug found in Milestone 3 is cheap while the same bug found in Milestone 8 has had five milestones of code written on top of it.

---

## Decisions Requiring Your Approval Before Milestone 2

Items already settled by your review are marked **[confirmed]** and need no further action; they are listed so the record is complete.

- [ ] **1. Build tool:** Vite for the React project (recommended).
- [x] **2. Tailwind version:** **v4** with the `@tailwindcss/vite` plugin and CSS-first configuration. No `tailwind.config.js`, no PostCSS config, no `content` array. We follow the official v4 installation page at install time (Section B.4). **[confirmed by your review]**
- [ ] **3. Project structure:** feature-based layout with `features/auth` as the reusable module (recommended).
- [ ] **4. Language:** JavaScript for the app. Edge Functions, when they arrive, may be TypeScript because of the Deno runtime (recommended: accept this one exception).
- [ ] **5. Router:** React Router for page navigation (recommended).
- [ ] **6. Session flow:** PKCE with browser storage and an XSS-focused mitigation plan, instead of a server-rendered cookie setup (recommended for simplicity).
- [ ] **7. Email link style:** PKCE code links by default, with cross-device failure handled as a clear error plus resend; token-hash links (`verifyOtp`) with a custom template as the fallback if users hit it often (Section C.2). Confirm, or ask for token-hash from the start.
- [ ] **8. Password policy:** minimum 8 characters initially (10 or more preferred), no forced complexity rules, **plus Supabase's leaked-password check enabled** (recommended).
- [ ] **9. Profile fields:** `display_name` and `avatar_url` only. Confirm, or tell me what else you need — noting that anything mirrored from `auth.users`, especially email, needs a deliberate decision (Section D.2).
- [ ] **10. Production email:** Supabase's default sender during development, a custom SMTP provider before launch (recommended). Which provider, if any, do you have in mind?
- [x] **11. Environments:** **Supabase Cloud** for all backend services, with a dedicated **development project** and the React frontend running locally at `localhost:5173`. A separate production project is created when deployment is addressed. **Docker is not a project dependency**, and there is no local Supabase stack (A.5). **[confirmed by your review]**
- [x] **22. Frontend deployment:** **deferred.** No hosting is configured and no production frontend is deployed in the current plan. **The security headers in E.6 are deferred with it and must be configured when deployment happens** — tracked as Milestone 14. **[confirmed by your review]**
- [ ] **12. Sign out of all devices:** include in Security Settings now, or defer?
- [ ] **13. Testing toolset:** Vitest, React Testing Library, pgTAP and Playwright, plus a scripted HTTP layer for the H.3 security families (recommended).
- [ ] **14. Security process rule:** no table is merged without RLS, grants and pgTAP tests for both gates in the same migration; the pgTAP and API-level security suites are required CI checks (recommended, and the condition on which Section E.5's safety guarantee rests).
- [ ] **15. Revised milestone roadmap:** approve the reordering above (database before flows, deferred features after Milestone 8), or tell me what to change.
- [x] **16. Scope:** admin panel, role management, account deletion, MFA and social login deferred; architecture kept extensible. **[confirmed by your review]**
- [x] **17. Account deletion design:** reauthentication through Supabase Auth; no password ever reaches an Edge Function; the function verifies the token and deletes only the caller. **[confirmed by your review]**
- [x] **18. Admin data access:** `profiles` never exposes `auth.users`; future admin reads go through an authorized server-side operation. **[confirmed by your review]**
- [x] **19. Account deletion semantics:** **permanent hard delete**, with cascade removal of profile and role rows and no recovery path, on the basis that no retention requirements apply. Soft delete remains an additive change if that ever changes (Section C.8). **[confirmed by your review]**
- [x] **21. Recent-authentication window:** measured against the verified `auth_time` claim, **5 minutes** for account deletion, as an initial proposal subject to verification against real Supabase token and session behaviour in Milestone 2; `amr` used for method only (Section C.8.1). **[confirmed by your review]**
- [ ] **20. Roles (still open, needed before Milestone 10):** two roles, `user` and `admin`, in a separate `user_roles` table. Will you need more, such as `moderator`?

---

**Status:** Milestone 1 **approved** and closed. No code has been written, no files created in the project, no dependencies installed, and nothing changed in Supabase. Milestone 2 is presented separately as an implementation plan and will not begin until that plan is approved.
