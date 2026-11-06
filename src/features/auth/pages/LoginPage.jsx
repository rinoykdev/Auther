import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import GoogleMark from '../components/GoogleMark'
import PillInput from '../components/PillInput'

/**
 * =============================================================================
 * Login — VISUAL ONLY
 * =============================================================================
 *
 * Presentational implementation of the approved login design, built ahead of
 * Milestone 4 as an explicitly scoped visual task.
 *
 * THERE IS NO AUTHENTICATION HERE, deliberately:
 *   - the form does not submit;
 *   - the inputs hold no state and are not validated;
 *   - the Login button does nothing;
 *   - "Continue with Google" is not wired to OAuth;
 *   - "Forgot password" does not navigate or send anything;
 *   - nothing imports supabaseClient.
 *
 * Real behaviour arrives in Milestone 4 (registration, verification, login)
 * and Milestone 5 (password recovery). Social sign-in is deferred entirely
 * (architecture 0.2) — the Google button is rendered because it is in the
 * approved design, not because the capability exists.
 *
 * The form carries onSubmit={(e) => e.preventDefault()} so that pressing Enter
 * in a field cannot trigger a native page navigation. That is layout hygiene,
 * not authentication logic.
 *
 * The branding panel lives in AuthLayout, shared with Sign Up so the pair
 * cannot drift apart (architecture F).
 * =============================================================================
 */

function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Login to your Intellicar account">
      <form className="mt-12 lg:mt-20" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-5 lg:space-y-7">
          <PillInput
            id="email"
            label="Login with email"
            type="email"
            autoComplete="email"
          />

          <div>
            <PillInput
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
            />
            <div className="mt-2 pl-1.5">
              {/*
                Intentionally a button, not a link: password recovery is
                Milestone 5 and there is no destination yet. An <a href="#">
                would be a broken promise in the markup.
              */}
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="mt-9 w-full rounded-full bg-ink-900 py-4 text-base font-bold text-white transition-colors hover:bg-ink-900/90 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none lg:mt-12"
        >
          Login
        </button>
      </form>

      <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
        Or sign in with
      </p>

      <button
        type="button"
        className="mt-4 flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-transparent py-4 text-base font-semibold text-ink-900 transition-colors hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
      >
        <GoogleMark />
        Continue with Google
      </button>

      {/*
        Requirement 1 — the two screens link to each other. The typed email is
        deliberately not carried across: forwarding it would let a visitor learn
        from the destination screen's behaviour whether an address is already
        registered (architecture H.3 Family 3).
      */}
      <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
        New to Intellicar?{' '}
        <Link
          to="/signup"
          className="font-semibold text-blue-600 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
