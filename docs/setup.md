# Setup — running Auther locally

Clean-machine instructions. **Docker is not required.** There is no local
Supabase stack and no local PostgreSQL; the backend runs in Supabase Cloud and
the frontend runs on your machine.

---

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.19+ or 22.12+ | npm ships with it. Verified working on Node 26.13.0 / npm 11.20.0 |
| Git | any recent | |
| Supabase account | — | With access to the project's **development** project |

Nothing else is installed by hand. The Supabase CLI arrives later as a project
dependency (Milestone 3) and does not require Docker for the operations this
project needs.

---

## Steps

```bash
# 1. Clone and install
git clone https://github.com/rinoykdev/Auther.git
cd Auther
npm install

# 2. Create your local environment file
cp .env.example .env.local

# 3. Edit .env.local — see "Getting the values" below

# 4. Run
npm run dev
```

The app serves at **http://localhost:5173**.

The port is pinned (`strictPort: true` in `vite.config.js`). If 5173 is busy,
Vite **fails loudly rather than falling back to 5174** — deliberate, because
Supabase's redirect allow-list is configured for 5173 and a silent port change
would break email verification and password reset in Milestone 4 in a way that
looks like "auth is broken" rather than "wrong port".

---

## Getting the values

In the [Supabase dashboard](https://supabase.com/dashboard), open the
**development** project → **Project Settings → API**:

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | "Project URL" | Format `https://<project-ref>.supabase.co`. **Not** the `supabase.com/dashboard/...` address in your browser bar — the client rejects that specific mistake with a named error, because it is the most common one |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | "Publishable" / "anon" key | Current projects issue `sb_publishable_...`. Older ones issue a JWT-style key; both work |

**Never put the secret / service-role key in this file**, or in any `VITE_`
variable. Vite bundles every `VITE_`-prefixed variable into the public
JavaScript. The secret key bypasses Row Level Security entirely and belongs only
in Edge Function secrets, in a later milestone.

**Vite only reads env files at startup** — restart the dev server after editing
`.env.local`.

---

## Connectivity states

The home page runs a health check against `/auth/v1/settings` and reports one of
three states. They separate cleanly because they fail at different layers.

**The responses below were observed against a real project on 2026-11-05, not
predicted.** If you see something different, trust what you see and update this
file.

### 1. `Unreachable` — red

No HTTP response arrived at all.

| | |
| --- | --- |
| **Observed** | `fetch threw: TypeError: Failed to fetch` (no status code) |
| **Means** | The request never reached a Supabase server |
| **Causes** | `VITE_SUPABASE_URL` wrong or pointing at a project that does not exist; **free-tier project paused through inactivity**; no internet |
| **Fix** | Check the Project URL. If the project is paused, restore it from the dashboard |

> Free-tier projects pause after roughly a week of inactivity. The first
> symptom is this state appearing after a quiet spell, which reads as
> "everything broke" and is not.

### 2. `Key rejected` — amber

Supabase answered, and refused.

| | |
| --- | --- |
| **Observed** | `HTTP 401`, body `{"message":"Invalid API key","hint":"Double check your API key."}` |
| **Means** | The project was reached; the key was not accepted |
| **Causes** | `VITE_SUPABASE_PUBLISHABLE_KEY` wrong, truncated, or from a different project |
| **Fix** | Re-copy the publishable key from Project Settings → API |

### 3. `Connected` — green

| | |
| --- | --- |
| **Observed** | `HTTP 200 from /auth/v1/settings; getSession ok (no session, as expected)` |
| **Means** | Correctly configured and talking to the right project |

`getSession()` reads browser storage and does not hit the network, so it proves
the client module constructed correctly — not that the server trusts us. That
distinction is architecture C.9 rule 4: `getSession()` is a local read and is
never a security signal.

---

## Environment variable errors

Before the health check runs, `src/lib/supabaseClient.js` validates the
environment and throws a named error if something is wrong.

| Problem | What you see |
| --- | --- |
| Variable missing | `[supabaseClient] Missing required environment variable(s): ...` plus the exact remedy |
| Dashboard URL pasted instead of API URL | `[supabaseClient] VITE_SUPABASE_URL does not look like a Supabase project URL` with expected format |

**These are runtime errors, not build errors.** `npm run build` succeeds with no
`.env.local` at all, because Vite does not execute modules while bundling. The
guard protects a developer starting the app; it will not catch a misconfigured
deployment in CI. Worth remembering when deployment is addressed.

---

## Troubleshooting

### `Invalid hook call` / `Cannot read properties of null (reading 'useRef')`

Vite's dependency-optimizer cache has gone stale — usually after installing
packages — and handed a library its own copy of React. It looks like a code
error and is not.

```bash
rm -rf node_modules/.vite
npm run dev
```

### Styles missing in the production build but fine in dev

A Tailwind v3/v4 configuration mix. This project uses **v4**: configuration is
CSS-first via `@theme` in `src/index.css`, wired through `@tailwindcss/vite`.
There must be **no** `tailwind.config.js`, **no** `postcss.config.js` and **no**
`content` array. Verify by checking the built CSS contains a token-derived
utility:

```bash
npm run build && grep -o '\.bg-brand-500{[^}]*}' dist/assets/*.css
```

### Changes to `.env.local` have no effect

Restart the dev server. Vite reads env files only at startup.

---

## What does not exist yet

As of Milestone 2: no authentication screens, no `AuthProvider`, no database
tables, no RLS policies, no GRANTs, no Edge Functions, no deployment. The app is
a scaffold that proves the toolchain works and that it can reach the backend.

See `architecture.md` for the full design and `milestone-2-plan.md` for the
current milestone.
