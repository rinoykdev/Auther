import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import FullPageSpinner from './FullPageSpinner'

/**
 * Gate for Login and Sign Up: a signed-in user has no business on either.
 *
 * Same caveat as ProtectedRoute — convenience, not security. And the same
 * loading rule: decide nothing until the session is known (C.9 rule 1).
 */
function PublicOnlyRoute({ children }) {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) return <FullPageSpinner label="Restoring your session" />
  if (isAuthenticated) return <Navigate to="/" replace />

  return children
}

export default PublicOnlyRoute
