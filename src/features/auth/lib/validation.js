/**
 * Client-side validation — for FEEDBACK ONLY.
 *
 * None of this is a security control. Every rule here is also enforced by
 * Supabase Auth server-side, which is the boundary; this exists so a user
 * learns about a problem while typing instead of after a round trip.
 *
 * MIN_PASSWORD_LENGTH mirrors the dashboard setting (checklist item 8). If the
 * two ever disagree, the server wins and the user sees a rejection they were
 * not warned about — so the number lives here once, and nowhere else.
 */
export const MIN_PASSWORD_LENGTH = 10

export function validateSignUp({ fullName, email, password, confirmPassword }) {
  const errors = {}

  if (!fullName?.trim()) errors.fullName = 'Please enter your name.'
  else if (fullName.trim().length > 80)
    errors.fullName = 'Please use 80 characters or fewer.'

  if (!email?.trim()) errors.email = 'Please enter your email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = 'That email address does not look valid.'

  if (!password) errors.password = 'Please choose a password.'
  else if (password.length < MIN_PASSWORD_LENGTH)
    // Deliberately NOT the same wording as the hint under the field. An
    // identical string is indistinguishable from the always-present hint —
    // the user cannot tell the form responded, and nor can a test.
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`

  // The confirm field is a typo guard. It is compared here and then discarded
  // — it is never sent anywhere, because no server checks it (C.1).
  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.'
  else if (password !== confirmPassword)
    errors.confirmPassword = 'Those passwords do not match.'

  return errors
}

export function validateLogin({ email, password }) {
  const errors = {}
  if (!email?.trim()) errors.email = 'Please enter your email address.'
  // NOTE: no length rule on login. Telling someone their password is "too
  // short to be valid" before checking it leaks the policy and helps nobody.
  if (!password) errors.password = 'Please enter your password.'
  return errors
}
