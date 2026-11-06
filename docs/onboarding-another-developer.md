# Onboarding another developer

How a second person connects their own local frontend to the **same** Supabase
Cloud development project.

**No Docker. No local database. No local Supabase stack.**

---

## What they need

1. Node.js 20.19+ or 22.12+
2. Git
3. Read access to this repository
4. An invitation to the Supabase **development** project, or the two values
   below delivered securely

---

## Steps

```bash
git clone https://github.com/rinoykdev/Auther.git
cd Auther
npm install
cp .env.example .env.local
# fill in .env.local — see below
npm run dev
```

Open `http://localhost:5173`. The home page reports the connection state; see
`setup.md` for what each state means.

---

## Getting the two values — securely

They need `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

**Preferred:** invite them to the Supabase project. They read both from
**Project Settings → API** themselves. Nothing is transmitted by anyone.

**Acceptable:** a password manager share.

**Never:** chat, email, Slack, a commit, or a screenshot. Not because the
publishable key is secret — it ships in browser JavaScript by design — but
because the habit is what matters. The same reflex applied to a secret key is a
breach, and you do not want to be deciding which kind of key you are pasting at
the time.

**They never receive the secret / service-role key.** Nothing in local
development needs it.

---

## What is shared, and what that means

The development project is **one hosted backend used by everyone**. There is no
per-developer isolation.

| Shared | Consequence |
| --- | --- |
| The database | One person's migration affects everyone. There is no `stop` and `start` to reset — a bad migration is a repair job |
| The auth user list | Test accounts are visible to all. Delete yours when finished |
| Rate limits | One person's brute-force test can lock out another. Coordinate before running anything that hammers auth endpoints |
| Email quota | The built-in sender is heavily rate-limited. Several people testing signup at once will exhaust it, and the failure looks like "verification is broken" |

**Offline work is not possible.** The backend is a network dependency.

If collisions become a real problem, the answer is a Supabase project per
developer — not coordination by goodwill.

---

## House rules

1. **Clean up test accounts** when you are done with them.
2. **Say so before running anything load-bearing** — bulk inserts, auth
   hammering, migrations.
3. **Never point `.env.local` at production.** Development only.
4. **Migrations are reviewed before they are applied.** There is no undo.
5. **Enable MFA** on your Supabase and GitHub accounts.

---

## Verifying the setup works

```bash
npm run lint      # oxlint
npm run test:ci   # Vitest — unit, component, routing
npm run build     # production build
npm run test:e2e  # Playwright (starts its own dev server)
```

All four should pass on a clean checkout. The tests do **not** touch Supabase —
environment variables are stubbed, so a wrong `.env.local` will not make them
fail, and a passing suite does not prove your connection works. The home page's
connection state is what tells you that.

---

## Common first-run problems

| Symptom | Cause |
| --- | --- |
| `Missing required environment variable(s)` | No `.env.local`, or a typo in a name |
| `does not look like a Supabase project URL` | The dashboard page URL was pasted instead of the API URL from Project Settings → API |
| Red **Unreachable** | Wrong URL, no internet, or the free-tier project has paused — restore it from the dashboard |
| Amber **Key rejected** | Wrong or truncated publishable key |
| `Invalid hook call` | Stale Vite cache. `rm -rf node_modules/.vite` and restart |
| Env edits have no effect | Restart the dev server; Vite reads env files only at startup |
