/**
 * =============================================================================
 * Error message mapping
 * =============================================================================
 * Supabase's raw errors are not safe to show verbatim. Two reasons, and the
 * second is the one that matters:
 *
 *   1. They are written for developers ("AuthApiError: Invalid login
 *      credentials"), not for people.
 *   2. Some of them DISTINGUISH "no such account" from "wrong password".
 *      Rendering that difference hands an attacker a membership oracle — type
 *      an address, read the error, learn whether it is registered. That is the
 *      account-enumeration hole architecture H.3 Family 3 tests for.
 *
 * So the rule here is narrow and deliberate: every credential failure maps to
 * ONE message, regardless of which of them actually happened.
 *
 * This file is reviewed by hand as part of H.3 Family 3 ("no mapped message
 * distinguishes 'no such account' from 'wrong credentials'"), which is why the
 * generic cases are grouped together and commented rather than scattered.
 * =============================================================================
 */

/** The single message used for every credential failure. Do not add variants. */
export const GENERIC_CREDENTIALS =
  'That email or password is not correct. Please try again.'

/**
 * Codes that must collapse into GENERIC_CREDENTIALS.
 *
 * `email_not_confirmed` is deliberately NOT in this list: it is not a
 * membership oracle in our flow, because our sign-up response is already
 * identical for new and existing addresses, and telling a real user to check
 * their inbox is the difference between a working product and a mystery.
 */
const CREDENTIAL_CODES = new Set([
  'invalid_credentials',
  'invalid_grant',
  'user_not_found',
])

const MESSAGES = {
  email_not_confirmed:
    'Please confirm your email address first. Check your inbox for the link.',
  over_email_send_rate_limit:
    'Too many emails requested. Please wait a few minutes and try again.',
  over_request_rate_limit:
    'Too many attempts. Please wait a few minutes and try again.',
  weak_password:
    'That password is too weak. Use at least 10 characters.',
  same_password:
    'That is already your current password. Choose a different one.',
  validation_failed: 'Please check the details you entered and try again.',
  email_address_invalid: 'That email address does not look valid.',
  signup_disabled: 'New registrations are currently closed.',
  otp_expired:
    'That link has expired or has already been used. Request a new one.',
  flow_state_not_found:
    'This link was opened in a different browser from the one that started '
    + 'sign-up, so it cannot be completed here. Request a new link and open it '
    + 'in this browser.',
}

/**
 * Turn a Supabase error into something safe to display.
 *
 * Unknown errors get a neutral fallback rather than `error.message`: an
 * unmapped message is exactly where a raw backend string, and whatever it
 * discloses, reaches the screen.
 */
export function toUserMessage(error) {
  if (!error) return null

  const code = error.code ?? error.error_code ?? null

  if (code && CREDENTIAL_CODES.has(code)) return GENERIC_CREDENTIALS
  if (code && MESSAGES[code]) return MESSAGES[code]

  // Older supabase-js versions, and some endpoints, report only a message.
  const raw = (error.message ?? '').toLowerCase()
  if (raw.includes('invalid login credentials')) return GENERIC_CREDENTIALS
  if (raw.includes('email not confirmed')) return MESSAGES.email_not_confirmed
  if (raw.includes('code verifier')) return MESSAGES.flow_state_not_found
  if (raw.includes('rate limit')) return MESSAGES.over_request_rate_limit

  if (error.name === 'AuthRetryableFetchError' || raw.includes('fetch')) {
    return 'Could not reach the server. Check your connection and try again.'
  }

  return 'Something went wrong. Please try again.'
}
