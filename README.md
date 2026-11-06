# Auther

A reusable authentication module for React applications, built on Supabase.

Identity, sessions and self-service account management, packaged so it can be
dropped into another app by copying one folder and setting two environment
variables.

**Status: Milestone 2 (project setup) complete.** No authentication flows,
database tables, RLS policies or Edge Functions exist yet. See `docs/` for the
approved architecture and milestone plan.

---

## Architecture at a glance

| Layer | Choice |
| --- | --- |
| Frontend | React + Vite, running **locally** at `http://localhost:5173` |
| Styling | Tailwind CSS v4 |
| Backend | **Supabase Cloud** — Auth, hosted PostgreSQL, REST API, Storage, Edge Functions |
| Version control | Git + GitHub |
| Deployment | **Deferred.** No hosting is configured |

**Docker is not required.** There is no local Supabase stack and no local
PostgreSQL. All backend services run in Supabase Cloud, and the frontend talks
to them over the network during development.

---

## Requirements

- **Node.js 20.19+ or 22.12+** (npm ships with it)
- **Git**
- A **Supabase Cloud account**, with access to this project's development project

That is the complete list. Nothing else needs installing by hand.

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env.local

# 3. Fill in .env.local with the project URL and publishable key
#    from the Supabase dashboard (Project Settings -> API).
#    Never commit this file. Never put the secret key in it.

# 4. Run the app
npm run dev
```

The app serves at **http://localhost:5173**.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server on port 5173 |
| `npm run build` | Produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint the source |
| `npm test` | Run unit/component tests in watch mode |
| `npm run test:ci` | Run them once (used by CI) |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run scan:dist` | Scan the built bundle for secrets |

---

## Credentials — the short version

- `.env.local` is git-ignored and holds **only** the project URL and the
  **publishable** key. Both are safe on your machine and in the browser.
- The Supabase **secret / service-role key** must never appear in this
  repository, in any `VITE_` variable, or in frontend code. It bypasses Row
  Level Security.
- The publishable key is safe in the browser **only because** database
  permissions and RLS policies are correct. It is not a security boundary on
  its own.
- If a key is ever exposed, **rotate it immediately**. Removing it from Git
  history is not sufficient.

Full detail: `docs/security.md` (written in Step 9) and architecture section E.5.

---

## Documentation

| Document | Contents |
| --- | --- |
| `docs/architecture.md` | Approved Milestone 1 architecture: flows, database design, security model, testing strategy |
| `docs/milestone-2-plan.md` | Approved Milestone 2 plan |
| `docs/setup.md` | Clean-machine setup, connectivity states, troubleshooting |
| `docs/security.md` | Credential rules and what CI enforces |
| `docs/supabase-config.md` | Dashboard settings, traced to their requirement |
| `docs/onboarding-another-developer.md` | Connecting a second developer to the shared dev project |

| `docs/token-claims.md` | Observed token behaviour; the `auth_time` finding |
| `docs/milestone-2-test-report.md` | What was tested, what passed, what remains |
