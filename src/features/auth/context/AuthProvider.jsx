import { useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService'
import { AuthContext } from './AuthContext'

/**
 * =============================================================================
 * AuthProvider — the single source of session state
 * =============================================================================
 * Implements architecture C.4 and C.9.
 *
 * THE RULE THAT MATTERS (C.9 rule 1): `status` starts as 'loading' and no
 * route guard decides anything until the first auth event arrives. Skip this
 * and a signed-in user is bounced to the login screen on every page refresh,
 * because the session has not been read from storage yet.
 *
 * `passwordRecovery` exists for C.9 rule 2. The recovery link creates a REAL
 * session, so "is the user signed in?" cannot gate the reset form — the event
 * must be observed during this page load. It is deliberately not persisted:
 * surviving a reload is precisely what it must not do.
 * =============================================================================
 */

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('loading')
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let active = true

    // onAuthStateChange fires INITIAL_SESSION on subscribe, which is what
    // resolves `loading`. Reading storage separately would race it.
    const unsubscribe = authService.onAuthStateChange((event, nextSession) => {
      if (!active) return

      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)

      setSession(nextSession ?? null)
      setStatus(nextSession ? 'authenticated' : 'anonymous')
    })

    // Fallback: if no event arrives (a misconfigured client, an offline
    // start), resolve to anonymous rather than leaving the whole app stuck
    // behind a spinner forever. A blank page is a worse failure than a login
    // screen.
    const settle = setTimeout(() => {
      if (active) setStatus((s) => (s === 'loading' ? 'anonymous' : s))
    }, 5000)

    return () => {
      active = false
      clearTimeout(settle)
      unsubscribe?.()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      signUp: authService.signUp,
      signIn: authService.signIn,
      signOut: authService.signOut,
      resendConfirmation: authService.resendConfirmation,
      requestPasswordReset: authService.requestPasswordReset,
      updatePassword: authService.updatePassword,
    }),
    [session, status, passwordRecovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
