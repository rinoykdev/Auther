import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import SubmitButton from '../components/SubmitButton'
import { useAuth } from '../hooks/useAuth'
import { toUserMessage } from '../lib/errorMessages'
import { MIN_PASSWORD_LENGTH } from '../lib/validation'

/**
 * Reset Password (architecture C.5, C.9 rule 2, F screen 6).
 *
 * =============================================================================
 * THE GATE HERE IS NOT "IS THE USER SIGNED IN?"
 * =============================================================================
 * The recovery link creates a REAL session — by the time this page renders,
 * the user is fully authenticated. So gating on a session would mean any
 * ordinary signed-in user could navigate here and change their password
 * without proving anything, and more importantly that a signed-in user who
 * followed a stale link would see the form when they should not.
 *
 * The gate is the PASSWORD_RECOVERY event having fired during THIS page load,
 * tracked in AuthProvider and deliberately not persisted. That is C.9 rule 2,
 * and it is the single easiest thing in this flow to get wrong.
 *
 * After a successful change we sign out and send the user to log in again.
 * The recovery session was obtained by proving mailbox control, not by
 * knowing the new password; ending it means the new password gets used at
 * least once, and any other session opened from that link is closed.
 * =============================================================================
 */
function ResetPasswordPage() {
  const { passwordRecovery, updatePassword, signOut, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState({ password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!passwordRecovery) {
    return (
      <AuthLayout
        title="That link isn't valid"
        subtitle="It may have expired or already been used"
      >
        <div className="mt-10 space-y-6">
          <Alert tone="error">
            Open the reset link from your email to change your password. Links
            work once and expire.
          </Alert>
          <Link
            to="/forgot-password"
            className="block w-full rounded-full bg-ink-900 py-4 text-center text-base font-bold text-white hover:bg-ink-900/90"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const errors = {}
    if (values.password.length < MIN_PASSWORD_LENGTH)
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    if (values.password !== values.confirmPassword)
      errors.confirmPassword = 'Those passwords do not match.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setBusy(true)
    const { error } = await updatePassword({ password: values.password })
    if (error) {
      setBusy(false)
      setFormError(toUserMessage(error))
      return
    }

    clearPasswordRecovery()
    await signOut()
    setBusy(false)
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Then sign in with it">
      <form className="mt-10" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="mb-6">
            <Alert tone="error">{formError}</Alert>
          </div>
        )}

        <div className="space-y-5">
          <FormField
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => {
              setValues((v) => ({ ...v, password: e.target.value }))
              setFieldErrors((x) => ({ ...x, password: undefined }))
            }}
            error={fieldErrors.password}
          />
          <FormField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => {
              setValues((v) => ({ ...v, confirmPassword: e.target.value }))
              setFieldErrors((x) => ({ ...x, confirmPassword: undefined }))
            }}
            error={fieldErrors.confirmPassword}
          />
        </div>

        <p className="mt-3 pl-6 text-sm text-ink-900/70">
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </p>

        <div className="mt-8">
          <SubmitButton busy={busy} busyLabel="Saving…">
            Save new password
          </SubmitButton>
        </div>
      </form>
    </AuthLayout>
  )
}

export default ResetPasswordPage
