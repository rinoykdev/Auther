import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

/**
 * Read session state.
 *
 * Throws rather than returning null when used outside the provider: a null
 * context would make every component silently behave as though nobody is
 * signed in, which looks like a session bug and is really a wiring bug.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
