import { Link } from 'react-router-dom'

/**
 * 403 — insufficient permissions.
 *
 * Built now, unused until roles arrive (architecture F screen 10, Milestone 10).
 * It exists because RoleGuard will need somewhere to send people, and because
 * building it later would mean touching the route table again.
 *
 * Note: this page is a USER EXPERIENCE affordance, never a security boundary.
 * Access is actually denied by PostgreSQL GRANTs and RLS policies, which run
 * regardless of what the frontend renders (architecture E.3).
 */
function ForbiddenPage() {
  return (
    <section>
      <p className="font-mono text-sm text-slate-500 dark:text-slate-500">403</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Not permitted
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Your account does not have access to this page.
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

export default ForbiddenPage
