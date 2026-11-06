import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import GoogleMark from '../components/GoogleMark'
import PillInput from '../components/PillInput'

/**
 * =============================================================================
 * Sign Up — VISUAL ONLY
 * =============================================================================
 *
 * The registration screen specified in architecture revision 7 (C.1, F screen
 * 1), built ahead of Milestone 4 as a visual task, exactly as the login screen
 * was.
 *
 * THERE IS NO REGISTRATION HERE, deliberately:
 *   - the form does not submit and the inputs hold no state;
 *   - nothing is validated — not the email, not the password length, and NOT
 *     whether the two passwords match;
 *   - no account is created, no email is sent, no profile row appears;
 *   - nothing imports supabaseClient.
 *
 * Real behaviour arrives in Milestone 4, and it depends on Milestone 3's
 * database work landing first: the `profiles` row and the default `user` role
 * are created by a database trigger when Supabase Auth inserts the user, not
 * by this screen (architecture C.1 step 5, D.4). A signup form that wrote
 * those rows itself would be the client doing the server's job, which is the
 * mistake D.4 exists to prevent.
 *
 * Fields are fixed at four by C.1: full name, email, password, confirm
 * password. The confirm value is a typo guard that is compared in the browser
 * and then discarded — when this is wired up it must NOT be sent anywhere,
 * because sending it would imply a server-side check that does not exist.
 *
 * The "Full name" field populates `profiles.display_name` (D.2 naming note):
 * the column keeps that name because the value is editable afterwards, so what
 * it holds is chosen presentation rather than verified identity.
 * =============================================================================
 */

function SignUpPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started with your Intellicar account"
    >
      <form className="mt-10" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-5">
          <PillInput
            id="fullName"
            label="Full name"
            type="text"
            autoComplete="name"
          />
          <PillInput
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
          />
          {/*
            autoComplete="new-password" on BOTH password fields: it tells the
            browser and password managers this is a registration, so they offer
            to generate and store a password rather than autofilling an
            existing one into the confirm box.
          */}
          <PillInput
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
          />
          <PillInput
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
          />
        </div>

        {/*
          Stated, not enforced. The 10-character minimum is checklist item 8
          and the real boundary is Supabase Auth's own policy, applied
          server-side in Milestone 4 — this line only sets the expectation so
          the rule does not first appear as a rejection.
        */}
        <p className="mt-3 pl-1.5 text-sm text-ink-900/70">
          Use at least 10 characters.
        </p>

        <button
          type="submit"
          className="mt-8 w-full rounded-full bg-ink-900 py-4 text-base font-bold text-white transition-colors hover:bg-ink-900/90 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
        >
          Create account
        </button>
      </form>

      <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
        Or sign up with
      </p>

      <button
        type="button"
        className="mt-4 flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-transparent py-4 text-base font-semibold text-ink-900 transition-colors hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
      >
        <GoogleMark />
        Continue with Google
      </button>

      {/*
        Requirement 1 — the two screens link to each other. A real router Link,
        because /login exists. Note what is deliberately NOT done: the typed
        email is not carried across. Forwarding it would let a visitor learn
        from the destination screen's behaviour whether an address is already
        registered (architecture H.3 Family 3, account enumeration).
      */}
      <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-blue-600 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

export default SignUpPage
