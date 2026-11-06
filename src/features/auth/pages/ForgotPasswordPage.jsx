import { useState } from 'react'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import SubmitButton from '../components/SubmitButton'
import { useAuth } from '../hooks/useAuth'

/**
 * Forgot Password (architecture C.5, F screen 5).
 *
 * THE SAME MESSAGE IS SHOWN WHATEVER HAPPENS — success, unknown address, or
 * failure. This is not vagueness for its own sake: a form that said "no
 * account with that address" would let anyone test addresses one at a time and
 * learn who is registered (H.3 Family 3, account enumeration).
 *
 * The error is deliberately swallowed for the same reason. The one exception
 * worth considering later is a rate-limit response, which is already visible
 * to the attacker by other means.
 */
function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim()) {
      setFieldError('Please enter your email address.')
      return
    }
    setFieldError(null)
    setBusy(true)
    await requestPasswordReset({ email })
    setBusy(false)
    setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link"
    >
      {sent ? (
        <div className="mt-10 space-y-6">
          <Alert tone="success">
            If an account exists for that address, a reset link is on its way.
          </Alert>
          <p className="text-[0.95rem] text-ink-900/80">
            The link works once and expires. Open it in this browser.
          </p>
          <Link
            to="/login"
            className="block w-full rounded-full bg-ink-900 py-4 text-center text-base font-bold text-white hover:bg-ink-900/90"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="mt-10" onSubmit={handleSubmit} noValidate>
          <FormField
            id="email"
            label="Your email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setFieldError(null)
            }}
            error={fieldError}
          />

          <div className="mt-8">
            <SubmitButton busy={busy} busyLabel="Sending…">
              Send reset link
            </SubmitButton>
          </div>

          <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}

export default ForgotPasswordPage
