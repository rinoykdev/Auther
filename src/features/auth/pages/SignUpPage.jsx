import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import SocialButton from '../components/SocialButton'
import SubmitButton from '../components/SubmitButton'
import { useAuth } from '../hooks/useAuth'
import { toUserMessage } from '../lib/errorMessages'
import { MIN_PASSWORD_LENGTH, validateSignUp } from '../lib/validation'

/**
 * =============================================================================
 * Sign Up (architecture C.1, F screen 1)
 * =============================================================================
 * Four fields, fixed by C.1: full name, email, password, confirm password.
 *
 * WHAT THIS SCREEN DOES NOT DO, and must not start doing:
 *   - it does not create the profile row or assign a role. The database
 *     trigger does both, inside the auth.users insert transaction (D.4). A
 *     form that wrote them would be the client doing the server's job, and
 *     would be skippable by anyone calling the API directly;
 *   - it does not send `confirmPassword` anywhere. The comparison happens here
 *     and the value is discarded, because no server checks it;
 *   - it does not tell the user whether an address is already registered. With
 *     email confirmation on, Supabase deliberately shapes that response to
 *     look like a new registration, and we must not add the information back
 *     by behaving differently (H.3 Family 3).
 *
 * On success we go to Check Your Email. There is NO session at this point -
 * that null session is what makes requirement 7 true (C.1.1).
 * =============================================================================
 */

function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }))
    // Clear this field's error as soon as the user edits it. Leaving stale
    // errors on screen while someone is fixing them is its own small cruelty.
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const errors = validateSignUp(values)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setBusy(true)
    const { error } = await signUp({
      email: values.email,
      password: values.password,
      fullName: values.fullName,
    })
    setBusy(false)

    if (error) {
      setFormError(toUserMessage(error))
      return
    }

    // The email is carried so Check Your Email can offer a resend. It travels
    // in router state, not the URL: an address in a query string ends up in
    // browser history, server logs and referrer headers (E.6).
    navigate('/check-email', { state: { email: values.email.trim() } })
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started with your Intellicar account"
    >
      <form className="mt-10" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="mb-6">
            <Alert tone="error">{formError}</Alert>
          </div>
        )}

        <div className="space-y-5">
          <FormField
            id="fullName"
            label="Full name"
            type="text"
            autoComplete="name"
            value={values.fullName}
            onChange={update('fullName')}
            error={fieldErrors.fullName}
          />
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={update('email')}
            error={fieldErrors.email}
          />
          {/*
            autoComplete="new-password" on BOTH: it tells the browser and
            password managers this is a registration, so they offer to generate
            and store a password rather than autofilling an existing one into
            the confirm box.
          */}
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={update('password')}
            error={fieldErrors.password}
          />
          <FormField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={update('confirmPassword')}
            error={fieldErrors.confirmPassword}
          />
        </div>

        {/*
          Stated up front rather than as a rejection. The real boundary is
          Supabase Auth's own policy, applied server-side (checklist item 8);
          this only sets the expectation.
        */}
        <p className="mt-3 pl-6 text-sm text-ink-900/70">
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </p>

        <div className="mt-8">
          <SubmitButton busy={busy} busyLabel="Creating account…">
            Create account
          </SubmitButton>
        </div>
      </form>

      <p className="mt-8 text-center text-[0.95rem] text-ink-900/80">
        Or sign up with
      </p>

      <SocialButton verb="sign up" />

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
