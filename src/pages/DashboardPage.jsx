import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/hooks/useAuth'
import { supabase } from '../lib/supabaseClient'

/**
 * Dashboard — the protected landing page (architecture F screen 9).
 *
 * It reads the profile and roles through PostgREST with the signed-in user's
 * token, which makes it the first real end-to-end exercise of migration
 * 0001: the trigger created these rows, the GRANTs allow the read, and RLS
 * narrows it to this user. If any of the three is wrong, this page shows it.
 *
 * NOTE on roles: this displays the role, it does not act on it. Role-based
 * authorization — has_role, RoleGuard, admin paths — is Milestone 10.
 */
function DashboardPage() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [roles, setRoles] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from('profiles').select('*').single(),
        supabase.from('user_roles').select('role, granted_at'),
      ])
      if (!active) return

      if (profileResult.error) setError(profileResult.error.message)
      else setProfile(profileResult.data)

      if (!rolesResult.error) setRoles(rolesResult.data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return (
    // The dark palette on <body> belongs to the auth screens' full-bleed split
    // (index.css, sampled from the approved design). The dashboard is a light
    // surface, so it paints its own background rather than letting light text
    // inherit a dark body — which is exactly how text-slate-900 ended up on
    // #000308 and became unreadable.
    //
    // [color-scheme:light] comes along so form controls and scrollbars in this
    // subtree follow the surface rather than :root's dark declaration.
    <div className="min-h-screen bg-slate-50 text-slate-900 [color-scheme:light]">
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        <p className="mb-2 font-mono text-xs tracking-widest text-brand-600 uppercase">
          Signed in
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          {loading ? 'Loading…' : (profile?.display_name ?? 'Welcome')}
        </h1>
        <p className="mt-3 text-slate-600">{user?.email}</p>

        {error && (
          <p className="mt-6 rounded-xl bg-red-50 px-5 py-3 text-sm text-red-800 ring-1 ring-red-200">
            Could not load your profile: {error}
          </p>
        )}

        <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
          {[
            ['Display name', profile?.display_name ?? '—'],
            ['Role', roles.map((r) => r.role).join(', ') || '—'],
            ['Profile created', profile?.created_at?.slice(0, 10) ?? '—'],
            ['Email confirmed', user?.email_confirmed_at ? 'Yes' : 'No'],
          ].map(([term, value]) => (
            <div key={term} className="bg-white px-5 py-4">
              <dt className="text-xs tracking-wide text-slate-500 uppercase">
                {term}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={signOut}
          className="mt-8 self-start rounded-full bg-ink-900 px-8 py-3 text-sm font-bold text-white hover:bg-ink-900/90"
        >
          Sign out
        </button>
      </main>
    </div>
  )
}

export default DashboardPage
