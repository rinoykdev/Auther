import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../hooks/useAuth'

/**
 * Check Your Email (architecture F screen 2).
 *
 * Reached after sign-up. There is no session at this point and the account is
 * unconfirmed — that is requirement 7 working, not a problem to route around.
 *
 * =============================================================================
 * THIS SCREEN IS REACHED BY TWO DIFFERENT USERS AND MUST NOT TELL THEM APART
 * =============================================================================
 * With email confirmation enabled, signUp for an address that ALREADY has a
 * confirmed account returns no error, creates nothing, and sends nothing. The
 * caller cannot distinguish it from a real registration — deliberately, and we
 * must not undo that.
 *
 * (`data.user.identities === []` does in fact mark the duplicate case. Reading
 * it to vary this screen would hand back the membership oracle H.3 Family 3
 * exists to close: type an address, see which screen you get, learn whether it
 * is registered. SignUpPage therefore ignores `data` entirely.)
 *
 * So every line here must be TRUE IN BOTH CASES. That rules out "We've sent a
 * confirmation link to you", which is false for the duplicate — no email was
 * sent — and is the kind of false reassurance that leaves someone waiting for
 * a message that is never coming.
 *
 * The conditional phrasing is doing real work. It is not hedging for its own
 * sake, and it should not be "tidied up" into a definite claim.
 *
 * The way OUT for the user who already has an account is the navigation: sign
 * in, or reset the password. Both are offered unconditionally, because
 * offering them only to duplicates would be the same oracle by another route.
 * =============================================================================
 *
 * The resend button has a COOLDOWN because the built-in Supabase sender is
 * rate-limited (checklist item 10). Without it, an impatient user clicks four
 * times, hits the project-wide limit, and then cannot receive the email they
 * were waiting for — which looks exactly like the product being broken.
 */
const COOLDOWN_SECONDS = 60

function CheckEmailPage() {
  const { resendConfirmation } = useAuth()
  const location = useLocation()
  const email = location.state?.email ?? null

  const [cooldown, setCooldown] = useState(0)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS)
    const tick = setInterval(() => {
      setCooldown((n) => {
        if (n <= 1) {
          clearInterval(tick)
          return 0
        }
        return n - 1
      })
    }, 1000)
  }

  const handleResend = async () => {
    if (!email || cooldown > 0) return
    setBusy(true)
    await resendConfirmation({ email })
    setBusy(false)
    // Shown regardless of outcome: a message that differed for an unknown
    // address would turn this screen into a membership oracle (H.3 Family 3).
    setSent(true)
    startCooldown()
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle="One more step before you can sign in"
    >
      <div className="mt-10 space-y-6">
        <Alert tone="info">
          {email ? (
            <>
              If <span className="font-semibold">{email}</span> still needs
              confirming, a link is on its way. Open it to activate your
              account.
            </>
          ) : (
            <>
              If that address still needs confirming, a link is on its way.
              Open it to activate your account.
            </>
          )}
        </Alert>

        <p className="text-[0.95rem] text-ink-900/80">
          Already registered with this address? No new email is sent — sign in
          below, or reset your password if you&apos;ve forgotten it.
        </p>

        <p className="text-[0.95rem] text-ink-900/80">
          The link opens in this browser. If you open it on another device,
          you&apos;ll be asked to request a fresh one — that is how the sign-up
          flow is secured, not a fault.
        </p>

        <p className="text-[0.95rem] text-ink-900/80">
          Not arrived? Check your spam folder first.
        </p>

        {sent && (
          <Alert tone="success">
            If that address still needs confirming, a new link is on its way.
          </Alert>
        )}

        {email && (
          <button
            type="button"
            onClick={handleResend}
            disabled={busy || cooldown > 0}
            className="w-full rounded-full border border-slate-300 bg-transparent py-4 text-base font-semibold text-ink-900 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : busy
                ? 'Sending…'
                : 'Resend the email'}
          </button>
        )}

        <div className="space-y-3 border-t border-slate-200 pt-6">
          <Link
            to="/login"
            className="block w-full rounded-full bg-ink-900 py-4 text-center text-base font-bold text-white hover:bg-ink-900/90"
          >
            Go to sign in
          </Link>
          <p className="text-center text-[0.95rem] text-ink-900/80">
            <Link
              to="/forgot-password"
              className="font-semibold text-blue-600 hover:underline"
            >
              Forgot your password?
            </Link>
            {' · '}
            <Link
              to="/signup"
              className="font-semibold text-blue-600 hover:underline"
            >
              Wrong address?
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

export default CheckEmailPage
