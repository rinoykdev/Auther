/**
 * Temporary Step 2 verification surface.
 *
 * This component exists to prove that Tailwind v4 utilities compile and apply —
 * in the dev server AND in the production build. It is replaced in Step 3 by
 * real routing and placeholder pages.
 *
 * Every style below is a Tailwind utility class. There is no accompanying CSS
 * file. If these styles render, Tailwind is wired up correctly.
 */
function App() {
  const checks = [
    { label: 'Vite dev server', detail: 'Serving on port 5173' },
    { label: 'Tailwind v4', detail: 'Utilities compiled via @tailwindcss/vite' },
    { label: 'Design tokens', detail: '@theme colours generating utilities' },
    { label: 'Dark mode', detail: 'Following your system appearance' },
  ]

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <p className="mb-2 font-mono text-xs tracking-widest text-brand-600 uppercase dark:text-brand-400">
          Milestone 2 &middot; Step 2
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Auther
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Authentication module scaffold. No authentication flows, database
          tables or backend connection exist yet &mdash; this page only confirms
          the toolchain works.
        </p>
      </div>

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
        {checks.map(({ label, detail }) => (
          <li key={label} className="flex items-start gap-3 px-5 py-4">
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                {label}
              </span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">
                {detail}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-slate-500 dark:text-slate-500">
        Next: Step 3 &mdash; feature-based folder structure and the Supabase
        client with explicit PKCE configuration.
      </p>
    </main>
  )
}

export default App
