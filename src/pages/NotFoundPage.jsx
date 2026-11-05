import { Link } from 'react-router-dom'

/**
 * 404 — catch-all for unmatched routes.
 */
function NotFoundPage() {
  return (
    <section>
      <p className="font-mono text-sm text-slate-500 dark:text-slate-500">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        That route does not exist.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block text-sm font-medium text-brand-600 underline underline-offset-4 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
      >
        Back to home
      </Link>
    </section>
  )
}

export default NotFoundPage
