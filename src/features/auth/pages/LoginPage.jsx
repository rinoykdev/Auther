import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import SocialButton from '../components/SocialButton'
import SubmitButton from '../components/SubmitButton'
import { useAuth } from '../hooks/useAuth'
import { toUserMessage } from '../lib/errorMessages'
import { validateLogin } from '../lib/validation'

/**
 * =============================================================================
 * Login (architecture C.3, F screen 4)
 * =============================================================================
 * One generic message for every credential failure. Supabase will happily tell
 * us whether the address exists; showing that would turn this form into a
 * membership oracle (H.3 Family 3). The mapping lives in errorMessages.js so
 * the rule is enforced in one reviewable place.
 *
 * The exception is an UNCONFIRMED account, which gets its own message plus a
 * resend link. That is not an enumeration leak in our flow — sign-up already
 * responds identically for new and existing addresses — and without it a user
 * who never saw the email has no way forward.
 *
 * After signing in, the user returns to wherever they were sent away from
 * (C.9). `location.state.from` is set by ProtectedRoute.
 * =============================================================================
 */

function LoginPage() {
  const { signIn, resendConfirmation } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [values, setValues] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)

  const update = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }))
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    setNeedsConfirmation(false)
    setResent(false)

    const errors = validateLogin(values)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setBusy(true)
    const { error } = await signIn(values)
    setBusy(false)

    if (error) {
      const code = error.code ?? error.error_code
      if (code === 'email_not_confirmed'
        || (error.message ?? '').toLowerCase().includes('not confirmed')) {
        setNeedsConfirmation(true)
      }
      setFormError(toUserMessage(error))
      return
    }

    // `replace` so Back does not return to the login form on an active
    // session — which would look like being signed out.
    navigate(location.state?.from ?? '/', { replace: true })
  }

  const handleResend = async () => {
    await resendConfirmation({ email: values.email })
    // Shown regardless of the result, for the same reason the error message is
    // generic: a failure that is specific to "no such account" would leak it.
    setResent(true)
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Login to your Intellicar account">
      <form className="mt-10" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="mb-6">
            <Alert tone="error">{formError}</Alert>
          </div>
        )}

        {needsConfirmation && !resent && (
          <div className="mb-6">
            <Alert tone="info">
              Not received it?{' '}
              <button
                type="button"
                onClick={handleResend}
                className="font-semibold text-blue-600 underline"
              >
                Resend the confirmation email
              </button>
            </Alert>
          </div>
        )}

        {resent && (
          <div className="mb-6">
            <Alert tone="success">
              If that address needs confirming, a new link is on its way.
            </Alert>
          </div>
        )}

        <div className="space-y-5">
          <FormField
            id="email"
            label="Login with email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={update('email')}
            error={fieldErrors.email}
          />

          <div>
            <FormField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={update('password')}
              error={fieldErrors.password}
            />
            <div className="mt-2 pl-6">
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-9">
          <SubmitButton busy={busy} busyLabel="Signing in…">
            Login
          </SubmitButton>
        </div>
      </form>

      <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
        Or sign in with
      </p>

      <SocialButton verb="sign in" />

      {/*
        Requirement 1. The typed email is deliberately NOT carried to sign-up:
        forwarding it would let a visitor learn from the destination screen
        whether an address is already registered (H.3 Family 3).
      */}
      <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
        New to Intellicar?{' '}
        <Link to="/signup" className="font-semibold text-blue-600 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
