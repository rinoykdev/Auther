import ConnectionStatus from '../components/ConnectionStatus'

/**
 * Home — public placeholder.
 *
 * Milestone 2 has no authentication, so there is nothing to protect and nothing
 * to personalise. This page exists to prove routing works and to give later
 * milestones a destination to redirect to.
 */
function HomePage() {
  return (
    <section>
      <p className="mb-2 font-mono text-xs tracking-widest text-brand-600 uppercase dark:text-brand-400">
        Milestone 2 &middot; Step 3
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Auther
      </h1>
      <p className="mt-3 max-w-prose text-slate-600 dark:text-slate-400">
        A reusable authentication module for React, built on Supabase Cloud.
        Project scaffold only &mdash; no authentication flows, database tables
        or backend connection exist yet.
      </p>

      <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-800">
        {[
          ['Frontend', 'React + Vite, local'],
          ['Styling', 'Tailwind CSS v4'],
          ['Backend', 'Supabase Cloud'],
          ['Deployment', 'Deferred'],
        ].map(([term, value]) => (
          <div key={term} className="bg-white px-5 py-4 dark:bg-slate-900">
            <dt className="text-xs tracking-wide text-slate-500 uppercase dark:text-slate-500">
              {term}
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <ConnectionStatus />
    </section>
  )
}

export default HomePage
