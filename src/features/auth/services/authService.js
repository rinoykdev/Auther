import { supabase } from '../../../lib/supabaseClient'

/**
 * =============================================================================
 * authService — the ONLY place supabase.auth is called
 * =============================================================================
 * Components never touch supabase-js directly. That boundary is what makes
 * features/auth portable (architecture B.3) and it is what makes the flows
 * testable without a network.
 *
 * Every function returns { data, error } rather than throwing, so callers
 * handle failure as a value. Messages for display come from errorMessages.js;
 * raw errors never reach a screen.
 * =============================================================================
 */

/** Where Supabase sends the user after they click the confirmation link. */
const callbackUrl = () => `${window.location.origin}/auth/callback`

/** Where the password-recovery link lands. */
const recoveryUrl = () => `${window.location.origin}/reset-password`

/**
 * Register a new account.
 *
 * The full name travels in `options.data`, which Supabase stores as
 * `raw_user_meta_data`. The database trigger reads the key `display_name` from
 * there (migration 0001). THE KEY MUST MATCH ON BOTH SIDES: a mismatch raises
 * no error anywhere and simply gives every user the fallback name.
 *
 * `confirmPassword` is not a parameter. The comparison happens in the form and
 * the value is discarded — sending it would imply a server-side check that
 * does not exist.
 *
 * With email confirmation enabled, this returns a user and `session: null`.
 * That null session is requirement 7's actual enforcement (C.1.1).
 */
export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: callbackUrl(),
      data: { display_name: fullName.trim() },
    },
  })
  return { data, error }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  return { data, error }
}

export async function signOut() {
  // scope: 'global' revokes the refresh token everywhere, not just this tab.
  // Note what it does NOT do, verified in Milestone 2: PostgREST keeps
  // accepting the existing ACCESS token until it expires, up to an hour later.
  // RLS and GRANTs are what limit that window (token-claims.md §4).
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  return { error }
}

export async function resendConfirmation({ email }) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: callbackUrl() },
  })
  return { error }
}

export async function requestPasswordReset({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: recoveryUrl(),
  })
  return { error }
}

export async function updatePassword({ password }) {
  const { data, error } = await supabase.auth.updateUser({ password })
  return { data, error }
}

/**
 * Exchange the `?code=` in the callback URL for a session.
 *
 * Called explicitly rather than relying on `detectSessionInUrl`, so that the
 * failure modes in C.2 — link already used, link expired, link opened in a
 * different browser from the one that started sign-up — surface as errors we
 * can map to a message and a resend offer, instead of as a silent no-op.
 */
export async function exchangeCodeForSession(code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  return { data, error }
}

/** Local read, for rendering only. Never a security decision (C.9 rule 4). */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  return { session: data?.session ?? null, error }
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return () => data?.subscription?.unsubscribe()
}
