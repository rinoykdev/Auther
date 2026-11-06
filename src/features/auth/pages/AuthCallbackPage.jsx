import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import { exchangeCodeForSession } from '../services/authService'
import { toUserMessage } from '../lib/errorMessages'

/**
 * Auth Callback (architecture C.2, C.9, F screen 3).
 *
 * Supabase redirects here with `?code=` after the user clicks the confirmation
 * link. We exchange it explicitly rather than leaving it to
 * `detectSessionInUrl`, so each failure mode gets its own message instead of
 * a silent no-op:
 *
 *   - opened in a DIFFERENT browser from the one that started sign-up: the
 *     PKCE code verifier lives in that browser's storage, so the exchange
 *     cannot complete here. Inherent to PKCE, not a bug — the user needs a
 *     fresh link, and a reassuring explanation;
 *   - link already used, including by a corporate mail scanner that followed
 *     it before the human did (C.2). Recoverable, with a resend;
 *   - link expired.
 *
 * The ref guard matters: React 19 StrictMode runs effects twice in
 * development, and a one-time code exchanged twice fails the second time —
 * which would show an error on a sign-up that actually succeeded.
 */

function AuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const code = params.get('code')

  // Problems visible in the URL itself are derived during render, not set from
  // an effect. They are knowable before any work happens, and routing them
  // through state would start a second render to say something already true.
  const urlError =
    params.get('error_description')
    ?? (code ? null : 'That link is missing its confirmation code.')

  const [exchangeError, setExchangeError] = useState(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (urlError || attempted.current) return
    attempted.current = true

    exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setExchangeError(toUserMessage(error))
        return
      }
      // Confirmed and signed in. `replace` so Back does not return to a
      // callback URL whose code has now been consumed.
      navigate('/', { replace: true })
    })
  }, [code, urlError, navigate])

  const error = urlError ?? exchangeError

  if (!error) {
    return (
      <AuthLayout title="Confirming…" subtitle="One moment">
        <div className="mt-10 flex justify-center" role="status">
          <span className="size-8 animate-spin rounded-full border-2 border-ink-900/20 border-t-ink-900" />
          <span className="sr-only">Confirming your email address</span>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="We couldn't confirm that link"
      subtitle="It happens — here's how to fix it"
    >
      <div className="mt-10 space-y-6">
        <Alert tone="error">{error}</Alert>
        <p className="text-[0.95rem] text-ink-900/80">
          Confirmation links can only be used once, expire after a while, and
          must be opened in the browser you signed up in. Requesting a new one
          resolves all three.
        </p>
        <Link
          to="/login"
          className="block w-full rounded-full bg-ink-900 py-4 text-center text-base font-bold text-white hover:bg-ink-900/90"
        >
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}

export default AuthCallbackPage
